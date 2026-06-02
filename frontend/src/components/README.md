# Components 模块

`components` 存放 React 展示组件。每个子目录对应一个独立 UI/演出模块，并配套同名 CSS。

## 修改指南

- 组件只接收 props 和回调，业务状态尽量放在 `App.jsx` 或 `src/core`。
- 新增组件时创建独立目录，例如 `Example/Example.jsx` 和 `Example/Example.css`。
- 演出组件需要注意移动端布局，避免固定尺寸文字溢出。
- 不再使用 Vue 单文件组件；当前前端统一为 React。
