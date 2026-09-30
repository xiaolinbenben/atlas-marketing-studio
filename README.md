# Atlas Marketing Studio

Atlas Marketing Studio 是一个自托管的 AI 电商广告工作室。用户使用支付宝登录，用支付宝电脑网站一键购买积分；管理员在后台配置域名、支付宝、OpenAI 兼容接口、Seedance 2.0 和 S3/MinIO。

## 功能

- UGC 产品广告、参考广告复刻、AI 短剧和广告小剧场。
- 文本与提示词扩写使用 OpenAI Chat Completions 格式接口。
- 图片生成与编辑使用 GPT-image-2。
- 文生视频、图生视频、参考视频、视频编辑、动作迁移以及对白、配音和音效使用 Seedance 2.0。
- 参考广告每个任务只提交一次 Seedance，提示词、对白、配音和音效在同一次视频生成中完成。
- SQLite 积分账户、套餐、订单和流水；异步失败只退款一次。
- S3 兼容媒体存储，应用媒体路由支持预签名输入和视频 Range 读取。
- Docker 单容器监听 `3000`，SQLite 目录使用卷持久化。

## 启动

```bash
cp .env.example deploy/.env
# 编辑 deploy/.env，设置 NEXTAUTH_SECRET
docker compose -f deploy/docker-compose.yml up -d
docker compose -f deploy/docker-compose.yml logs -f app
```

打开 `http://your-domain/install`，直接创建管理员账号和密码，然后访问 `/admin/login` 和 `/admin/settings` 完成配置。安装向导只开放一次。

本地开发与生产部署使用相同的环境配置，只需要填写密钥：

```bash
cp .env.example .env
# 编辑 .env，为 NEXTAUTH_SECRET 填入随机密钥
npm run dev
```

`npm run dev` 会为本地开发固定使用 `prisma/dev.db`，并自动执行已提交的 Prisma migrations。公开域名在安装后的管理端配置，不需要 `NEXTAUTH_URL`。

## 管理端配置

管理端字段包括：

- 公开域名；支付宝 APPID、网关地址、应用私钥、支付宝公钥。
- OpenAI 兼容接口地址和 Key；脚本模型与 GPT-image-2 模型 ID 内置在代码中。
- Seedance 地址和 Key；普通版/Fast 版模型 ID 内置在代码中，由用户在生成页面选择。
- S3/MinIO Endpoint、Region、Bucket、Access Key、Secret Key、S3 Public URL。
- 注册赠送积分、积分套餐和视频模型/分辨率的每秒积分规则。

密钥使用 `NEXTAUTH_SECRET` 派生的 AES-GCM 密钥加密，接口只返回配置状态和掩码。

## 测试

```bash
npx tsc --noEmit
npm test
DATABASE_URL="file:./dev.db" NEXTAUTH_SECRET="build-secret" npm run build
```

数据库迁移位于 `prisma/migrations`。本地开发和生产容器启动时都会自动执行 `prisma migrate deploy`。
