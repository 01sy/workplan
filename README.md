# Workplan

动态个人工作台：任务增删改查、周时间轴、进度统计和 AI 对话。

## 当前状态

- 前端入口：`index.html`
- 需求文档：`docs/REQUIREMENTS.md`
- 数据库迁移：`supabase/schema.sql`
- AI 后端：`supabase/functions/ai-chat/index.ts`
- 配置模板：`config.example.js`

## 快速部署

1. 在 Supabase 创建项目。
2. 在 Supabase SQL Editor 执行 `supabase/schema.sql`。
3. 复制 `config.example.js` 为 `config.js`，填写 Supabase URL、anon key 和 Edge Function URL。
4. 部署 `supabase/functions/ai-chat`，并配置 `SUPABASE_URL`、`SUPABASE_ANON_KEY`、`OPENAI_API_KEY`、`OPENAI_MODEL` Secrets。
5. 把 `index.html` 和 `config.js` 发布到 GitHub Pages。不要提交真实 `config.js` 到公开仓库。

详细步骤会在 `docs/REQUIREMENTS.md` 的基础上继续补充到部署手册。

