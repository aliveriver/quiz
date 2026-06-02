# Ghost Relationship Test

一个前端 React + 后端 Go 的互动问卷/结局演出项目。前端负责问卷、Meta 演出、结局展示和无隐私设备信息采集；后端负责 LLM 独白生成、流式输出、可选 TTS 和接口限流。

## 技术栈

- 前端：React、Vite、YAML 配置
- 后端：Go、chi、OpenAI-compatible LLM API、可选 MiniMax TTS
- 部署：后端提供 Dockerfile，前端可用 Vite 构建静态资源

## 配置与密钥

- API Key 只能写在 `.env` 中，不要提交到代码仓库。
- 后端业务配置在 `backend/config.yaml`。
- 前端运行配置在 `frontend/config.yaml`。
- 后端 `.env` 可参考 `backend/.env.example`。

## 本地运行

后端：

```powershell
cd backend
copy .env.example .env
go run ./cmd/server
```

前端：

```powershell
cd frontend
npm install
npm run dev
```

默认前端地址为 `http://localhost:5173`，后端地址为 `http://localhost:8080`。

## 目录结构

- `frontend/src/components`：React UI 组件与演出组件。
- `frontend/src/core`：游戏状态、题目路由、配置、SSE、音频和设备探测等核心逻辑。
- `frontend/src/data`：题库数据。
- `frontend/src/styles`：全局样式变量。
- `backend/cmd/server`：后端启动入口。
- `backend/internal/config`：YAML 和 `.env` 配置加载。
- `backend/internal/handler`：HTTP 接口层。
- `backend/internal/service`：业务编排与 Prompt。
- `backend/internal/llm`：LLM 客户端封装。
- `backend/internal/tts`：TTS 客户端与文本切分。
- `backend/internal/middleware`：日志、CORS、限流。
- `backend/internal/metrics`：请求流指标。

## 隐私约束

前端只调用不需要用户显式授权、且不涉及精确隐私的浏览器能力。禁止在未说明用途并取得用户同意前调用精确地理位置接口。
