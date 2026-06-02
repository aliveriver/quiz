// Package llm 提供一个面向 OpenAI 兼容 chat completion
// API 的客户端封装。使用 sashabaranov/go-openai 库处理底层通信。
package llm

import (
	"context"
	"fmt"
	"io"
	"log"
	"net/http"
	"time"

	openai "github.com/sashabaranov/go-openai"
)

// Message 表示一条 chat 消息。
type Message struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

// ClientConfig 保存创建 LLM 客户端所需的参数。
type ClientConfig struct {
	BaseURL     string
	APIKey      string
	Model       string
	MaxTokens   int
	Temperature float64
	Timeout     time.Duration
}

// Client 负责与 OpenAI 兼容的 chat completions API 通信。
type Client struct {
	openaiClient *openai.Client
	model        string
	maxTokens    int
	temperature  float64
	timeout      time.Duration
}

func toOpenAIMessages(messages []Message) []openai.ChatCompletionMessage {
	openaiMessages := make([]openai.ChatCompletionMessage, len(messages))
	for i, msg := range messages {
		openaiMessages[i] = openai.ChatCompletionMessage{
			Role:    msg.Role,
			Content: msg.Content,
		}
	}

	return openaiMessages
}

// NewClient 根据给定配置创建 Client。
func NewClient(cfg ClientConfig) *Client {
	config := openai.DefaultConfig(cfg.APIKey)
	config.BaseURL = cfg.BaseURL
	config.HTTPClient = &http.Client{}

	return &Client{
		openaiClient: openai.NewClientWithConfig(config),
		model:        cfg.Model,
		maxTokens:    cfg.MaxTokens,
		temperature:  cfg.Temperature,
		timeout:      cfg.Timeout,
	}
}

// Complete 发送 chat completion 请求并返回 assistant 的
// 回复文本。它会使用客户端默认的 model/tokens/temperature。
func (c *Client) Complete(ctx context.Context, messages []Message) (string, error) {
	ctx, cancel := context.WithTimeout(ctx, c.timeout)
	defer cancel()
	return c.CompleteWithParams(ctx, messages, c.model, c.maxTokens, c.temperature)
}

// CompleteWithParams 使用显式参数发送 chat completion，
// 允许调用方针对特定请求覆盖默认值。
func (c *Client) CompleteWithParams(
	ctx context.Context,
	messages []Message,
	model string,
	maxTokens int,
	temperature float64,
) (string, error) {
	// 转换自定义 Message 类型到 openai.ChatCompletionMessage
	openaiMessages := toOpenAIMessages(messages)

	// 构建请求
	req := openai.ChatCompletionRequest{
		Model:       model,
		Messages:    openaiMessages,
		MaxTokens:   maxTokens,
		Temperature: float32(temperature),
	}

	// 发送请求
	resp, err := c.openaiClient.CreateChatCompletion(ctx, req)
	if err != nil {
		return "", fmt.Errorf("llm: create chat completion: %w", err)
	}

	// 检查响应
	if len(resp.Choices) == 0 {
		return "", fmt.Errorf("llm: response contained no choices")
	}

	return resp.Choices[0].Message.Content, nil
}

// CompleteStream 以流式方式调用 LLM，通过回调逐 chunk 返回生成的文本。
func (c *Client) CompleteStream(
	ctx context.Context,
	messages []Message,
	onChunk func(delta string),
) error {
	return c.CompleteStreamWithParams(ctx, messages, c.model, c.maxTokens, c.temperature, onChunk)
}

// CompleteStreamWithParams 是 CompleteStream 的参数化版本。
func (c *Client) CompleteStreamWithParams(
	ctx context.Context,
	messages []Message,
	model string,
	maxTokens int,
	temperature float64,
	onChunk func(delta string),
) error {
	openaiMessages := toOpenAIMessages(messages)

	req := openai.ChatCompletionRequest{
		Model:       model,
		Messages:    openaiMessages,
		MaxTokens:   maxTokens,
		Temperature: float32(temperature),
		Stream:      true,
	}

	stream, err := c.openaiClient.CreateChatCompletionStream(ctx, req)
	if err != nil {
		return fmt.Errorf("llm: create stream: %w", err)
	}
	defer stream.Close()

	sentText := false
	for {
		resp, err := stream.Recv()
		if err == io.EOF {
			if !sentText {
				log.Printf("[LLM] stream returned no text; retrying with non-stream completion")
				text, fallbackErr := c.CompleteWithParams(ctx, messages, model, maxTokens, temperature)
				if fallbackErr != nil {
					return fmt.Errorf("llm: stream returned no text; fallback completion: %w", fallbackErr)
				}
				if text != "" {
					onChunk(text)
				}
			}
			return nil
		}
		if err != nil {
			return fmt.Errorf("llm: stream recv: %w", err)
		}
		if len(resp.Choices) > 0 {
			delta := resp.Choices[0].Delta.Content
			if delta != "" {
				sentText = true
				onChunk(delta)
			}
		}
	}
}
