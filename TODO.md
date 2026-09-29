# Atlas Marketing Studio 二开 TODO

- [x] 支付方式改为支付宝，登录方式改为支付宝登录
- [x] 增加管理端：域名、支付宝、供应商、套餐和视频积分规则
- [x] 供应商适配器统一到 OpenAI 兼容接口、GPT-image-2 和 Seedance 2.0
- [x] 移除 Vercel 与 Cloudflare 部署分支，新增 Docker 单容器部署
- [x] 使用 SQLite，数据库文件通过 Docker volume 持久化
- [x] 支付宝配置 APPID、网关地址、应用私钥和支付宝公钥，回调地址由后台域名生成
- [x] 移除用户自定义 API Key/BYOK 功能
- [x] 安装向导简化为首次创建管理员账号和密码，移除一次性安装令牌
- [x] GPT 默认模型统一为 `gpt-5.6-sol`
- [x] 参考广告每个视频任务只提交一次 Seedance，单次生成包含提示词、对白、配音和音效
- [x] 视频积分按人民币业务规则配置，不再使用美元成本变量或展示
- [x] 后台设置按公开域名、支付宝、OpenAI、Seedance、S3、注册赠送积分、套餐和视频费用分组
- [x] GPT-image-2 复用 OpenAI API 配置，移除重复的图片地址和 Key 配置
- [x] Seedance 2.0 普通版/Fast 版模型 ID 内置，用户可在生成页面选择
- [x] 视频费用规则固定模型和分辨率，仅允许编辑每秒积分并按公式向上取整
- [ ] 修复视频上传问题
