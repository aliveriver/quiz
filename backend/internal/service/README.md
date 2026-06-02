# Service 模块

`service` 存放核心业务编排，包括结局独白生成、质问生成、Prompt 组织和 TTS 流程。

## 修改指南

- 新增 Prompt：优先放在 `ending_prompts.go`，保持文本和流程代码分离。
- 新增业务流程：封装为独立 service 方法，由 handler 调用。
- 调用 LLM/TTS 时使用 `internal/llm` 和 `internal/tts` 的客户端封装。
