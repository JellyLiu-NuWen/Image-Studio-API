# Image Studio API

> 基于 [RoseKhlifa/Image-Studio](https://github.com/RoseKhlifa/Image-Studio) 的自托管 API fork ·
> 面向 Codex / OpenClaw / DeepSeek / MCP 等 AI 工具的私有生图接口

![license](https://img.shields.io/badge/license-AGPLv3-b22222)
![node](https://img.shields.io/badge/node-%3E%3D20-43853D)
![docker](https://img.shields.io/badge/docker-self--hosted-2496ED)
![api](https://img.shields.io/badge/API-OpenAI--compatible-111827)
![skill](https://img.shields.io/badge/Codex-skill-6f42c1)

## 这个 fork 想解决什么

这个 fork 的目标是把 Image Studio 整理成一个可以部署在自己服务器上的私有 API 服务。Codex、OpenClaw、DeepSeek、MCP 或其他 AI 工具先理解用户需求，再通过这个服务调用生图接口，最后把图片结果回传给用户。

它不是桌面端、Android 端或 Cloudflare Worker 发行线。那些平台代码已经归档到 `legacy-platforms` 分支；作者原版镜像保留在 `upstream-main` 分支。

## 版本对齐

当前状态: **已对齐**。

| 项目 | 版本 |
|---|---|
| 我的 API 版本 | `unknown` |
| 作者仓库版本 | `unknown` |
| 对齐状态 | `已对齐` |

版本号跟随作者仓库的最新语义化 tag。两边版本号一致，说明当前 fork 已对齐作者版本。

GitHub Action 会每天检查作者仓库是否有新提交，并刷新 `badges/*.json` 和本节内容。如果作者仓库有更新，会创建或更新 `upstream-sync` issue 提醒同步。

手动检查:

```bash
node scripts/check-upstream-updates.mjs
node scripts/write-version-badges.mjs
```


## 你需要准备的信息

部署前至少需要:

| 信息 | 说明 |
|---|---|
| `ADMIN_TOKEN` | 进入 `/admin` 后台配置页的管理 token |
| `IMAGE_API_TOKEN` | Codex / 其他 AI 调用本服务时使用的 token |
| `UPSTREAM_BASE_URL` | OpenAI-compatible 图像上游地址，例如 `https://api.openai.com/v1` |
| `UPSTREAM_API_KEY` | 真正的模型服务 API Key，只保存在服务器 |
| `DEFAULT_IMAGE_MODEL` | 默认图像模型，例如 `gpt-image-2` 或你的上游兼容模型 |
| `PORT` | 服务监听端口，默认 `8787` |

最小调用链:

```text
Codex / OpenClaw / DeepSeek / MCP
  -> IMAGE_STUDIO_ENDPOINT=http://SERVER_IP:8787
  -> Authorization: Bearer IMAGE_API_TOKEN
  -> server/ 自托管 API
  -> UPSTREAM_BASE_URL + UPSTREAM_API_KEY
  -> 返回 b64_json 或图片 URL
```

## 快速部署 API 服务

```bash
git clone https://github.com/JellyLiu-NuWen/Image-Studio-API.git
cd Image-Studio-API
cp server/.env.example server/.env
```

编辑 `server/.env` 后启动:

```bash
docker compose -f docker-compose.self-hosted.yml up -d --build
```

如果不用 Docker，也可以直接 Node 运行:

```bash
cd server
npm start
```

后台配置页:

```text
http://SERVER_IP:8787/admin
```

健康检查:

```bash
curl http://SERVER_IP:8787/healthz
```

Codex Skill 位于:

```text
skills/image-studio-generate
```

Codex 侧配置:

```env
IMAGE_STUDIO_ENDPOINT=http://SERVER_IP:8787
IMAGE_STUDIO_API_TOKEN=your-client-token
```

更多自托管说明见 [server/README.md](./server/README.md) 和 [docs/self-hosted-api.md](./docs/self-hosted-api.md)。

## 分支策略

| 分支 | 用途 |
|---|---|
| `main` | 自托管 API、后台、skills、Docker 发布 |
| `upstream-main` | 原作者仓库镜像，用于版本对齐和同步 |
| `legacy-platforms` | API-only 清理前的全平台 fork 快照 |

## 原项目说明

原项目的桌面端能力、安装包、使用方式、排障说明、赞助信息和完整文档，请直接查看原作者仓库:

- 原作者仓库: [RoseKhlifa/Image-Studio](https://github.com/RoseKhlifa/Image-Studio)
- 原作者 README: [RoseKhlifa/Image-Studio#readme](https://github.com/RoseKhlifa/Image-Studio#readme)
- 原作者 Releases: [RoseKhlifa/Image-Studio Releases](https://github.com/RoseKhlifa/Image-Studio/releases)
- 原作者文档目录: [RoseKhlifa/Image-Studio/tree/main/docs](https://github.com/RoseKhlifa/Image-Studio/tree/main/docs)

## License

[GNU AGPL v3.0](./LICENSE) © 2026

这意味着基于本项目进行修改后再分发，或将修改版作为网络服务提供给他人使用时，都需要按同一许可证公开对应源码。
