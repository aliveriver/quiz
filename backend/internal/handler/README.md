# Handler 模块

`handler` 是 HTTP 接口层，负责请求解析、基础校验、调用 service，并返回 JSON 或 SSE。

## 修改指南

- 新增 JSON 接口：在 `handler.go` 新增方法，复用 `writeJSON` 和 `writeError`。
- 新增流式接口：参考 `stream.go`，注意 flush 和错误事件格式。
- 复杂业务逻辑不要放在 handler 中，放到 `internal/service`。
