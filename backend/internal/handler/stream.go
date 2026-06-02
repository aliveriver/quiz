package handler

import (
	"encoding/base64"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"sync"
	"time"

	"ghost-relationship-test/internal/metrics"
	"ghost-relationship-test/internal/service"
)

// StreamHandler 持有流式 SSE 端点所需的依赖。
type StreamHandler struct {
	monologueSvc *service.MonologueService
	ttsPipeline  *service.TTSPipeline // 可为 nil（TTS 未配置时）
	metrics      *metrics.Metrics
}

// NewStreamHandler 创建 StreamHandler。
func NewStreamHandler(svc *service.MonologueService, pipeline *service.TTSPipeline, m *metrics.Metrics) *StreamHandler {
	return &StreamHandler{
		monologueSvc: svc,
		ttsPipeline:  pipeline,
		metrics:      m,
	}
}

// StreamMonologue 处理 POST /api/stream-monologue，以 SSE 逐 chunk 推送生成文本。
func (sh *StreamHandler) StreamMonologue(w http.ResponseWriter, r *http.Request) {
	flusher, ok := w.(http.Flusher)
	if !ok {
		http.Error(w, "streaming not supported", http.StatusInternalServerError)
		return
	}

	var req service.MonologueRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid request body: "+err.Error(), http.StatusBadRequest)
		return
	}

	if err := validateProfile(req.Profile); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")

	start := time.Now()

	err := sh.monologueSvc.GenerateStream(r.Context(), req, func(text string) {
		chunk, _ := json.Marshal(map[string]string{"text": text})
		fmt.Fprintf(w, "data: %s\n\n", chunk)
		flusher.Flush()
	})

	duration := time.Since(start)
	sh.metrics.Record(duration, err)

	if err != nil {
		log.Printf("ERROR stream monologue: %v", err)
		fmt.Fprintf(w, "data: {\"error\":\"%s\"}\n\n", "generation failed")
		flusher.Flush()
		return
	}

	fmt.Fprintf(w, "data: [DONE]\n\n")
	flusher.Flush()
}

// StreamMonologueWithTTS 处理 POST /api/stream-monologue-tts。
// 同时推送 LLM 文本和 TTS 音频，两种事件类型通过 SSE event 字段区分：
//
//	event: text    → data: {"text":"..."}
//	event: audio   → data: {"audio":"<base64>","final":false}
//	event: done    → data: [DONE]
//
// 前端收到 audio 事件后将 base64 解码为二进制，追加到 MediaSource 播放。
func (sh *StreamHandler) StreamMonologueWithTTS(w http.ResponseWriter, r *http.Request) {
	flusher, ok := w.(http.Flusher)
	if !ok {
		http.Error(w, "streaming not supported", http.StatusInternalServerError)
		return
	}

	var req service.MonologueRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid request body: "+err.Error(), http.StatusBadRequest)
		return
	}

	if err := validateProfile(req.Profile); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	// 如果 TTS Pipeline 未配置，降级为纯文本流
	if sh.ttsPipeline == nil {
		sh.StreamMonologue(w, r)
		return
	}

	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")

	// 用 mutex 保护 SSE 写入（text 和 audio 可能并发回调）
	var mu sync.Mutex

	sendSSE := func(event string, data []byte) {
		mu.Lock()
		defer mu.Unlock()
		fmt.Fprintf(w, "event: %s\ndata: %s\n\n", event, data)
		flusher.Flush()
	}

	start := time.Now()

	callbacks := service.StreamCallbacks{
		OnText: func(text string) {
			chunk, _ := json.Marshal(map[string]string{"text": text})
			sendSSE("text", chunk)
		},
		OnAudio: func(audioBytes []byte, isFinal bool) {
			b64 := base64.StdEncoding.EncodeToString(audioBytes)
			chunk, _ := json.Marshal(map[string]interface{}{
				"audio": b64,
				"final": isFinal,
			})
			sendSSE("audio", chunk)
		},
		OnError: func(err error) {
			log.Printf("[StreamTTS] non-fatal error: %v", err)
		},
	}

	err := sh.ttsPipeline.Run(r.Context(), req, callbacks)

	duration := time.Since(start)
	sh.metrics.Record(duration, err)

	if err != nil {
		log.Printf("ERROR stream monologue with tts: %v", err)
		errChunk, _ := json.Marshal(map[string]string{"error": "generation failed"})
		sendSSE("error", errChunk)
		return
	}

	sendSSE("done", []byte("[DONE]"))
}
