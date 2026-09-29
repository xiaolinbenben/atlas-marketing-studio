# 部署

应用是一个监听 `3000` 的 Next.js 单体容器，SQLite 文件挂载在 `/app/data`。网关（Nginx、Caddy 或云负载均衡）只需要把公开域名反向代理到容器即可。

## Docker Compose

```bash
cp .env.example .env
# 在 .env 中设置 NEXTAUTH_SECRET
docker compose up -d --build
docker compose logs -f app
```

打开 `/install` 创建管理员账号和密码。安装完成后 `/install` 永久关闭。管理员从 `/admin/login` 登录，在 `/admin/settings` 设置公开域名、支付宝、OpenAI 兼容接口、Seedance 2.0、S3/MinIO、套餐和视频积分规则。GPT-image-2 复用 OpenAI 配置；模型 ID 以及 Seedance 普通/Fast 模型 ID 内置在代码中。

Compose 不启动数据库或 MinIO 服务。SQLite 使用 `atlas-data` 卷持久化，S3/MinIO 通过管理端填写外部 Endpoint、Region、Bucket、Access Key、Secret Key 和 Path-style 开关。

## 反向代理

代理到 `http://127.0.0.1:3000`，并转发 `Host`、`X-Forwarded-Host` 和 `X-Forwarded-Proto`。管理端保存的公开域名用于支付宝回调和生成供应商可访问的媒体地址。

## 本地开发

```bash
cp .env.example .env
# 编辑 .env，为 NEXTAUTH_SECRET 填入随机密钥
npm run dev
```

本地开发与生产部署都只需要在 `.env` 中配置 `NEXTAUTH_SECRET`。`npm run dev` 会固定使用 `prisma/dev.db` 并自动执行 `prisma migrate deploy`；生产 Compose 会固定使用 `/app/data/atlas.db`。公开域名在安装后的管理端配置，不需要 `NEXTAUTH_URL`。

数据库结构由 `prisma/migrations` 管理。容器入口同样执行 `prisma migrate deploy`，不要删除已有 SQLite 文件。
