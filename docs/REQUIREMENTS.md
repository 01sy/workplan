# Workplan 动态 AI 工作台需求文档

## 1. 项目目标

将现有静态工作台升级为一个可上线的个人工作系统：任务数据存储在云端，支持多设备访问；网页提供任务增删改查、时间轴、进度统计和每日复盘；AI 通过自然语言调用受控工具完成任务操作。

本期默认范围为单用户个人工作台，数据库结构保留 `user_id`，为后续多人协作和权限扩展留出空间。

## 2. 默认技术方案

- 前端：单页 HTML/CSS/JavaScript，部署到 GitHub Pages。
- 数据库与登录：Supabase Auth + Supabase Postgres。
- AI 后端：Supabase Edge Function `ai-chat` 调用 OpenAI Responses API。
- 任务数据：迁移现有工作台 26 条任务，包括工作任务和生活安排。
- AI 密钥：只配置在 Supabase Edge Function Secrets，不进入 GitHub 仓库或浏览器。
- 浏览器端密钥：只使用 Supabase anon key，并依赖 RLS 做数据隔离。

## 3. 用户故事

### 3.1 任务管理

- 我可以创建任务，填写标题、负责人、状态、优先级、类别、开始时间、预计完成时间、最新进展和完成标准。
- 我可以查询今天、本周、逾期、某个执行人或某个状态的任务。
- 我可以修改任务标题、进度、优先级、时间、最新进展和完成标准。
- 我可以标记任务完成，自动写入实际完成时间。
- 我可以删除任务。删除默认为软删除，并写入操作日志。
- 我可以在手机和电脑上看到同一份任务数据。

### 3.2 AI 对话

用户可以在网页聊天框中输入自然语言，例如：

- “新增一个任务，今天完成一期新文案，负责人是舒义。”
- “把 AI 配乐视频改成进行中，最新进展是已经完成粗剪。”
- “查一下我今天还有哪些没完成的任务。”
- “列出本周已经逾期的任务。”
- “总结今天做得好的地方，并给我 3 个下一步。”
- “删除刚才新增的错误任务。”

AI 不直接生成 SQL，而是调用服务端提供的固定工具。删除、批量修改、调整重要任务截止日期必须先向用户确认。

### 3.3 时间轴与复盘

- 时间轴按周一到周日展示任务。
- 工作任务和生活安排使用不同视觉标识。
- 待开始按 0%、进行中按 50%、已完成按 100% 展示粗略进度。
- 逾期任务单独标红。
- 首页显示已完成、进行中、待开始、逾期/待确认数量。
- AI 可以根据当前用户任务生成每日复盘和 1-3 个下一步。

## 4. 数据模型

### 4.1 tasks

| 字段 | 类型 | 说明 |
|---|---|---|
| id | uuid | 任务 ID |
| user_id | uuid | 所属用户 |
| title | text | 任务标题，必填 |
| description | text | 任务说明 |
| owner_name | text | 执行人 |
| status | text | 待开始、进行中、已停滞、已完成 |
| priority | text | 重要紧急、重要不紧急、紧急不重要、不紧急不重要 |
| category | text | work 或 personal |
| start_at | timestamptz | 开始时间 |
| due_at | timestamptz | 预计完成时间 |
| completed_at | timestamptz | 实际完成时间 |
| latest_update | text | 最新进展 |
| completion_criteria | text | 完成标准 |
| source_record_id | text | 原 `.base` 记录 ID，便于迁移追溯 |
| archived_at | timestamptz | 软删除时间 |
| created_at / updated_at | timestamptz | 系统时间 |

### 4.2 chat_messages

保存用户和 AI 的聊天消息，便于恢复上下文和生成复盘。

### 4.3 audit_logs

记录新增、修改、完成、删除等任务操作的前后数据，便于误操作恢复和问题排查。

## 5. AI 工具协议

Edge Function 只向模型暴露以下工具：

- `list_tasks(filters)`：按日期、状态、执行人、类别和关键词查询。
- `get_task(task_id)`：读取单条任务。
- `create_task(task)`：新增任务。
- `update_task(task_id, patch)`：修改允许字段。
- `complete_task(task_id)`：标记完成。
- `delete_task(task_id, confirmed)`：软删除；`confirmed` 必须为 true。
- `today_summary()`：读取今天任务和逾期任务，交由模型生成复盘。

所有工具执行前必须验证当前登录用户；所有查询自动附带当前用户过滤；删除不允许物理删除。

## 6. 权限和安全

- GitHub Pages 不保存 OpenAI API Key。
- Supabase 所有业务表开启 Row Level Security。
- 普通用户只能读取、修改、删除自己的任务和聊天记录。
- Supabase service role key 只允许作为 Edge Function Secret 使用。
- 前端只使用 anon key。
- 删除、批量修改和大范围日期调整必须二次确认。
- AI 请求和工具执行需要记录审计日志。
- 聊天输入、任务字段和工具参数都要做长度及类型校验。

## 7. 部署验收标准

1. GitHub Pages 可直接打开首页。
2. 未配置 Supabase 时，页面以演示数据运行，不暴露密钥。
3. 配置 Supabase 后，用户可以通过邮箱 Magic Link 登录。
4. 登录后可以新增、查询、修改、完成和软删除任务。
5. 刷新页面后数据仍然存在，另一台设备登录后能看到相同数据。
6. AI 可以完成查询、新增、修改、完成和每日总结。
7. 删除任务会要求确认，且不会直接物理删除。
8. 手机宽度 390px 下无横向溢出。
9. 浏览器控制台无未处理错误。
10. GitHub 仓库中不存在 OpenAI API Key、Supabase service role key 或真实配置文件。

## 8. 未纳入本期

- 多人团队权限管理。
- 文件上传和视频素材管理。
- 自动读取飞书/Base 实时数据。
- 邮件、短信、微信或浏览器推送提醒。
- 自动执行外部平台发布操作。

