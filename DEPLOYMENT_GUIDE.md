# 完整部署指南

本指南覆盖这个项目的完整生产部署流程，包括：

- Cloudflare Worker 后端
- Cloudflare D1 数据库
- Cloudflare KV
- Cloudflare Pages 前端
- 邮件服务配置
- AI 智能导入所需的智谱国际版环境变量
- 已有生产库的迁移升级流程

适用项目目录：`domain-renewal-reminder`

---

## 部署架构

- 后端：Cloudflare Workers
- 前端：Cloudflare Pages
- 数据库：Cloudflare D1
- 会话与临时数据：Cloudflare KV
- 定时任务：Cloudflare Cron Triggers
- AI 识别：智谱国际版 `https://api.z.ai/api/paas/v4/chat/completions`

---

## 前置要求

- Node.js 18 或更高版本
- npm
- Cloudflare 账号
- GitHub 仓库
- 项目代码已在本地可用

建议在项目根目录优先使用本地 Wrangler：

```bash
npm install
npx wrangler --version
```

当前项目使用的 Wrangler 版本建议为 `4.x`。

---

## 一、首次后端部署

### 1. 登录 Cloudflare

```bash
npx wrangler login
```

### 2. 创建 D1 数据库

```bash
npx wrangler d1 create domain_renewal_db
```

把命令输出中的 `database_id` 写入 [wrangler.toml](./wrangler.toml)：

```toml
[[d1_databases]]
binding = "DB"
database_name = "domain_renewal_db"
database_id = "你的 database_id"
```

### 3. 创建 KV 命名空间

```bash
npx wrangler kv namespace create KV
```

把输出中的 `id` 写入 [wrangler.toml](./wrangler.toml)：

```toml
[[kv_namespaces]]
binding = "KV"
id = "你的 KV id"
```

### 4. 初始化数据库

新建数据库时，直接执行完整表结构：

```bash
npx wrangler d1 execute domain_renewal_db --remote --file=schema.sql
```

Cloudflare D1 官方文档说明 `wrangler d1 execute` 必须使用 `--command` 或 `--file`，而 `--remote` 会直接对远程数据库执行操作。

### 5. 设置 Worker Secrets

生成 32 字节十六进制加密密钥：

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

设置必须的 secrets：

```bash
npx wrangler secret put ADMIN_PASSWORD
npx wrangler secret put ENCRYPTION_KEY
npx wrangler secret put ZAI_API_KEY
```

说明：

- `ADMIN_PASSWORD`：管理员入口密码
- `ENCRYPTION_KEY`：用于加密 SMTP/API 密钥等敏感数据
- `ZAI_API_KEY`：智谱国际版 API Key，用于图片和文字智能导入

Cloudflare 官方文档说明，`wrangler secret put` 会创建一个新的 Worker 版本并立即部署。

### 6. 设置可选 Worker Vars

AI 智能导入默认已经内置以下值，不配也能工作：

- `ZAI_BASE_URL=https://api.z.ai/api/paas/v4`
- `ZAI_VISION_MODEL=GLM-4.6V-Flash`

如果你要显式覆盖，可以在 Cloudflare Dashboard 里为 Worker 添加环境变量，或者在 `wrangler.toml` 中加入：

```toml
[vars]
ZAI_BASE_URL = "https://api.z.ai/api/paas/v4"
ZAI_VISION_MODEL = "GLM-4.6V-Flash"
```

### 7. 部署后端 Worker

```bash
npm run deploy
```

部署成功后，记录 Worker 地址，例如：

```text
https://domain-renewal-reminder.xxx.workers.dev
```

### 8. 验证后端

```bash
curl https://你的-worker.workers.dev/api/health
```

正常情况下应返回 `success: true`。

---

## 二、前端部署到 Cloudflare Pages

### 1. 推送代码到 GitHub

```bash
git add .
git commit -m "prepare deployment"
git push
```

### 2. 创建 Pages 项目

1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. 进入 `Workers & Pages`
3. 点击 `Create application`
4. 选择 `Pages`
5. 选择 `Connect to Git`
6. 连接你的 GitHub 仓库

### 3. 配置构建

这个仓库的前端位于 `frontend/`，但根目录已经提供了构建脚本，因此推荐直接使用：

- Framework preset：`None` 或 `Vite`
- Build command：`npm run build`
- Build output directory：`frontend/dist`
- Root directory：留空

如果你更喜欢显式写法，也可以使用：

- Build command：`cd frontend && npm install && npm run build`
- Build output directory：`frontend/dist`

Cloudflare Pages 官方文档说明，Pages 通过 Build command 的退出码判断构建是否成功。

### 4. 配置 Pages 环境变量

在 Pages 项目的 Production 环境添加：

```text
VITE_API_URL=https://你的-worker.workers.dev/api
```

要求：

- 必须以 `/api` 结尾
- 不要带尾部斜杠

### 5. 部署并验证前端

保存后触发首次部署。成功后会得到 Pages 地址，例如：

```text
https://domain-renewal-reminder.pages.dev
```

检查：

- 登录页可打开
- 注册与登录正常
- `/verify` 路由可访问
- 仪表盘中的“批量导入 / AI 识别”弹窗可打开

---

## 三、配置邮件服务

部署完成后，需要先配置邮件服务，注册验证和到期提醒才会真正发出。

### 1. 打开管理员面板

访问：

```text
https://你的-pages-域名/admin
```

使用 `ADMIN_PASSWORD` 登录。

### 2. 推荐方式：HTTP API

支持：

