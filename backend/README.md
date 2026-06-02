# Backend

Go 后端，提供游戏配置、独白生成、质问生成、SSE 流式独白和可选 TTS 接口。

## 运行

```powershell
copy .env.example .env
go run ./cmd/server
```

## 配置

- `config.yaml`：端口、超时、CORS、模型、TTS、限流和游戏参数。
- `.env`：API Key 与服务端点，禁止提交。
- `CONFIG_PATH`：可选环境变量，用于指定配置文件路径。

## Docker

```powershell
docker build -t ghost-backend .
docker run --env-file .env -p 8080:8080 ghost-backend
```

如需修改容器内部监听端口，可设置 `SERVER_PORT`：

```powershell
docker run --env-file .env -e SERVER_PORT=9000 -p 9000:9000 ghost-backend
```

## 目录

- `cmd/server`：启动入口和路由注册。
- `internal/config`：配置加载。
- `internal/handler`：HTTP/SSE 接口层。
- `internal/service`：业务编排和 Prompt。
- `internal/llm`：LLM 客户端。
- `internal/tts`：TTS 客户端。
- `internal/middleware`：日志、CORS、限流。
- `internal/metrics`：运行指标。
