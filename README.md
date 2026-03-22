# 爱自由域名管理 / Domain Renewal Reminder Service

一个基于 Cloudflare Workers、D1、KV 和 React 的域名到期提醒系统。  
核心目标是让用户集中管理域名、提醒时间、邮箱通知和管理员配置，并尽量用免费套餐完成部署。

- 后端：Cloudflare Workers + Hono + D1 + KV
- 前端：React 19 + Vite + Tailwind CSS
- 邮件：支持 HTTP API 与 SMTP
- 定时任务：Cloudflare Cron

## 当前功能

- 用户注册、登录、邮箱验证
- 域名新增、编辑、删除、分组查看
- 可配置提醒开始日期、提醒次数、提醒邮箱
- 每天自动执行提醒检查
- 到期后 30 天内仍可继续提醒
- 管理员 SMTP / HTTP API 发信配置
- 管理员操作日志
- 发信记录查看
- 管理员手动触发一次提醒检查
- 隐藏式管理员入口
- 登录页、控制台、管理页响应式适配

## 提醒规则

当前提醒逻辑以实际代码为准，关键规则如下：

- Cron 配置在 [wrangler.toml](/D:/domain-renewal-reminder-main/wrangler.toml)，表达式是 `0 0 * * *`
- 这表示每天 `00:00 UTC` 执行一次，换算为中国时间是每天 `08:00`
- 当 `reminder_start_date <= 今天` 时，域名会进入提醒范围
- 当域名过期后，只要仍在 30 天宽限期内，且提醒次数未发满，系统仍会继续提醒
- 管理员在后台手动触发提醒检查时，不会消耗正式提醒次数
- 正式提醒次数只会在 cron 触发并且邮件发送被 SMTP / 邮件服务受理后递增

实现参考：

- [reminder.ts](/D:/domain-renewal-reminder-main/src/services/reminder.ts)
- [email.ts](/D:/domain-renewal-reminder-main/src/services/email.ts)

## 管理员入口

管理员入口默认隐藏，不会直接显示在登录页。

唤出方式：

1. 连续点击网站标题 3 次
2. 在非输入状态下连续按 `K` 3 次

管理员能力包括：

- 用户管理
- SMTP / HTTP API 配置
- 操作日志
- 发信记录
- 手动执行一次提醒检查

相关前后端文件：

- [Login.tsx](/D:/domain-renewal-reminder-main/frontend/src/pages/Login.tsx)
- [Admin.tsx](/D:/domain-renewal-reminder-main/frontend/src/pages/Admin.tsx)
- [admin.ts](/D:/domain-renewal-reminder-main/src/routes/admin.ts)

## 邮件能力

系统当前支持两种发信方式：

- HTTP API：如 Resend、SendGrid、Mailgun、自定义 API
- SMTP：支持 465 / 587，已补标准头、MIME 编码和更完整的 SMTP 握手处理

当前邮件能力包含：

- 注册验证邮件
- 重发验证邮件
- 域名到期提醒邮件
- 发信记录落库

相关文件：

- [email.ts](/D:/domain-renewal-reminder-main/src/services/email.ts)
- [auth.ts](/D:/domain-renewal-reminder-main/src/routes/auth.ts)
- [admin.ts](/D:/domain-renewal-reminder-main/src/services/admin.ts)

## 发信记录与手动测试

管理员后台现在支持两项排障能力：

- 查看最近发信记录
- 立即手动执行一次提醒检查

接口：

- `GET /api/admin/email-logs`
- `POST /api/admin/reminders/run`

说明：

- 手动执行会走正式提醒筛选逻辑
- 但手动执行不会增加 `reminders_sent`
- 发信记录会记录邮件类型、触发来源、收件人、状态和错误信息

## 数据库

当前主要表包括：

- `users`
- `domains`
- `admin_logs`
- `email_send_logs`

Schema 文件：

- [schema.sql](/D:/domain-renewal-reminder-main/schema.sql)

新增发信记录表的迁移文件：

- [0002_email_send_logs.sql](/D:/domain-renewal-reminder-main/migrations/0002_email_send_logs.sql)

## 部署与迁移

### 环境要求

- Node.js 18+
- npm
- Wrangler 4

### 本地安装

```bash
npm install
cd frontend
npm install
```

### 本地开发

后端：

```bash
npm run dev
```

前端：

```bash
cd frontend
npm run dev
```

### 生产部署

后端部署：

```bash
npx wrangler deploy
```

前端构建：

```bash
cd frontend
npm run build
```

### 重要：老库升级需要执行迁移

如果你的 D1 数据库不是新建的，而是旧环境升级到当前版本，除了更新代码和重新部署后端，还需要执行发信记录迁移：

```bash
npx wrangler d1 execute domain_renewal_db --remote --file=migrations/0002_email_send_logs.sql
```

否则：

- 发信记录功能不可用
- 管理员后台的邮件记录列表会缺表

## 项目结构

```text
domain-renewal-reminder/
├─ src/
│  ├─ index.ts
│  ├─ middleware/
│  ├─ routes/
│  ├─ services/
│  ├─ types/
│  └─ utils/
├─ frontend/
│  ├─ src/
│  │  ├─ api/
│  │  ├─ assets/
│  │  ├─ components/
│  │  ├─ contexts/
│  │  └─ pages/
│  └─ public/
├─ migrations/
├─ schema.sql
├─ wrangler.toml
└─ README.md
```

## API 概览

### 认证

- `POST /api/auth/register`
- `POST /api/auth/verify`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`
- `POST /api/auth/resend-verification`

### 域名

- `POST /api/domains`
- `GET /api/domains`
- `GET /api/domains/grouped`
- `PUT /api/domains/:id`
- `DELETE /api/domains/:id`

### 管理员

- `GET /api/admin/users`
- `POST /api/admin/users/:id/blacklist`
- `DELETE /api/admin/users/:id`
- `POST /api/admin/smtp`
- `GET /api/admin/smtp`
- `GET /api/admin/logs`
- `GET /api/admin/email-logs`
- `POST /api/admin/reminders/run`

## 当前已知但非阻塞的问题

- 前端仍有一个 Vite 警告：`frontend/src/api/client.ts` 同时被静态和动态导入
- README 之外的部分历史文档还没有全部同步到最新功能状态
- 邮件模板与投递已可用，但如果更换 SMTP 服务商，仍建议再次做真实收件测试

## 建议的运维检查项

- 确认 `ADMIN_PASSWORD` 与 `ENCRYPTION_KEY` 已配置
- 确认 D1 / KV 绑定已生效
- 确认 cron 已部署成功
- 确认 SMTP 或 HTTP API 发信配置可用
- 生产升级时确认迁移是否已执行
- 用真实邮箱验证注册邮件和提醒邮件都能收到

## License

MIT
