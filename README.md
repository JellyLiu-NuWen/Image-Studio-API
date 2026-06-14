# Image Studio API

> 基于 [RoseKhlifa/Image-Studio](https://github.com/RoseKhlifa/Image-Studio) 的自托管 API fork ·
> 面向 Codex / OpenClaw / DeepSeek / MCP 等 AI 工具的私有生图接口

![license](https://img.shields.io/badge/license-AGPLv3-b22222)
![go](https://img.shields.io/badge/go-%3E%3D1.25-00ADD8)
![react](https://img.shields.io/badge/react-18-61DAFB)
![wails](https://img.shields.io/badge/wails-v2.12-DF0000)
![platform](https://img.shields.io/badge/platform-windows%20%7C%20macos%20%7C%20linux%20%7C%20android-lightgrey)

## 这个 fork 想解决什么

原项目 Image Studio 是一个优秀的开源图像生成 / 编辑客户端，主体是 Wails 桌面端和 Android WebView 壳层。我自己的需求不是再做一个 Web 版，而是把它整理成一个可以部署在自己服务器上的私有 API 服务，让 Codex 或其他 AI 先理解用户需求，再通过这个接口调用生图能力，最后把图片结果回传给用户。

所以这个 fork 的核心思路是:

- 保留原作者项目作为上游基础，版本号尽量和作者版本对齐。
- 在 `main` 分支提供自托管 API、后台配置页和 Codex Skill。
- 在 `upstream-main` 分支保留作者原版镜像，方便比较和同步。
- 真实模型 API Key 只放在服务器上，Codex / OpenClaw / DeepSeek 只拿一个私有调用 token。
- 先支持 `IP:PORT` 的简单部署，HTTPS、反代、Tailscale、IP 白名单等安全增强可以后续再加。

## 版本对齐

当前状态: **已对齐**。

| 项目 | 版本 |
|---|---|
| 我的项目版本 | `v1.2.5` |
| 作者仓库版本 | `v1.2.5` |
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

## 原项目说明

本 README 只介绍这个 fork 的自托管 API 思路、部署和版本维护。原项目的桌面端能力、安装包、使用方式、排障说明、赞助信息和完整文档，请直接查看原作者仓库:

- 原作者仓库: [RoseKhlifa/Image-Studio](https://github.com/RoseKhlifa/Image-Studio)
- 原作者 README: [RoseKhlifa/Image-Studio#readme](https://github.com/RoseKhlifa/Image-Studio#readme)
- 原作者 Releases: [RoseKhlifa/Image-Studio Releases](https://github.com/RoseKhlifa/Image-Studio/releases)
- 原作者文档目录: [RoseKhlifa/Image-Studio/tree/main/docs](https://github.com/RoseKhlifa/Image-Studio/tree/main/docs)

## License

[GNU AGPL v3.0](./LICENSE) © 2026

这意味着基于本项目进行修改后再分发，或将修改版作为网络服务提供给他人使用时，都需要按同一许可证公开对应源码。
