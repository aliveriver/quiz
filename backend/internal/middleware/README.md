# Middleware 模块

`middleware` 存放全局 HTTP 中间件，包括日志、CORS 和限流。

## 修改指南

- 新增中间件时保持 `func(http.Handler) http.Handler` 风格。
- 需要配置的中间件通过构造函数接收配置，不直接读取环境变量。
- 中间件注册顺序在 `cmd/server/main.go` 中维护。
