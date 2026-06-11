# 自托管 API 与 Codex Skill

Image Studio 主应用是桌面端和 Android 壳层，不是可直接对外部署的 Web SaaS。若只想让 Codex 或其他 AI 工具调用生图能力，可以使用仓库新增的 `server/` 自托管 API 服务。

## 架构

```text
Codex / OpenClaw / DeepSeek / MCP
  -> Image Studio skill 或自定义 tool
  -> http://SERVER_IP:8787/v1/images/generations
  -> server/ 私有 API 服务
  -> OpenAI-compatible 图像上游
```

真实上游 API Key 只保存在服务器。客户端只使用你自己生成的 `IMAGE_API_TOKEN`。

## 快速部署

```bash
cp server/.env.example server/.env
docker compose -f docker-compose.self-hosted.yml up -d --build
```

然后访问:

```text
http://SERVER_IP:8787/admin
```

使用 `ADMIN_TOKEN` 登录后配置:

- 上游 Base URL
- 上游 API Key
- 客户端调用 token
- 默认图像模型、尺寸、质量、输出格式
- 请求超时、并发、限流

完整说明见 [server/README.md](../server/README.md)。

## Codex Skill

Skill 位于:

```text
skills/image-studio-generate
```

配置:

```env
IMAGE_STUDIO_ENDPOINT=http://SERVER_IP:8787
IMAGE_STUDIO_API_TOKEN=YOUR_IMAGE_API_TOKEN
```

调用脚本:

```bash
python skills/image-studio-generate/scripts/generate_image.py \
  --prompt "a cinematic robot painter in a small studio"
```

生成出的本地图片默认保存到:

```text
outputs/image-studio/
```

## 安全提醒

即使只是自己用，也建议设置足够长的 `ADMIN_TOKEN` 和 `IMAGE_API_TOKEN`。如果直接暴露 `IP:端口`，请至少在云服务器安全组中只开放必要端口，并保留限流配置。

## 分支维护

本 fork 使用:

- `main`: 自托管 API + Codex Skill 版本。
- `upstream-main`: 原作者版本镜像。

仓库内置 `.github/workflows/check-upstream-updates.yml`，会定时检查原作者仓库是否有更新；本地也可以运行:

```bash
node scripts/check-upstream-updates.mjs
```
