export function renderAdminPage() {
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Image Studio API 管理后台</title>
  <style>
    :root {
      color-scheme: light;
      --bg: #eef2f6;
      --surface: #ffffff;
      --surface-alt: #f7f9fb;
      --surface-soft: #f1f5f8;
      --border: #d8e0e8;
      --border-strong: #c5d0dc;
      --text: #17212b;
      --text-muted: #5e6c7c;
      --text-soft: #8190a0;
      --accent: #176b5f;
      --accent-strong: #12574d;
      --accent-soft: #e5f3ef;
      --success: #18794e;
      --danger: #b42318;
      --warning: #956216;
      --shadow: 0 16px 42px rgba(17, 24, 39, 0.08);
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      background: var(--bg);
      color: var(--text);
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      background: var(--bg);
      color: var(--text);
    }
    a { color: var(--accent); text-decoration: none; }
    a:hover { text-decoration: underline; }
    .hidden { display: none !important; }
    .login-page {
      min-height: 100vh;
      display: grid;
      place-items: center;
      padding: 24px;
      background:
        linear-gradient(180deg, rgba(255,255,255,0.7), rgba(255,255,255,0)),
        var(--bg);
    }
    .login-card {
      width: min(440px, 100%);
      display: grid;
      gap: 22px;
      padding: 28px;
      border: 1px solid var(--border);
      border-radius: 16px;
      background: var(--surface);
      box-shadow: var(--shadow);
    }
    .login-card h1 {
      margin: 0 0 6px;
      font-size: 24px;
      line-height: 1.2;
      letter-spacing: 0;
    }
    .login-card p {
      margin: 0;
      color: var(--text-muted);
      line-height: 1.6;
    }
    .app-shell {
      min-height: 100vh;
      display: grid;
      grid-template-columns: 260px minmax(0, 1fr);
    }
    .sidebar {
      position: sticky;
      top: 0;
      height: 100vh;
      display: grid;
      grid-template-rows: auto 1fr auto;
      gap: 18px;
      padding: 20px;
      border-right: 1px solid var(--border);
      background: #fbfcfd;
    }
    .sidebar-brand {
      display: grid;
      gap: 8px;
    }
    .brand-mark {
      width: 38px;
      height: 38px;
      display: grid;
      place-items: center;
      border-radius: 10px;
      background: var(--accent);
      color: #fff;
      font-weight: 800;
    }
    .sidebar-brand strong {
      font-size: 16px;
      line-height: 1.25;
    }
    .sidebar-brand span {
      color: var(--text-muted);
      font-size: 12px;
      line-height: 1.45;
    }
    .nav-list {
      display: grid;
      align-content: start;
      gap: 6px;
    }
    .nav-button {
      width: 100%;
      min-height: 40px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      padding: 0 12px;
      border: 1px solid transparent;
      border-radius: 10px;
      background: transparent;
      color: var(--text-muted);
      font: inherit;
      font-weight: 700;
      cursor: pointer;
      text-align: left;
    }
    .nav-button:hover {
      background: var(--surface-soft);
      color: var(--text);
    }
    .nav-button.active {
      border-color: rgba(23, 107, 95, 0.18);
      background: var(--accent-soft);
      color: var(--accent-strong);
    }
    .sidebar-footer {
      display: grid;
      gap: 10px;
      color: var(--text-soft);
      font-size: 12px;
      line-height: 1.45;
    }
    .main {
      min-width: 0;
      padding: 24px;
    }
    .topbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      margin-bottom: 18px;
    }
    .topbar h1 {
      margin: 0;
      font-size: 24px;
      line-height: 1.2;
      letter-spacing: 0;
    }
    .topbar p {
      margin: 5px 0 0;
      color: var(--text-muted);
      line-height: 1.55;
    }
    .topbar-actions {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
      justify-content: flex-end;
    }
    .pill {
      display: inline-flex;
      align-items: center;
      min-height: 30px;
      padding: 0 10px;
      border: 1px solid var(--border);
      border-radius: 999px;
      background: var(--surface);
      color: var(--text-muted);
      font-size: 12px;
      font-weight: 700;
      white-space: nowrap;
    }
    .pill.ok {
      border-color: rgba(24, 121, 78, 0.22);
      background: rgba(24, 121, 78, 0.08);
      color: var(--success);
    }
    .status {
      min-height: 20px;
      color: var(--text-muted);
      font-size: 13px;
      line-height: 1.45;
    }
    .view {
      display: none;
      gap: 16px;
    }
    .view.active { display: grid; }
    .grid-4 {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 12px;
    }
    .grid-2 {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 16px;
    }
    .card {
      min-width: 0;
      border: 1px solid var(--border);
      border-radius: 14px;
      background: var(--surface);
      box-shadow: var(--shadow);
    }
    .card-header {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: 12px;
      padding: 18px 20px 0;
    }
    .card-header h2,
    .card-header h3 {
      margin: 0;
      font-size: 17px;
      line-height: 1.25;
      letter-spacing: 0;
    }
    .card-header span {
      color: var(--text-soft);
      font-size: 12px;
      line-height: 1.4;
      text-align: right;
    }
    .card-body {
      padding: 18px 20px 20px;
    }
    .metric {
      display: grid;
      gap: 8px;
      padding: 15px;
      border: 1px solid var(--border);
      border-radius: 13px;
      background: var(--surface);
      box-shadow: var(--shadow);
    }
    .metric span {
      color: var(--text-soft);
      font-size: 12px;
      line-height: 1.35;
    }
    .metric strong {
      font-size: 24px;
      line-height: 1.1;
      overflow-wrap: anywhere;
    }
    .metric small {
      color: var(--text-muted);
      font-size: 12px;
      line-height: 1.35;
    }
    form {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 14px;
    }
    label {
      display: grid;
      gap: 7px;
      color: var(--text);
      font-size: 13px;
      font-weight: 700;
    }
    label.full { grid-column: 1 / -1; }
    input, select {
      width: 100%;
      min-height: 44px;
      border: 1px solid var(--border-strong);
      border-radius: 10px;
      padding: 10px 12px;
      background: #fff;
      color: var(--text);
      font: inherit;
      transition: border-color 160ms ease, box-shadow 160ms ease;
    }
    input::placeholder { color: #94a2b0; }
    input:focus,
    select:focus {
      outline: none;
      border-color: rgba(23, 107, 95, 0.55);
      box-shadow: 0 0 0 4px rgba(23, 107, 95, 0.12);
    }
    .actions {
      grid-column: 1 / -1;
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
      padding-top: 4px;
    }
    button {
      border: 1px solid transparent;
      border-radius: 10px;
      min-height: 42px;
      padding: 0 16px;
      font: inherit;
      font-weight: 800;
      cursor: pointer;
      transition: background-color 160ms ease, border-color 160ms ease, box-shadow 160ms ease;
    }
    button:focus-visible {
      outline: none;
      box-shadow: 0 0 0 4px rgba(23, 107, 95, 0.14);
    }
    .primary {
      background: var(--accent);
      border-color: var(--accent);
      color: #fff;
    }
    .primary:hover {
      background: var(--accent-strong);
      border-color: var(--accent-strong);
    }
    .secondary {
      background: var(--surface-soft);
      border-color: var(--border);
      color: var(--text);
    }
    .secondary:hover {
      background: #e8eef4;
      border-color: #c8d4df;
    }
    .danger-button {
      background: #fff4f2;
      border-color: rgba(180, 35, 24, 0.24);
      color: var(--danger);
    }
    .muted {
      color: var(--text-muted);
      line-height: 1.55;
    }
    .call-chain {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 8px;
      margin-top: 16px;
      padding: 14px;
      border: 1px solid var(--border);
      border-radius: 12px;
      background: var(--surface-alt);
      color: var(--text-muted);
      font-size: 13px;
      line-height: 1.45;
    }
    .chain-node {
      display: inline-flex;
      align-items: center;
      min-height: 28px;
      padding: 0 10px;
      border: 1px solid var(--border);
      border-radius: 999px;
      background: #fff;
      color: var(--text);
      font-weight: 700;
      white-space: nowrap;
    }
    .table-wrap {
      overflow-x: auto;
      border: 1px solid var(--border);
      border-radius: 12px;
      background: #fff;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      min-width: 720px;
      font-size: 13px;
      line-height: 1.45;
    }
    th,
    td {
      padding: 11px 12px;
      border-bottom: 1px solid var(--border);
      text-align: left;
      vertical-align: top;
      overflow-wrap: anywhere;
    }
    th {
      background: var(--surface-alt);
      color: var(--text-muted);
      font-size: 12px;
      font-weight: 800;
      white-space: nowrap;
    }
    tr:last-child td { border-bottom: 0; }
    .status-tag {
      display: inline-flex;
      align-items: center;
      min-height: 24px;
      padding: 0 8px;
      border-radius: 999px;
      background: var(--accent-soft);
      color: var(--success);
      font-size: 12px;
      font-weight: 800;
      white-space: nowrap;
    }
    .status-tag.failed {
      background: #fff0ee;
      color: var(--danger);
    }
    .log-list {
      display: grid;
      gap: 10px;
    }
    .log-row {
      display: grid;
      gap: 4px;
      padding: 12px 0;
      border-top: 1px solid var(--border);
      font-size: 13px;
      line-height: 1.45;
      overflow-wrap: anywhere;
    }
    .log-row:first-child {
      border-top: 0;
      padding-top: 0;
    }
    .log-row strong { color: var(--text); }
    .log-row.ok strong { color: var(--success); }
    .log-row.danger strong { color: var(--danger); }
    .log-row.empty { color: var(--text-soft); }
    .update-status {
      display: grid;
      gap: 6px;
      padding: 14px;
      border: 1px solid var(--border);
      border-radius: 12px;
      background: var(--surface-alt);
      overflow-wrap: anywhere;
    }
    .update-status strong {
      font-size: 15px;
      line-height: 1.35;
    }
    .update-status span {
      color: var(--text-muted);
      font-size: 13px;
      line-height: 1.45;
    }
    @media (max-width: 1040px) {
      .app-shell { grid-template-columns: 1fr; }
      .sidebar {
        position: static;
        height: auto;
        border-right: 0;
        border-bottom: 1px solid var(--border);
      }
      .nav-list {
        grid-template-columns: repeat(3, minmax(0, 1fr));
      }
    }
    @media (max-width: 760px) {
      .main { padding: 16px; }
      .topbar { align-items: flex-start; flex-direction: column; }
      .topbar-actions { justify-content: flex-start; }
      .grid-4,
      .grid-2,
      form,
      .nav-list { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>
  <section id="loginPage" class="login-page">
    <form id="loginForm" class="login-card">
      <div>
        <h1>登录 Image Studio API</h1>
        <p>使用后台账号密码进入管理系统。生图调用仍然使用接口配置里的服务 API Key。</p>
      </div>
      <label>账号
        <input id="loginUsername" autocomplete="username" placeholder="admin">
      </label>
      <label>密码
        <input id="loginPassword" autocomplete="current-password" type="password" placeholder="请输入后台密码">
      </label>
      <button type="submit" class="primary">登录后台</button>
      <div id="loginStatus" class="status"></div>
    </form>
  </section>

  <section id="appShell" class="app-shell hidden">
    <aside class="sidebar">
      <div class="sidebar-brand">
        <div class="brand-mark">IS</div>
        <strong>Image Studio API</strong>
        <span>自托管生图中转管理系统</span>
      </div>
      <nav class="nav-list" aria-label="后台导航">
        <button class="nav-button active" type="button" data-view="dashboardView">仪表盘</button>
        <button class="nav-button" type="button" data-view="clientConfigView">接口配置</button>
        <button class="nav-button" type="button" data-view="upstreamConfigView">上游中转站</button>
        <button class="nav-button" type="button" data-view="logsView">调用日志</button>
        <button class="nav-button" type="button" data-view="updatesView">版本更新</button>
        <button class="nav-button" type="button" data-view="accountView">账号与安全</button>
      </nav>
      <div class="sidebar-footer">
        <span id="currentAccount">当前账号：admin</span>
        <button type="button" class="secondary" id="logoutBtn">退出登录</button>
      </div>
    </aside>

    <main class="main">
      <header class="topbar">
        <div>
          <h1 id="pageTitle">仪表盘</h1>
          <p id="pageDescription">查看服务状态、调用量、响应速度和生图任务概览。</p>
        </div>
        <div class="topbar-actions">
          <span class="pill ok">服务在线</span>
          <span class="pill">自托管</span>
          <button type="button" class="secondary" id="refreshBtn">刷新数据</button>
        </div>
      </header>
      <div id="status" class="status"></div>

      <section id="dashboardView" class="view active">
        <div class="grid-4" aria-label="仪表盘指标">
          <div class="metric"><span>活跃请求</span><strong id="summaryActive">0</strong><small>当前正在处理的调用</small></div>
          <div class="metric"><span>API 成功</span><strong id="summaryApiSuccess">0</strong><small>已通过鉴权的调用</small></div>
          <div class="metric"><span>生图成功</span><strong id="summaryGenSuccess">0</strong><small>完成的图片任务</small></div>
          <div class="metric"><span>P95 响应</span><strong id="summaryLatency">0ms</strong><small>最近响应尾延迟</small></div>
        </div>
        <div class="grid-2">
          <section class="card">
            <div class="card-header"><h2>运行指标</h2><span>吞吐、错误与响应速度</span></div>
            <div class="card-body" id="metricsPanel"><div class="muted">暂无指标，请刷新数据。</div></div>
          </section>
          <section class="card">
            <div class="card-header"><h2>版本状态</h2><span>当前版本与仓库版本对比</span></div>
            <div class="card-body"><div id="updateStatus" class="update-status"><strong>尚未检查版本</strong><span>刷新数据后会显示版本对齐情况。</span></div></div>
          </section>
        </div>
      </section>

      <section id="clientConfigView" class="view">
        <section class="card">
          <div class="card-header"><h2>接口配置</h2><span>给 Codex、Skill、OpenClaw 或其他 AI 工具使用</span></div>
          <div class="card-body">
            <form id="clientConfigForm">
              <label class="full">你的服务 API Key
                <input id="imageApiToken" autocomplete="off" type="password" placeholder="留空表示保留当前 Key">
              </label>
              <label>默认生图模型
                <input id="defaultImageModel" placeholder="gpt-image-2">
              </label>
              <label>默认文本模型
                <input id="defaultTextModel" placeholder="gpt-5.5">
              </label>
              <label>默认尺寸
                <input id="defaultSize" placeholder="1024x1024">
              </label>
              <label>默认质量
                <select id="defaultQuality">
                  <option value="auto">auto</option>
                  <option value="low">low</option>
                  <option value="medium">medium</option>
                  <option value="high">high</option>
                </select>
              </label>
              <label>默认输出格式
                <select id="defaultOutputFormat">
                  <option value="png">png</option>
                  <option value="jpeg">jpeg</option>
                  <option value="webp">webp</option>
                </select>
              </label>
              <label>请求超时秒数
                <input id="requestTimeoutSeconds" type="number" min="10" max="900" step="1">
              </label>
              <label>最大并发请求
                <input id="maxConcurrentRequests" type="number" min="1" max="10" step="1">
              </label>
              <label>每分钟限流
                <input id="rateLimitPerMinute" type="number" min="1" max="600" step="1">
              </label>
              <div class="actions">
                <button type="button" class="secondary" id="loadConfigBtn">加载配置</button>
                <button type="submit" class="primary">保存接口配置</button>
              </div>
            </form>
          </div>
        </section>
      </section>

      <section id="upstreamConfigView" class="view">
        <section class="card">
          <div class="card-header"><h2>上游中转站</h2><span>你的服务器会用这里的 URL 和 Key 去访问上游生图服务</span></div>
          <div class="card-body">
            <form id="upstreamConfigForm">
              <label class="full">上游中转站 URL
                <input id="upstreamBaseURL" placeholder="https://example.com/v1">
              </label>
              <label class="full">上游中转站 Key
                <input id="upstreamApiKey" autocomplete="off" type="password" placeholder="留空表示保留当前 Key">
              </label>
              <div class="actions">
                <button type="button" class="secondary" id="loadUpstreamBtn">加载配置</button>
                <button type="button" class="secondary" id="testUpstreamBtn">测试上游连接</button>
                <button type="submit" class="primary">保存上游配置</button>
              </div>
            </form>
            <div class="call-chain" aria-label="调用链路">
              <span>调用链路</span>
              <span class="chain-node">Codex / Skill</span>
              <span>-></span>
              <span class="chain-node">你的服务器</span>
              <span>-></span>
              <span class="chain-node">上游中转站</span>
              <span>-></span>
              <span class="chain-node">生图模型</span>
            </div>
          </div>
        </section>
      </section>

      <section id="logsView" class="view">
        <div class="grid-2">
          <section class="card">
            <div class="card-header"><h2>生图日志</h2><span>最近图片生成请求</span></div>
            <div class="card-body"><div id="generationLogs" class="table-wrap"><div class="log-row empty">暂无记录。</div></div></div>
          </section>
          <section class="card">
            <div class="card-header"><h2>API 调用日志</h2><span>后台与接口请求记录</span></div>
            <div class="card-body"><div id="apiLogs" class="table-wrap"><div class="log-row empty">暂无记录。</div></div></div>
          </section>
        </div>
      </section>

      <section id="updatesView" class="view">
        <section class="card">
          <div class="card-header"><h2>版本更新</h2><span>检查 GitHub Release 是否有新版本</span></div>
          <div class="card-body">
            <div id="updateStatusMirror" class="update-status"><strong>尚未检查版本</strong><span>点击刷新数据检查当前版本。</span></div>
          </div>
        </section>
      </section>

      <section id="accountView" class="view">
        <section class="card">
          <div class="card-header"><h2>账号与安全</h2><span>修改后台登录账号和密码</span></div>
          <div class="card-body">
            <form id="accountForm">
              <label>后台账号
                <input id="accountUsername" autocomplete="username" placeholder="admin">
              </label>
              <label>当前密码
                <input id="currentPassword" autocomplete="current-password" type="password" placeholder="请输入当前密码">
              </label>
              <label class="full">新密码
                <input id="newPassword" autocomplete="new-password" type="password" placeholder="至少 8 个字符">
              </label>
              <div class="actions">
                <button type="submit" class="primary">保存账号密码</button>
              </div>
            </form>
          </div>
        </section>
      </section>
    </main>
  </section>

  <script>
    const views = {
      dashboardView: ["仪表盘", "查看服务状态、调用量、响应速度和生图任务概览。"],
      clientConfigView: ["接口配置", "管理给 Codex、Skill、OpenClaw 或其他 AI 工具调用的服务 Key 和默认参数。"],
      upstreamConfigView: ["上游中转站", "配置你的服务器转发到上游中转站时使用的 URL 和 Key。"],
      logsView: ["调用日志", "查看生图日志、API 调用日志和响应耗时。"],
      updatesView: ["版本更新", "检查当前版本与 GitHub Release 的对齐情况。"],
      accountView: ["账号与安全", "修改后台登录账号和密码。"]
    };
    const configFields = [
      "upstreamBaseURL",
      "defaultImageModel",
      "defaultTextModel",
      "defaultSize",
      "defaultQuality",
      "defaultOutputFormat",
      "requestTimeoutSeconds",
      "maxConcurrentRequests",
      "rateLimitPerMinute"
    ];
    const statusEl = document.getElementById("status");
    const loginStatusEl = document.getElementById("loginStatus");

    function setStatus(message, kind = "") {
      statusEl.textContent = message;
      statusEl.className = "status " + kind;
    }

    function setLoginStatus(message, kind = "") {
      loginStatusEl.textContent = message;
      loginStatusEl.className = "status " + kind;
    }

    function escapeHTML(value) {
      return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");
    }

    async function fetchAdminJSON(path, options = {}) {
      const response = await fetch("/api" + path, {
        credentials: "same-origin",
        ...options,
        headers: {
          ...(options.body ? { "content-type": "application/json" } : {}),
          ...(options.headers || {})
        }
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error?.message || "请求失败");
      }
      return data;
    }

    function showApp(account) {
      document.getElementById("loginPage").classList.add("hidden");
      document.getElementById("appShell").classList.remove("hidden");
      const username = account?.username || "admin";
      document.getElementById("currentAccount").textContent = "当前账号：" + username;
      document.getElementById("accountUsername").value = username;
    }

    function showLogin() {
      document.getElementById("appShell").classList.add("hidden");
      document.getElementById("loginPage").classList.remove("hidden");
    }

    function switchView(viewId) {
      for (const element of document.querySelectorAll(".view")) {
        element.classList.toggle("active", element.id === viewId);
      }
      for (const button of document.querySelectorAll(".nav-button")) {
        button.classList.toggle("active", button.dataset.view === viewId);
      }
      document.getElementById("pageTitle").textContent = views[viewId]?.[0] || "管理后台";
      document.getElementById("pageDescription").textContent = views[viewId]?.[1] || "";
      if (viewId === "logsView" || viewId === "dashboardView" || viewId === "updatesView") {
        loadDashboard();
      }
    }

    function fillConfig(config) {
      for (const name of configFields) {
        document.getElementById(name).value = config[name] ?? "";
      }
      document.getElementById("upstreamApiKey").placeholder = config.upstreamApiKeySet
        ? "当前上游 Key 已保存，留空表示不修改"
        : "尚未保存上游 Key";
      document.getElementById("imageApiToken").placeholder = config.imageApiTokenSet
        ? "当前服务 API Key 已保存，留空表示不修改"
        : "尚未保存服务 API Key";
      document.getElementById("upstreamApiKey").value = "";
      document.getElementById("imageApiToken").value = "";
      document.getElementById("accountUsername").value = config.adminUsername || "admin";
    }

    async function loadConfig() {
      setStatus("正在加载配置...");
      const data = await fetchAdminJSON("/config");
      fillConfig(data.config);
      setStatus("配置已加载。", "ok");
      return data.config;
    }

    function collectConfigPatch(includeSecrets = true) {
      const body = {};
      for (const name of configFields) {
        body[name] = document.getElementById(name).value;
      }
      if (includeSecrets) {
        body.upstreamApiKey = document.getElementById("upstreamApiKey").value;
        body.imageApiToken = document.getElementById("imageApiToken").value;
      }
      return body;
    }

    async function saveConfig(patch) {
      setStatus("正在保存配置...");
      const data = await fetchAdminJSON("/config", {
        method: "POST",
        body: JSON.stringify(patch)
      });
      fillConfig(data.config);
      setStatus("配置已保存。", "ok");
    }

    function metricCard(label, value, hint) {
      return [
        '<div class="metric">',
        '<span>' + escapeHTML(label) + '</span>',
        '<strong>' + escapeHTML(value) + '</strong>',
        '<small>' + escapeHTML(hint) + '</small>',
        '</div>'
      ].join("");
    }

    function renderMetrics(metrics) {
      const api = metrics?.api ?? {};
      const generations = metrics?.generations ?? {};
      document.getElementById("summaryActive").textContent = metrics?.activeRequests ?? 0;
      document.getElementById("summaryApiSuccess").textContent = api.success ?? 0;
      document.getElementById("summaryGenSuccess").textContent = generations.success ?? 0;
      document.getElementById("summaryLatency").textContent = (api.p95DurationMs ?? 0) + "ms";
      document.getElementById("metricsPanel").innerHTML = [
        '<div class="grid-4">',
        metricCard("API 总数", api.total ?? 0, "全部接口调用"),
        metricCard("API 错误", api.error ?? 0, "失败或被拒绝调用"),
        metricCard("生图总数", generations.total ?? 0, "全部图片任务"),
        metricCard("生图失败", generations.failed ?? 0, "失败图片任务"),
        metricCard("API P50", (api.p50DurationMs ?? 0) + "ms", "接口中位耗时"),
        metricCard("API P95", (api.p95DurationMs ?? 0) + "ms", "接口尾延迟"),
        metricCard("生图 P50", (generations.p50DurationMs ?? 0) + "ms", "生图中位耗时"),
        metricCard("生图 P95", (generations.p95DurationMs ?? 0) + "ms", "生图尾延迟"),
        '</div>'
      ].join("");
    }

    function summarizeRecord(record) {
      const parts = [];
      const labels = {
        createdAt: "时间",
        path: "路径",
        endpoint: "端点",
        method: "方法",
        status: "状态",
        upstreamStatus: "上游状态",
        durationMs: "耗时(ms)"
      };
      for (const key of ["createdAt", "path", "endpoint", "method", "status", "upstreamStatus", "durationMs"]) {
        if (record?.[key] !== undefined) parts.push(labels[key] + ": " + record[key]);
      }
      return parts.length ? parts.join(" | ") : JSON.stringify(record);
    }

    function formatStatus(status) {
      const value = String(status || "记录");
      const failed = value === "failed" || value === "error";
      return '<span class="status-tag ' + (failed ? "failed" : "") + '">' + escapeHTML(value) + '</span>';
    }

    function formatTime(value) {
      if (!value) return "-";
      try {
        return new Date(value).toLocaleString("zh-CN", { hour12: false });
      } catch {
        return value;
      }
    }

    function renderRows(id, records) {
      const container = document.getElementById(id);
      if (!Array.isArray(records) || records.length === 0) {
        container.innerHTML = '<div class="log-row empty">暂无记录。</div>';
        return;
      }
      const isGeneration = id === "generationLogs";
      const headers = isGeneration
        ? ["时间", "状态", "端点", "上游状态", "响应耗时"]
        : ["时间", "方法", "路径", "鉴权", "状态", "响应耗时"];
      const rows = records.map((record) => {
        const values = isGeneration
          ? [
            formatTime(record?.createdAt),
            formatStatus(record?.status),
            escapeHTML(record?.endpoint || "-"),
            escapeHTML(record?.upstreamStatus ?? "-"),
            escapeHTML((record?.durationMs ?? 0) + " ms")
          ]
          : [
            formatTime(record?.createdAt),
            escapeHTML(record?.method || "-"),
            escapeHTML(record?.path || "-"),
            escapeHTML(record?.authKind || "-"),
            formatStatus(record?.status),
            escapeHTML((record?.durationMs ?? 0) + " ms")
          ];
        return "<tr>" + values.map((value) => "<td>" + value + "</td>").join("") + "</tr>";
      }).join("");
      container.innerHTML = [
        "<table>",
        "<thead><tr>" + headers.map((header) => "<th>" + escapeHTML(header) + "</th>").join("") + "</tr></thead>",
        "<tbody>",
        rows,
        "</tbody>",
        "</table>"
      ].join("");
    }

    function safeHTTPSURL(releaseURL) {
      try {
        const parsed = new URL(releaseURL);
        return parsed.protocol === "https:" ? parsed.href : "";
      } catch {
        return "";
      }
    }

    function renderUpdate(update) {
      const current = update?.currentVersion ?? "";
      const latest = update?.latestVersion ?? "";
      const status = update?.status ?? "unknown";
      const releaseURL = update?.releaseURL ?? "";
      const safeReleaseURL = safeHTTPSURL(releaseURL);
      const rows = [
        "<strong>版本状态：" + escapeHTML(status) + "</strong>",
        "<span>当前版本：" + escapeHTML(current || "未知") + "</span>",
        "<span>仓库版本：" + escapeHTML(latest || "未知") + "</span>"
      ];
      if (safeReleaseURL) {
        rows.push('<span>Release：<a href="' + escapeHTML(safeReleaseURL) + '" rel="noreferrer" target="_blank">' + escapeHTML(safeReleaseURL) + '</a></span>');
      } else if (releaseURL) {
        rows.push("<span>Release：" + escapeHTML(releaseURL) + "</span>");
      }
      const html = rows.join("");
      document.getElementById("updateStatus").innerHTML = html;
      document.getElementById("updateStatusMirror").innerHTML = html;
    }

    async function loadDashboard() {
      try {
        const [metricsData, generationData, apiData, updateData] = await Promise.all([
          fetchAdminJSON("/metrics"),
          fetchAdminJSON("/logs?type=generations"),
          fetchAdminJSON("/logs?type=api"),
          fetchAdminJSON("/update/check")
        ]);
        renderMetrics(metricsData.metrics);
        renderRows("generationLogs", generationData.records);
        renderRows("apiLogs", apiData.records);
        renderUpdate(updateData.update);
        setStatus("数据已刷新。", "ok");
      } catch (error) {
        setStatus(error.message || "刷新失败。", "danger");
      }
    }

    async function bootstrap() {
      try {
        const session = await fetchAdminJSON("/session");
        if (!session.authenticated) {
          showLogin();
          return;
        }
        showApp(session.account);
        await loadConfig();
        await loadDashboard();
      } catch {
        showLogin();
      }
    }

    document.getElementById("loginForm").addEventListener("submit", async (event) => {
      event.preventDefault();
      setLoginStatus("正在登录...");
      try {
        const data = await fetchAdminJSON("/login", {
          method: "POST",
          body: JSON.stringify({
            username: document.getElementById("loginUsername").value,
            password: document.getElementById("loginPassword").value
          })
        });
        setLoginStatus("");
        showApp(data.account);
        await loadConfig();
        await loadDashboard();
      } catch (error) {
        setLoginStatus(error.message || "登录失败。", "danger");
      }
    });

    document.getElementById("logoutBtn").addEventListener("click", async () => {
      await fetchAdminJSON("/logout", { method: "POST", body: "{}" }).catch(() => ({}));
      showLogin();
    });

    document.getElementById("refreshBtn").addEventListener("click", loadDashboard);
    document.getElementById("loadConfigBtn").addEventListener("click", loadConfig);
    document.getElementById("loadUpstreamBtn").addEventListener("click", loadConfig);
    document.getElementById("testUpstreamBtn").addEventListener("click", async () => {
      setStatus("正在测试上游连接...");
      try {
        const data = await fetchAdminJSON("/config");
        const url = data.config?.upstreamBaseURL || "";
        if (!url) {
          setStatus("请先填写并保存上游中转站 URL。", "danger");
          return;
        }
        setStatus("上游配置已读取。当前 URL：" + url, "ok");
      } catch (error) {
        setStatus(error.message || "上游连接测试失败。", "danger");
      }
    });
    document.querySelectorAll(".nav-button").forEach((button) => {
      button.addEventListener("click", () => switchView(button.dataset.view));
    });

    document.getElementById("clientConfigForm").addEventListener("submit", async (event) => {
      event.preventDefault();
      const patch = collectConfigPatch(true);
      patch.upstreamBaseURL = undefined;
      patch.upstreamApiKey = "";
      await saveConfig(patch);
    });

    document.getElementById("upstreamConfigForm").addEventListener("submit", async (event) => {
      event.preventDefault();
      await saveConfig({
        ...collectConfigPatch(false),
        upstreamBaseURL: document.getElementById("upstreamBaseURL").value,
        upstreamApiKey: document.getElementById("upstreamApiKey").value,
        imageApiToken: ""
      });
    });

    document.getElementById("accountForm").addEventListener("submit", async (event) => {
      event.preventDefault();
      setStatus("正在保存账号...");
      try {
        const data = await fetchAdminJSON("/account", {
          method: "POST",
          body: JSON.stringify({
            username: document.getElementById("accountUsername").value,
            currentPassword: document.getElementById("currentPassword").value,
            newPassword: document.getElementById("newPassword").value
          })
        });
        document.getElementById("currentPassword").value = "";
        document.getElementById("newPassword").value = "";
        showApp(data.account);
        setStatus("账号密码已更新。", "ok");
      } catch (error) {
        setStatus(error.message || "账号保存失败。", "danger");
      }
    });

    bootstrap();
  </script>
</body>
</html>`;
}
