# Config 模块

`config` 负责读取 `config.yaml`，并从 `.env`/环境变量注入 API Key、Base URL 等敏感配置。

## 修改指南

- 新增非敏感配置：扩展配置结构体并写入 `backend/config.yaml`。
- 新增敏感配置：只从环境变量读取，字段使用 `yaml:"-"`。
- 修改后同步更新 `backend/.env.example` 和根目录 README。
