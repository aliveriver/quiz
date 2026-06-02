# Data 模块

`data` 存放前端静态数据，目前主要是问卷题库 `questions.json`。

## 修改指南

- 新增题目时保持字段结构一致，尤其是 `_id`、`question`、`options`、`effects` 和 `attitude_tag`。
- 调整题目数量不需要改题库文件，优先修改 `frontend/config.yaml` 的 `game.questions_per_round`。
- 如果新增题型，需要同步修改 `core/questionPool.js` 和 `components/Quiz`。
