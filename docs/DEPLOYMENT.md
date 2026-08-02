# 小白部署手册

## A. 创建 Supabase 项目

1. 打开 [Supabase](https://supabase.com)，使用 GitHub 登录。
2. 点击 `New project`，项目名填写 `workplan`。
3. 选择离你较近的区域，设置数据库密码并创建项目。
4. 进入 `SQL Editor`，新建查询，把 `supabase/schema.sql` 全部复制进去并执行。
5. 进入 `Project Settings` → `API`，复制 `Project URL` 和 `anon public key`。
6. 编辑仓库根目录的 `config.js`，填入：

```js
window.WORKPLAN_CONFIG = {
  SUPABASE_URL: "你的 Project URL",
  SUPABASE_ANON_KEY: "你的 anon public key",
  AI_FUNCTION_URL: "你的 Edge Function URL"
};
```

`anon public key` 可以出现在前端；`service_role key` 和 OpenAI API Key 不能出现在前端。

## B. 部署 AI 后端

在本机安装 Supabase CLI 后，在仓库根目录运行：

```bash
npx supabase login
npx supabase link --project-ref 你的项目 ID
npx supabase secrets set OPENAI_API_KEY=你的 OpenAI API Key
npx supabase secrets set OPENAI_BASE_URL=https://api.openai.com/v1
npx supabase secrets set OPENAI_MODEL=gpt-4.1-mini
npx supabase functions deploy ai-chat
```

如果使用 OpenAI 兼容服务，把 `OPENAI_BASE_URL` 改为服务商提供的 `/v1` 地址，并把 `OPENAI_MODEL` 改为该服务商实际支持的模型。例如：

```bash
npx supabase secrets set OPENAI_BASE_URL=https://你的服务商域名/v1
npx supabase secrets set OPENAI_MODEL=服务商支持的模型名
```

部署完成后，Edge Function URL 是：

```text
https://你的项目 ID.supabase.co/functions/v1/ai-chat
```

把这个 URL 填回 `config.js` 的 `AI_FUNCTION_URL`。

## C. 本地预览

仓库根目录运行：

```bash
python3 -m http.server 4173
```

浏览器访问 `http://127.0.0.1:4173/`。

## D. 发布到 GitHub Pages

```bash
git add .
git commit -m "build dynamic AI workbench"
git push origin main
```

在 GitHub 仓库进入 `Settings` → `Pages`，选择 `Deploy from a branch`、分支 `main`、目录 `/ (root)`，点击保存。

发布地址通常是：

```text
https://01sy.github.io/workplan/
```

## E. 首次使用

1. 打开网页。
2. 输入邮箱并点击登录。
3. 点击邮箱里的 Magic Link 返回工作台。
4. 如果当前账号还没有任务，页面会自动导入现有工作台任务。
5. 在 AI 工作台中输入“查一下我今天还有哪些任务”测试连接。

## 常见问题

- 页面显示“演示模式”：检查 `config.js` 是否填写，且文件名没有写成 `config.example.js`。
- AI 不能用：检查 Edge Function 是否部署、`AI_FUNCTION_URL` 是否正确、OpenAI API Key 是否配置为 Secret。
- 登录后没有任务：确认 `schema.sql` 已执行，并在浏览器刷新页面。
- 不要把 `OPENAI_API_KEY`、Supabase `service_role key` 提交到 GitHub。
