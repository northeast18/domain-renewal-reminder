# 完整部署指南

本指南帮助你从零开始部署爱自由域名管理服务到 Cloudflare。

---

## 部署架构

- **后端**: Cloudflare Workers（API 服务）
- **前端**: Cloudflare Pages（静态网站）
- **数据库**: Cloudflare D1（SQLite）
- **存储**: Cloudflare KV（键值对）

---

## 前置要求

- Node.js v18+
- Cloudflare 账号（免费）
- GitHub 账号

---

## 一、后端部署

### 1. 安装 Wrangler

```bash
npm install -g wrangler
wrangler login
```

### 2. 创建 D1 数据库

```bash
wrangler d1 create domain_renewal_db
```

复制输出的 `database_id`，更新 `wrangler.toml`：

```toml
[[d1_databases]]
binding = "DB"
database_name = "domain_renewal_db"
database_id = "你的database_id"
```

初始化数据库：

```bash
wrangler d1 execute domain_renewal_db --file=schema.sql
```

### 3. 创建 KV 命名空间

```bash
wrangler kv:namespace create "KV"
```

复制输出的 `id`，更新 `wrangler.toml`：

```toml
[[kv_namespaces]]
binding = "KV"
id = "你的KV_id"
```

### 4. 设置环境变量

生成加密密钥：

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

设置 Secrets：

```bash
wrangler secret put ADMIN_PASSWORD
# 输入管理员密码（至少16字符）

wrangler secret put ENCRYPTION_KEY
# 粘贴上面生成的密钥
```

### 5. 部署后端

```bash
npm install
npm run deploy
```

记录输出的 Worker URL，例如：`https://domain-renewal-reminder.xxx.workers.dev`

---

## 二、前端部署（Git 集成）

### 1. 推送代码到 GitHub

```bash
git add .
git commit -m "准备部署"
git push
```

### 2. 在 Cloudflare Pages 中设置

1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com)
2. 进入 **Workers & Pages** > **Create application** > **Pages** > **Connect to Git**
3. 选择你的 GitHub 仓库
4. 配置构建设置：
   - **Build command**: `npm run build`
   - **Build output directory**: `frontend/dist`
5. 添加环境变量（Production）：
   - **Variable name**: `VITE_API_URL`
   - **Value**: `https://你的worker地址.workers.dev/api`
6. 点击 **Save and Deploy**

### 3. 等待构建完成

构建完成后会得到前端 URL，例如：`https://xxx.pages.dev`

---

## 三、验证部署

### 测试后端

```bash
curl https://你的worker地址.workers.dev/api/health
```

### 测试前端

访问前端 URL，尝试注册和登录。

### 测试管理员

访问 `https://你的前端地址.pages.dev/admin`，使用管理员密码登录。

---

## 常见问题

### Q: 前端构建失败

**错误**: `Missing script: "build"`

**解决**: 确保根目录 `package.json` 中有：
```json
"scripts": {
  "build": "cd frontend && npm install && npm run build"
}
```

### Q: 前端无法连接后端

**解决**: 
1. 检查 Cloudflare Pages 环境变量 `VITE_API_URL` 是否正确
2. 确保 URL 以 `/api` 结尾
3. 重新部署前端

### Q: 管理员密码错误

**解决**:
```bash
wrangler secret put ADMIN_PASSWORD
# 重新输入密码
```

---

## 更新部署

### 更新后端

```bash
# 修改代码后
npm run deploy
```

### 更新前端

```bash
# 修改代码后
git add .
git commit -m "更新"
git push
# Cloudflare Pages 会自动构建和部署
```

---

## 自定义域名（可选）

### 后端自定义域名

1. Workers & Pages > 你的 Worker > Triggers > Custom Domains
2. 添加域名，如 `api.yourdomain.com`

### 前端自定义域名

1. Workers & Pages > 你的 Pages 项目 > Custom domains
2. 添加域名，如 `app.yourdomain.com`
3. 更新前端环境变量 `VITE_API_URL`

---

## 数据管理

### 备份数据库

```bash
wrangler d1 export domain_renewal_db --output=backup.sql
```

### 查询数据

```bash
wrangler d1 execute domain_renewal_db --command="SELECT COUNT(*) FROM users;"
```

### 查看日志

```bash
wrangler tail
```

---

完成！你的服务已成功部署。🎉