- Resend
- SendGrid
- Mailgun
- 自定义 HTTP API

如果你只是个人使用，优先推荐 Resend。

### 3. 高级方式：SMTP

支持：

- 465
- 587

不支持：

- 25

更多配置细节见 [EMAIL_SETUP.md](./EMAIL_SETUP.md)。

---

## 四、AI 智能导入配置说明

当前 AI 导入功能包括：

- 粘贴文字识别
- 图片截图识别
- AI 识别历史
- 文字识别失败重试
- 常见注册商续费入口自动补全

必须配置：

```bash
npx wrangler secret put ZAI_API_KEY
```

可选配置：

```text
ZAI_BASE_URL=https://api.z.ai/api/paas/v4
ZAI_VISION_MODEL=GLM-4.6V-Flash
```

当前实现默认不会长期保存原始图片，历史中只保存：

- 识别摘要
- 草稿结果
- 警告信息
- 错误信息

---

## 五、已有生产库升级流程

如果你的数据库不是全新创建的，不要重复执行 `schema.sql`。应按迁移文件顺序升级。

### 升级命令

```bash
npx wrangler d1 execute domain_renewal_db --remote --file=migrations/0002_email_send_logs.sql
npx wrangler d1 execute domain_renewal_db --remote --file=migrations/0003_domain_status_workflow.sql
npx wrangler d1 execute domain_renewal_db --remote --file=migrations/0004_domain_workflow_fields.sql
npx wrangler d1 execute domain_renewal_db --remote --file=migrations/0005_ai_import_history.sql
```

迁移说明：

- `0002_email_send_logs.sql`：邮件发送记录表
- `0003_domain_status_workflow.sql`：域名状态字段与续费闭环字段
- `0004_domain_workflow_fields.sql`：负责人与处理时间字段
- `0005_ai_import_history.sql`：AI 导入历史、失败重试、导入状态跟踪

### 建议的升级后校验

```bash
npx wrangler d1 execute domain_renewal_db --remote --command="SELECT name FROM sqlite_master WHERE type='table' AND name='ai_import_history';"
npx wrangler d1 execute domain_renewal_db --remote --command="PRAGMA table_info(ai_import_history);"
```

---

## 六、部署后检查清单

后端：

- `GET /api/health` 正常
- Cron 仍存在
- D1 与 KV 绑定正常

前端：

- 登录、注册、验证页正常
- 域名新增、编辑、批量导入正常
- AI 识别弹窗可打开
- AI 历史列表可展示

邮件：

- 注册验证邮件可发出
- 管理员面板可保存邮件配置

AI：

- 文字识别可返回草稿
- 图片识别可返回草稿
- 历史记录可载入
- 文字失败记录可重试

---

## 七、日常更新流程

### 仅更新后端代码

```bash
npm run deploy
```

### 更新 Worker secrets

```bash
npx wrangler secret put ADMIN_PASSWORD
npx wrangler secret put ENCRYPTION_KEY
npx wrangler secret put ZAI_API_KEY
```

### 更新数据库结构

新增迁移文件后，执行：

```bash
npx wrangler d1 execute domain_renewal_db --remote --file=migrations/你的新迁移.sql
```

### 更新前端代码

```bash
git add .
git commit -m "update frontend"
git push
```

如果 Pages 连接了 GitHub，推送后会自动重新构建。

---

## 八、自定义域名

### Worker 自定义域名

在 Cloudflare Dashboard 中：

1. 进入 Worker
2. 打开 `Triggers`
3. 添加自定义域名，例如 `api.example.com`

### Pages 自定义域名

在 Pages 项目中：

1. 打开 `Custom domains`
2. 添加域名，例如 `app.example.com`
3. 完成 DNS 配置
4. 更新 Pages 的 `VITE_API_URL`
5. 重新部署 Pages

---

## 九、常用运维命令

查看 Worker 日志：

```bash
npx wrangler tail
```

导出远程数据库：

```bash
npx wrangler d1 export domain_renewal_db --remote --output=backup.sql
```

查看用户数量：

```bash
npx wrangler d1 execute domain_renewal_db --remote --command="SELECT COUNT(*) AS count FROM users;"
```

查看域名数量：

```bash
npx wrangler d1 execute domain_renewal_db --remote --command="SELECT COUNT(*) AS count FROM domains;"
```

---

## 十、常见问题

### 1. 前端无法连接后端

检查：

- `VITE_API_URL` 是否正确
- 是否以 `/api` 结尾
- 是否忘记重新部署 Pages

### 2. 收不到验证邮件

检查：

- 管理员面板是否保存了邮件配置
- 发件服务商账号是否可用
- 垃圾邮件箱
- Worker 日志 `npx wrangler tail`

### 3. AI 识别不可用

检查：

- `ZAI_API_KEY` 是否已设置
- Worker 是否为最新版本
- 是否能从 Worker 网络环境访问 `https://api.z.ai`

### 4. D1 迁移失败

检查：

- 是否用了错误的数据库名
- 是否忘记加 `--remote`
- 当前 Cloudflare 登录账号是否有该数据库权限

### 5. 更新 secret 后功能仍旧异常

Cloudflare 文档说明 `wrangler secret put` 会立即创建并部署新版本。若仍异常，建议再执行一次：

```bash
npm run deploy
```

---

部署完成后，建议第一时间手动测试以下流程：

1. 注册并验证一个测试账号
2. 新增一个域名
3. 试一次 CSV 导入
4. 试一次 AI 图片或文字导入
5. 在管理员面板保存邮件配置
