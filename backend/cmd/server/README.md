# Server 入口模块

`cmd/server` 是 Go 后端启动入口，负责加载配置、组装依赖、注册路由并启动 HTTP Server。

## 修改指南

- 新增接口时在 `main.go` 注册 route，并把具体处理逻辑放到 `internal/handler`。
- 新增外部依赖时在入口组装，不要把配置读取散落到业务包。
- 生产环境通过 `CONFIG_PATH` 指定配置文件路径。
