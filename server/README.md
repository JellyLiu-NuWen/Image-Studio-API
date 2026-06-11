# Image Studio Self-Hosted API

这个目录提供一个可自托管的私有生图 API 服务。它不是 Web 版 Image Studio，也不提供公开图库；它的目标是让 Codex、OpenClaw、DeepSeek function calling、MCP server 或其他自动化工具通过 HTTP 调用你自己的服务器来生成图片。

## 当前能力

- `GET /healthz`
- `GET /admin`
- `GET /api/config`
- `POST /api/config`
- `GET /v1/models`
- `POST /v1/images/generations`
- `POST /v1/images/edits`
- `POST /v1/responses`

`/v1/*` 会代理到你配置的 OpenAI-compatible 上游。服务端保存真正的上游 API Key，客户端只需要知道你自己的 `IMAGE_API_TOKEN`。

## 安全模型

服务使用三类密钥:

| 变量 | 用途 | 谁应该知道 |
|---|---|---|
| `ADMIN_TOKEN` | 进入 `/admin` 和调用 `/api/config` | 只有管理员 |
| `IMAGE_API_TOKEN` | Codex / 其他 AI 客户端调用生图接口 | 受信任客户端 |
| `UPSTREAM_API_KEY` | 服务端调用模型上游 | 只有服务器 |

不要把 `UPSTREAM_API_KEY` 放进 skill、客户端脚本或公开文档。

## Docker Compose 部署

在仓库根目录执行:

```bash
cp server/.env.example server/.env
```

编辑 `server/.env`:

```env
ADMIN_TOKEN=replace-with-a-long-admin-token
IMAGE_API_TOKEN=replace-with-a-long-client-token
UPSTREAM_BASE_URL=https://api.openai.com/v1
UPSTREAM_API_KEY=replace-with-your-upstream-key
PORT=8787
```

启动:

```bash
docker compose -f docker-compose.self-hosted.yml up -d --build
```

检查:

```bash
curl http://SERVER_IP:8787/healthz
```

打开后台配置:

```text
http://SERVER_IP:8787/admin
```

输入 `ADMIN_TOKEN` 后可以修改上游地址、上游 API Key、客户端 token、默认模型、尺寸、质量、限流和并发。

## 直接 Node 运行

需要 Node.js 20 或更新版本:

```bash
cd server
cp .env.example .env
node src/index.js
```

PowerShell 示例:

```powershell
$env:ADMIN_TOKEN="replace-with-a-long-admin-token"
$env:IMAGE_API_TOKEN="replace-with-a-long-client-token"
$env:UPSTREAM_BASE_URL="https://api.openai.com/v1"
$env:UPSTREAM_API_KEY="replace-with-your-upstream-key"
npm start
```

## 客户端调用示例

```bash
curl http://SERVER_IP:8787/v1/images/generations \
  -H "Authorization: Bearer YOUR_IMAGE_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "a ceramic tea cup on a walnut desk, soft morning light",
    "size": "1024x1024"
  }'
```

如果请求体没有提供 `model`、`size`、`quality` 或 `output_format`，服务会使用后台配置里的默认值。

## Codex Skill

仓库内置了一个可复制安装的 skill:

```text
skills/image-studio-generate
```

在 Codex 环境中配置:

```env
IMAGE_STUDIO_ENDPOINT=http://SERVER_IP:8787
IMAGE_STUDIO_API_TOKEN=YOUR_IMAGE_API_TOKEN
```

测试脚本:

```bash
python skills/image-studio-generate/scripts/generate_image.py \
  --prompt "minimal black and gold app icon for Image Studio"
```

如果上游返回 `b64_json`，脚本会保存图片到 `./outputs/image-studio/`。如果上游返回 URL，脚本会在 JSON 输出里列出 URL。

## 推荐配置

| 配置 | 自用推荐值 |
|---|---|
| `MAX_CONCURRENT_REQUESTS` | `1` 或 `2` |
| `RATE_LIMIT_PER_MINUTE` | `5` 到 `10` |
| `REQUEST_TIMEOUT_SECONDS` | `120` 到 `300` |
| `DEFAULT_IMAGE_SIZE` | `1024x1024` |
| `DEFAULT_IMAGE_QUALITY` | `auto` |

短期自用可以直接开放 `IP:8787`。如果以后给更多设备或多人使用，建议加 HTTPS、IP 白名单、Tailscale 或反向代理访问控制。

## 本地验证

```bash
cd server
npm run check
npm test
npm run smoke
```

验证 skill:

```bash
python -m unittest skills.image-studio-generate.scripts.test_generate_image
python /path/to/skill-creator/scripts/quick_validate.py skills/image-studio-generate
```

## 维护 upstream

建议把自托管改动放在独立分支，例如 `self-hosted-api`。后续同步原作者更新:

```bash
git fetch upstream
git checkout main
git merge upstream/main
git push origin main

git checkout self-hosted-api
git merge main
```

本目录基本独立于桌面端和 Android 端，通常可以减少合并冲突。
