// tts_handler.go 已被移除。
// TTS 功能现在通过 stream.go 中的 StreamMonologueWithTTS 端点实现。
// 该端点将 LLM 流式文本和 MiniMax WebSocket TTS 音频合并为一个 SSE 流。
//
// 如果将来需要独立的 TTS REST 端点，可以基于 tts.Client 的
// NewSession API 重新实现。
package handler
