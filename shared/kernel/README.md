# Kernel Request Model

这里收口的是 API 服务共享的“请求规范层”，只负责定义发给上游 OpenAI 兼容接口的请求形态，不负责具体传输。

## 目标

- 统一 `Responses API` 请求体构造
- 统一提示词优化请求体构造
- 让 `server/` 和后续 JS 宿主复用同一套字段规范

## 当前约定

- 默认图片会优先走两种 API 形态之一：
  - `responses`：适合多轮、SSE 保活、内置 `image_generation` 工具
  - `images`：适合标准 `/v1/images/generations` 和 `/v1/images/edits`
- 默认请求策略是 `openai`：
  - 只发送 OpenAI 官方公开字段
- 可选请求策略是 `compat`：
  - 允许附带 relay 常见扩展字段，例如 `seed`、`negative_prompt`
- `Responses API` 下的 mask 使用：
  - `tools[0].input_image_mask.image_url`
  - 值必须是 `data:image/...;base64,...` 形式的数据 URL
- `Images API` 下的 mask 不在这里构造，由调用方按 multipart 上传，并显式带正确图片 MIME

## 分层

- `shared/kernel/requestModel.js`
  - 只做字段规范、默认值、重试判定、错误摘要
- `server/src/upstreamProxy.js`
  - 负责 HTTP 传输、超时、鉴权代理和 OpenAI-compatible 路由

## 修改原则

- 如果只是字段规范变化，优先改这里
- 如果是传输差异，比如 `fetch`、multipart 或响应转发，实现留在 `server/` 层
- 不要在多个入口重复维护同一份 `Responses` JSON 结构
