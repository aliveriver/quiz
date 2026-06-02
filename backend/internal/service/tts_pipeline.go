// Package service — tts_pipeline.go
// 将 LLM 流式生成与 MiniMax WebSocket TTS 串联成一条管线。
//
// 数据流向：
//   LLM Stream → 断句器 → MiniMax WS TTS → onText/onAudio 回调 → 前端 SSE
package service

import (
	"context"
	"fmt"
	"log"
	"sync"

	"ghost-relationship-test/internal/tts"
)

// TTSPipeline 封装 LLM+TTS 联合流式生成的逻辑。
type TTSPipeline struct {
	monologueSvc *MonologueService
	ttsClient    *tts.Client
}

// NewTTSPipeline 创建管线。
func NewTTSPipeline(svc *MonologueService, ttsClient *tts.Client) *TTSPipeline {
	return &TTSPipeline{
		monologueSvc: svc,
		ttsClient:    ttsClient,
	}
}

// StreamCallbacks 定义管线回调。
type StreamCallbacks struct {
	OnText  func(text string)                       // LLM 文本片段
	OnAudio func(audioBytes []byte, isFinal bool)   // TTS 音频片段
	OnError func(err error)                          // 非致命错误
}

// Run 执行 LLM → TTS 管线。
// 1. 启动 TTS WebSocket 会话
// 2. 流式调用 LLM，每个 chunk 通过 onText 回调推给前端
// 3. 同时将文本按句拆分，逐句喂给 TTS
// 4. TTS 返回的音频通过 onAudio 推给前端
// 5. LLM 结束后 flush 残余文本、发送 task_finish，等待 TTS 完成
func (p *TTSPipeline) Run(ctx context.Context, req MonologueRequest, cb StreamCallbacks) error {
	// 用于收集 TTS 异步错误
	var ttsErr error
	var ttsErrMu sync.Mutex

	onTTSError := func(err error) {
		ttsErrMu.Lock()
		ttsErr = err
		ttsErrMu.Unlock()
		log.Printf("[TTS Pipeline] TTS error: %v", err)
		if cb.OnError != nil {
			cb.OnError(err)
		}
	}

	// 1. 建立 TTS 会话
	session, err := p.ttsClient.NewSession(cb.OnAudio, onTTSError)
	if err != nil {
		// TTS 连接失败时降级为纯文本流
		log.Printf("[TTS Pipeline] TTS session failed, falling back to text-only: %v", err)
		return p.monologueSvc.GenerateStream(ctx, req, cb.OnText)
	}
	defer session.Close()

	// 2. 创建断句器
	splitter := tts.NewSentenceSplitter(10)

	// 3. 流式调用 LLM
	llmErr := p.monologueSvc.GenerateStream(ctx, req, func(textChunk string) {
		// 推送文本给前端
		if cb.OnText != nil {
			cb.OnText(textChunk)
		}

		// 通过断句器拆分，逐句发给 TTS
		sentences := splitter.Feed(textChunk)
		for _, sentence := range sentences {
			if err := session.SendText(sentence); err != nil {
				log.Printf("[TTS Pipeline] failed to send text to TTS: %v", err)
			}
		}
	})

	if llmErr != nil {
		// LLM 出错，也要通知 TTS 结束
		_ = session.Finish()
		return fmt.Errorf("tts pipeline: llm stream: %w", llmErr)
	}

	// 4. LLM 结束后，flush 断句器残余文本
	remaining := splitter.Flush()
	if remaining != "" {
		if err := session.SendText(remaining); err != nil {
			log.Printf("[TTS Pipeline] failed to send remaining text: %v", err)
		}
	}

	// 5. 通知 TTS 文本全部发完
	if err := session.Finish(); err != nil {
		log.Printf("[TTS Pipeline] failed to send task_finish: %v", err)
	}

	// 6. 等待 TTS 完成所有音频推送
	<-session.Done()

	ttsErrMu.Lock()
	finalErr := ttsErr
	ttsErrMu.Unlock()

	if finalErr != nil {
		log.Printf("[TTS Pipeline] TTS had errors but text stream completed: %v", finalErr)
		// TTS 错误不阻断整体流程，文本已经推完
	}

	return nil
}
