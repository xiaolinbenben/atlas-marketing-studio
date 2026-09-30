# 部署

应用是一个监听 `3000` 的 Next.js 单体容器，SQLite 文件挂载在 `/app/data`。网关（Nginx、Caddy 或云负载均衡）只需要把公开域名反向代理到容器即可。

## Docker Compose

```bash
cp .env.example deploy/.env
# 在 deploy/.env 中设置 NEXTAUTH_SECRET
docker compose -f deploy/docker-compose.yml up -d
docker compose -f deploy/docker-compose.yml logs -f app
```

打开 `/install` 创建管理员账号和密码。安装完成后 `/install` 永久关闭。管理员从 `/admin/login` 登录，在 `/admin/settings` 设置公开域名、支付宝、OpenAI 兼容接口、Seedance 2.0、S3/MinIO、套餐和视频积分规则。GPT-image-2 复用 OpenAI 配置；模型 ID 以及 Seedance 普通/Fast 模型 ID 内置在代码中。

Compose 不启动数据库或 MinIO 服务。SQLite 使用 `atlas-data` 卷持久化，S3/MinIO 通过管理端填写外部 Endpoint、Region、Bucket、Access Key、Secret Key 和 Path-style 开关。

## CI 部署

推送 `main` 时，`.github/workflows/deploy.yml` 构建整个应用镜像并推到 GHCR，然后用 SSH 密码登录服务器，把 `deploy/docker-compose.yml` 上传到 `/opt/terln-studio/deploy`，再拉取该镜像并 `docker compose up`。

服务器上的环境变量放在 `/opt/terln-studio/deploy/.env`，工作流不会覆盖这个文件。登录只使用密码，不使用 SSH 密钥。

在仓库 Settings → Secrets and variables → Actions 配置：

| 类型 | 名称 | 说明 |
| --- | --- | --- |
| Variable | `DEPLOY_HOST` | 服务器 IP，必填 |
| Variable | `DEPLOY_USER` | SSH 用户名，可选，默认 `root` |
| Secret | `DEPLOY_PASSWORD` | SSH 密码 |
| Secret | `GHCR_PAT` | GitHub PAT，用于推送和在服务器上拉取镜像 |

`GHCR_PAT` 使用仓库所有者账号创建。classic PAT 需要 `write:packages`；仓库是私有的时候还要 `repo`。服务器需要已安装 Docker 和 Docker Compose 插件，并且可以访问 `ghcr.io`。

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
