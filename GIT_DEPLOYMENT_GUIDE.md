# Git 集成自动部署

推送代码到 GitHub 后自动构建和部署前端。

---

## 前提条件

- ✅ 后端已部署（参考 [完整部署指南](DEPLOYMENT_GUIDE.md)）
- ✅ 代码已推送到 GitHub

---

## 设置步骤

### 1. 创建 Pages 项目

1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com)
2. **Workers & Pages** > **Create application** > **Pages**
3. 点击 **Connect to Git**

### 2. 连接 GitHub

1. 选择 **GitHub**
2. 授权 Cloudflare 访问
3. 选择你的仓库
4. 点击 **Begin setup**

### 3. 配置构建

**基本设置：**
```
Project name: domain-renewal-reminder
Production branch: main
```

**构建设置：**
```
Build command: npm run build
Build output directory: frontend/dist
```

**环境变量（重要）：**
- 点击 **Add variable**
- Variable name: `VITE_API_URL`
- Value: `https://你的worker地址.workers.dev/api`
- Environment: **Production**

### 4. 部署

点击 **Save and Deploy**，等待构建完成。

---

## 日常使用

修改代码后：

```bash
git add .
git commit -m "更新说明"
git push
```

Cloudflare Pages 会自动构建和部署，无需手动操作。

---

## 管理部署

### 查看部署历史

Dashboard > 你的 Pages 项目 > **Deployments**

### 回滚版本

找到要回滚的部署 > **...** > **Rollback to this deployment**

### 修改环境变量

**Settings** > **Environment variables** > 修改后需要重新部署

### 分支预览

推送到其他分支会自动创建预览部署：

```bash
git checkout -b feature/new-feature
git push origin feature/new-feature
```

预览 URL: `https://feature-new-feature.xxx.pages.dev`

---

## 故障排查

### 构建失败

查看构建日志：点击失败的部署 > **View build log**

常见问题：
- 缺少 `build` 脚本 → 检查根目录 `package.json`
- 环境变量未设置 → 检查 **Environment variables**

### 前端无法连接后端

1. 检查 `VITE_API_URL` 是否正确
2. 确保 URL 以 `/api` 结尾
3. 触发重新部署

---

完成！现在每次推送代码都会自动部署。🎉
