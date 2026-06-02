# TTS 模块

## 功能

本模块封装 MiniMax WebSocket TTS，用于把 LLM 流式生成的结局独白实时转成语音。

后端负责连接 MiniMax，因此 `TTS_API_KEY` 只存在于服务端 `.env`，不会暴露给前端。

## 文件

```text
tts/
├── client.go     # MiniMax WebSocket TTS 客户端
├── splitter.go   # LLM 文本流断句器
└── README.md     # 模块说明
```

## 流程

1. `Client.NewSession` 连接 `wss://api.minimaxi.com/ws/v1/t2a_v2`。
2. 后端发送 `task_start`，等待 MiniMax 返回 `task_started`。
3. LLM 每生成一段文本，`SentenceSplitter` 按句子切片。
4. 每个句子通过 `task_continue` 发给 MiniMax。
5. MiniMax 返回 hex 编码音频，后端解码后通过 SSE `audio` 事件推给前端。
6. LLM 完成后发送 `task_finish`，等待 `task_finished`。

## 配置

`backend/config.yaml`:

```yaml
tts:
  model: "speech-02-hd"
  voice: "female-shaonv"
  format: "mp3"
  speed: 1.0
  vol: 1.0
  pitch: 0
  sample_rate: 32000
  bitrate: 128000
```

`.env`:

```env
TTS_API_KEY=your-minimax-api-key
# 可选，默认 wss://api.minimaxi.com/ws/v1/t2a_v2
TTS_WS_URL=wss://api.minimaxi.com/ws/v1/t2a_v2
```

## 修改方式

更换模型或音色：修改 `config.yaml` 中的 `tts.model` 和 `tts.voice`。

调整语速、音量、音调：修改 `tts.speed`、`tts.vol`、`tts.pitch`。

新增请求字段：优先在 `client.go` 中扩展 `taskStartEvent` 或 `voiceSetting`，保持 MiniMax 协议结构和 Go struct 对齐。
