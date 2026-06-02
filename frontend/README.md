# Frontend

React + Vite 前端，负责问卷流程、Meta 视觉演出、结局展示、流式独白播放和前端 YAML 配置读取。

## 运行

```powershell
npm install
npm run dev
```

## 构建

```powershell
npm run build
```

## 配置

`config.yaml` 存放可公开的前端运行参数，例如题目数量、冲突提示和 Meta 特效概率。不要在前端配置或源码中写入任何 API Key。

## 目录

- `src/App.jsx`：应用流程编排。
- `src/components`：React UI 与演出组件。
- `src/core`：状态机、路由、SSE、音频、设备探测等核心逻辑。
- `src/data`：静态题库。
- `src/styles`：全局样式与变量。
