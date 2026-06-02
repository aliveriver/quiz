# Core 模块

`core` 存放前端非 UI 逻辑，包括状态机、题目抽取、结局路由、运行时配置、设备探测、SSE 解析和音频播放。

## 修改指南

- 新增游戏数值维度：先改 `stateMachine.js`，再同步 `endingRouter.js` 和后端 profile 校验。
- 新增结局路由：修改 `endingRouter.js`，并在 `components/Ending` 中增加对应展示。
- 新增题目来源：优先扩展 `questionPool.js`，题目数据继续放在 `src/data`。
- 新增浏览器探测：只在 `deviceProbe.js` 中调用不需要显式授权的 navigator/screen 接口。
- 新增流式事件类型：修改 `sse.js` 的解析消费方，不要把解析逻辑散落到组件中。
