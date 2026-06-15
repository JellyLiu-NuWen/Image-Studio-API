# 自托管 API 与 Codex Skill

这个 fork 的 `main` 分支面向自托管 API 服务。若想让 Codex 或其他 AI 工具调用生图能力，可以使用仓库内的 `server/` 服务。

## 架构

```text
Codex / OpenClaw / DeepSeek / MCP
  -> Image Studio skill 或自定义 tool
  -> http://SERVER_IP:8787/v1/images/generations
  -> server/ 私有 API 服务
  -> OpenAI-compatible 图像上游
```

真实上游 API Key 只保存在服务器。客户端只使用你自己生成的服务 API Key。后台可以配置多个接口 Key 和多个上游中转站，一个接口可以绑定多个上游，按绑定顺序优先尝试，失败后自动切换到下一个上游。

## 快速部署

```bash
cp .env.example .env
cp server/.env.example server/.env
docker compose -f docker-compose.self-hosted.yml up -d --build
```

根目录 `.env` 用于 Docker 部署选项，例如 `IMAGE_STUDIO_API_HOST_PORT=80` 可以把公网入口改成 `http://SERVER_IP/admin`。`server/.env` 用于服务端密钥和上游配置。

然后访问:

```text
http://SERVER_IP:8787/admin
```

使用后台账号密码登录后配置:

- 多个上游 Base URL 和上游 API Key
- 多个客户端接口 Key
- 每个接口绑定的上游优先级
- 默认图像模型、尺寸、质量、输出格式
- 请求超时、并发、限流

完整说明见 [server/README.md](../server/README.md)。

更多运维说明见 [operations.md](./operations.md)，Docker 更新说明见 [docker-updates.md](./docker-updates.md)。

## Codex Skill

Skill 位于:

```text
skills/image-studio-generate
```

配置推荐放在本机私有文件里，不要提交真实 Key:

Windows PowerShell:

```powershell
New-Item -ItemType Directory -Force "$HOME\.codex" | Out-Null
@"
IMAGE_STUDIO_ENDPOINT=http://SERVER_IP:8787
IMAGE_STUDIO_API_TOKEN=YOUR_SKILL_CALLING_KEY
"@ | Set-Content -Encoding UTF8 "$HOME\.codex\image-studio-generate.env"
```

Linux / macOS:

```bash
mkdir -p ~/.codex
cat > ~/.codex/image-studio-generate.env <<'EOF'
IMAGE_STUDIO_ENDPOINT=http://SERVER_IP:8787
IMAGE_STUDIO_API_TOKEN=YOUR_SKILL_CALLING_KEY
EOF
chmod 600 ~/.codex/image-studio-generate.env
```

也可以使用环境变量:

```env
IMAGE_STUDIO_ENDPOINT=http://SERVER_IP:8787
IMAGE_STUDIO_API_TOKEN=YOUR_SKILL_CALLING_KEY
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

即使只是自己用，也建议设置足够长的后台密码和 `IMAGE_API_TOKEN`。如果直接暴露 `IP:端口`，请至少在云服务器安全组中只开放必要端口，并保留限流配置。

## 分支维护

本 fork 使用:

- `main`: 自托管 API + Codex Skill 版本。
- `upstream-main`: 原作者版本镜像。

仓库内置 `.github/workflows/check-upstream-updates.yml`，会定时检查原作者仓库是否有更新；本地也可以运行:

```bash
node scripts/check-upstream-updates.mjs
```
