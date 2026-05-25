// Package llm 提供一个面向 OpenAI 兼容 chat completion
// API 的 HTTP 客户端。它负责请求构造、错误映射和响应解析，
// 让调用方只需要处理普通的 Go 类型。
package llm

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

// Message 表示一条 chat 消息。
type Message struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

// ChatRequest 是发送到 completions endpoint 的负载。
type ChatRequest struct {
	Model       string    `json:"model"`
	Messages    []Message `json:"messages"`
	MaxTokens   int       `json:"max_tokens,omitempty"`
	Temperature float64   `json:"temperature,omitempty"`
}

// ChatResponse 是 API 的顶层响应。
type ChatResponse struct {
	ID      string   `json:"id"`
	Choices []Choice `json:"choices"`
	Usage   Usage    `json:"usage"`
}

// Choice 表示一个 completion 选项。
type Choice struct {
	Index        int     `json:"index"`
	Message      Message `json:"message"`
	FinishReason string  `json:"finish_reason"`
}

// Usage 记录 token 消耗情况。
type Usage struct {
	PromptTokens     int `json:"prompt_tokens"`
	CompletionTokens int `json:"completion_tokens"`
	TotalTokens      int `json:"total_tokens"`
}

// APIError 表示来自 LLM API 的错误响应。
type APIError struct {
	StatusCode int
	Body       string
}

func (e *APIError) Error() string {
	return fmt.Sprintf("llm: API returned status %d: %s", e.StatusCode, e.Body)
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
	httpClient  *http.Client
	baseURL     string
	apiKey      string
	model       string
	maxTokens   int
	temperature float64
}

// NewClient 根据给定配置创建 Client。
func NewClient(cfg ClientConfig) *Client {
	return &Client{
		httpClient:  &http.Client{Timeout: cfg.Timeout},
		baseURL:     cfg.BaseURL,
		apiKey:      cfg.APIKey,
		model:       cfg.Model,
		maxTokens:   cfg.MaxTokens,
		temperature: cfg.Temperature,
	}
}

// Complete 发送 chat completion 请求并返回 assistant 的
// 回复文本。它会使用客户端默认的 model/tokens/temperature。
func (c *Client) Complete(ctx context.Context, messages []Message) (string, error) {
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
	reqBody := ChatRequest{
		Model:       model,
		Messages:    messages,
		MaxTokens:   maxTokens,
		Temperature: temperature,
	}

	payload, err := json.Marshal(reqBody)
	if err != nil {
		return "", fmt.Errorf("llm: marshal request: %w", err)
	}

	endpoint := c.baseURL + "/chat/completions"
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewReader(payload))
	if err != nil {
		return "", fmt.Errorf("llm: build request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+c.apiKey)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("llm: send request: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", fmt.Errorf("llm: read response: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		return "", &APIError{
			StatusCode: resp.StatusCode,
			Body:       string(body),
		}
	}

	var chatResp ChatResponse
	if err := json.Unmarshal(body, &chatResp); err != nil {
		return "", fmt.Errorf("llm: parse response: %w", err)
	}

	if len(chatResp.Choices) == 0 {
		return "", fmt.Errorf("llm: response contained no choices")
	}

	return chatResp.Choices[0].Message.Content, nil
}
