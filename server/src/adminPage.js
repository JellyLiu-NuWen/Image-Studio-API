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
      background: linear-gradient(180deg, #f6f9fb 0%, #edf2f6 100%);
    }
    .login-shell {
      width: min(1080px, 100%);
      display: grid;
      grid-template-columns: minmax(0, 1.15fr) minmax(360px, 420px);
      gap: 20px;
      align-items: stretch;
    }
    .login-copy {
      display: grid;
      align-content: start;
      gap: 18px;
      padding: 30px;
      border: 1px solid var(--border);
      border-radius: 16px;
      background: linear-gradient(180deg, rgba(255,255,255,0.96), rgba(245,249,252,0.96));
      box-shadow: var(--shadow);
    }
    .login-copy h1 {
      margin: 0;
      font-size: 34px;
      line-height: 1.15;
      letter-spacing: 0;
    }
    .login-copy p {
      margin: 0;
      max-width: 46ch;
      color: var(--text-muted);
      line-height: 1.7;
    }
    .login-badges {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
    .login-points {
      display: grid;
      gap: 12px;
      padding-top: 8px;
    }
    .login-point {
      display: grid;
      grid-template-columns: 28px minmax(0, 1fr);
      gap: 12px;
      align-items: start;
    }
    .login-point > span {
      width: 28px;
      height: 28px;
      display: grid;
      place-items: center;
      border-radius: 9px;
      background: var(--accent-soft);
      color: var(--accent-strong);
      font-size: 12px;
      font-weight: 800;
    }
    .login-point strong {
      display: block;
      margin-bottom: 4px;
      font-size: 14px;
      line-height: 1.35;
    }
    .login-point span:last-child {
      color: var(--text-muted);
      font-size: 13px;
      line-height: 1.55;
    }
    .login-card {
      width: 100%;
      align-self: stretch;
      display: grid;
      grid-template-columns: 1fr;
      align-content: center;
      gap: 22px;
      padding: 30px;
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
    .config-editor {
      display: grid;
      grid-template-columns: 1fr;
      gap: 12px;
    }
    .table-editor-shell {
      display: grid;
      gap: 12px;
    }
    .table-editor-toolbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      flex-wrap: wrap;
    }
    .table-editor-toolbar strong {
      margin: 0;
      font-size: 15px;
      line-height: 1.35;
      letter-spacing: 0;
    }
    .table-editor-toolbar span {
      display: block;
      margin-top: 3px;
      color: var(--text-soft);
      font-size: 12px;
      line-height: 1.45;
    }
    .config-table-card {
      min-width: 0;
      overflow: hidden;
      border: 1px solid var(--border);
      border-radius: 8px;
      background: #fff;
    }
    .config-table-wrap {
      overflow-x: auto;
      background: #fff;
    }
    .config-table {
      width: 100%;
      min-width: 1060px;
      border-collapse: collapse;
      font-size: 13px;
      line-height: 1.35;
    }
    .config-table th,
    .config-table td {
      padding: 13px 16px;
      border-bottom: 1px solid var(--border);
      text-align: left;
      vertical-align: middle;
      overflow-wrap: anywhere;
    }
    .config-table th {
      background: var(--surface-alt);
      color: var(--text-muted);
      font-size: 12px;
      font-weight: 800;
      white-space: nowrap;
    }
    .config-table th:last-child,
    .config-table td:last-child {
      position: sticky;
      right: 0;
      z-index: 1;
      background: #fff;
      box-shadow: -10px 0 16px rgba(15, 23, 42, 0.06);
    }
    .config-table th:last-child {
      z-index: 2;
      background: var(--surface-alt);
    }
    .config-table tr:last-child td { border-bottom: 0; }
    .config-table tbody tr {
      cursor: pointer;
      transition: background-color 160ms ease;
    }
    .config-table tbody tr:hover { background: #f8fbfd; }
    .config-table tbody tr:hover td:last-child { background: #f8fbfd; }
    .config-table tbody tr.active {
      background: var(--accent-soft);
      box-shadow: inset 3px 0 0 var(--accent);
    }
    .config-table tbody tr.active td:last-child { background: var(--accent-soft); }
    .config-name-cell {
      display: grid;
      gap: 4px;
      min-width: 150px;
    }
    .config-name-cell strong {
      font-size: 14px;
      line-height: 1.35;
    }
    .config-name-cell span {
      color: var(--text-soft);
      font-size: 12px;
      line-height: 1.35;
    }
    .config-url-cell,
    .config-model-cell {
      display: inline-block;
      max-width: 260px;
      overflow: hidden;
      text-overflow: ellipsis;
      vertical-align: middle;
      white-space: nowrap;
    }
    .config-key-cell {
      font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      color: var(--danger);
      font-size: 12px;
      white-space: nowrap;
    }
    .config-chip {
      display: inline-flex;
      align-items: center;
      min-height: 24px;
      padding: 0 8px;
      border: 1px solid var(--border);
      border-radius: 999px;
      background: var(--surface-alt);
      color: var(--text);
      font-size: 12px;
      font-weight: 800;
      white-space: nowrap;
    }
    .config-chip.ok {
      border-color: rgba(24, 121, 78, 0.2);
      background: rgba(24, 121, 78, 0.08);
      color: var(--success);
    }
    .config-chip.warn {
      border-color: rgba(149, 98, 22, 0.2);
      background: rgba(149, 98, 22, 0.08);
      color: var(--warning);
    }
    .config-actions {
      display: flex;
      align-items: center;
      gap: 6px;
      flex-wrap: nowrap;
    }
    .config-actions button {
      min-height: 30px;
      padding: 0 9px;
      border-radius: 7px;
      font-size: 12px;
      font-weight: 700;
    }
    .config-detail-panel {
      display: none;
    }
    .config-empty {
      padding: 18px;
      color: var(--text-muted);
      line-height: 1.55;
    }
    .config-drawer-backdrop {
      position: fixed;
      inset: 0;
      z-index: 40;
      display: flex;
      justify-content: flex-end;
      background: rgba(15, 23, 42, 0.28);
      backdrop-filter: blur(1px);
    }
    .config-drawer {
      width: min(580px, 100vw);
      height: 100vh;
      display: flex;
      flex-direction: column;
      border-left: 1px solid var(--border);
      background: #fff;
      box-shadow: -18px 0 44px rgba(15, 23, 42, 0.14);
    }
    .config-drawer-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 16px;
      padding: 18px 20px;
      border-bottom: 1px solid var(--border);
      background: #fff;
    }
    .config-drawer-header h2 {
      margin: 0;
      font-size: 18px;
      line-height: 1.3;
      letter-spacing: 0;
    }
    .config-drawer-header span {
      display: block;
      margin-top: 4px;
      color: var(--text-muted);
      font-size: 12px;
      line-height: 1.45;
    }
    .drawer-close {
      width: 34px;
      min-width: 34px;
      min-height: 34px;
      padding: 0;
      border-radius: 8px;
      background: var(--surface-soft);
      border-color: var(--border);
      color: var(--text-muted);
      font-size: 18px;
      line-height: 1;
    }
    .config-drawer-body {
      min-height: 0;
      flex: 1;
      overflow-y: auto;
      padding: 18px 20px;
      background: var(--surface-alt);
    }
    .config-drawer-actions {
      display: flex;
      justify-content: flex-end;
      gap: 10px;
      padding: 14px 20px;
      border-top: 1px solid var(--border);
      background: #fff;
    }
    .config-form-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 14px;
    }
    .config-form-grid label {
      min-width: 0;
      font-size: 13px;
    }
    .config-form-grid .full {
      grid-column: 1 / -1;
    }
    .config-form-grid input,
    .config-form-grid select {
      min-height: 40px;
      border-radius: 8px;
      background: #fff;
    }
    .config-help-line {
      margin: 0 0 14px;
      color: var(--text-muted);
      font-size: 12px;
      line-height: 1.5;
    }
    .secret-row {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 8px;
      align-items: end;
    }
    .secret-row input {
      font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    }
    .secret-row button {
      min-height: 40px;
      padding: 0 12px;
      border-radius: 8px;
      white-space: nowrap;
    }
    .secret-note {
      margin: 6px 0 0;
      color: var(--text-soft);
      font-size: 12px;
      line-height: 1.45;
    }
    .checkbox-row {
      display: flex;
      align-items: center;
      gap: 8px;
      min-height: 44px;
    }
    .checkbox-row input {
      width: 18px;
      min-height: 18px;
    }
    select[multiple] {
      min-height: 116px;
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
      .login-shell { grid-template-columns: 1fr; }
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
      .login-page { padding: 16px; }
      .login-copy,
      .login-card { padding: 20px; }
      .login-copy h1 { font-size: 28px; }
      .topbar { align-items: flex-start; flex-direction: column; }
      .topbar-actions { justify-content: flex-start; }
      .grid-4,
      .grid-2,
      .config-form-grid,
      .secret-row,
      form,
      .nav-list { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>
  <section id="loginPage" class="login-page">
    <div class="login-shell">
      <section class="login-copy">
        <div class="sidebar-brand">
          <div class="brand-mark">IS</div>
          <strong>Image Studio API</strong>
          <span>自托管生图中转管理系统</span>
        </div>
        <div>
          <h1>登录后进入管理后台</h1>
          <p>这里是你的私有控制台。你可以管理接口 Key、上游中转站、调用日志和版本对齐；生图请求仍然通过你的服务 API Key 统一转发。</p>
        </div>
        <div class="login-badges">
          <span class="pill ok">服务在线</span>
          <span class="pill">账号密码登录</span>
          <span class="pill">自托管部署</span>
          <span class="pill">日志与版本</span>
        </div>
        <div class="login-points" aria-label="登录页说明">
          <div class="login-point">
            <span>1</span>
            <div>
              <strong>先登录，再配置</strong>
              <span>登录后才能修改服务 Key、上游地址和后台账号密码。</span>
            </div>
          </div>
          <div class="login-point">
            <span>2</span>
            <div>
              <strong>调用链路清晰</strong>
              <span>Codex 或其他 AI 只需要连你的服务器，剩下的中转细节都在后台里管理。</span>
            </div>
          </div>
          <div class="login-point">
            <span>3</span>
            <div>
              <strong>版本对齐可查看</strong>
              <span>进入后台后能直接看当前版本和作者仓库版本的对比状态。</span>
            </div>
          </div>
        </div>
      </section>
      <form id="loginForm" class="login-card">
        <div>
          <h1>登录后台</h1>
          <p>使用管理员账号密码进入控制台。</p>
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
    </div>
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
          <div class="card-header"><h2>接口配置</h2><span>每个调用方可以有独立 Key、默认参数和绑定上游</span></div>
          <div class="card-body">
            <form id="clientConfigForm" class="config-editor">
              <div class="table-editor-shell">
                <div class="table-editor-toolbar">
                  <div>
                    <strong>接口列表</strong>
                    <span>表格主视图 · 点击行或编辑按钮打开编辑抽屉</span>
                  </div>
                  <button type="button" class="secondary" id="addInterfaceBtn">新增接口</button>
                </div>
                <div class="config-table-card">
                  <div id="interfaceList" class="config-table-wrap"></div>
                </div>
                <div id="interfaceDetail" class="config-detail-panel"></div>
              </div>
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
          <div class="card-header"><h2>上游中转站</h2><span>接口会按绑定顺序优先使用前面的上游，失败后自动切换</span></div>
          <div class="card-body">
            <form id="upstreamConfigForm" class="config-editor">
              <div class="table-editor-shell">
                <div class="table-editor-toolbar">
                  <div>
                    <strong>上游列表</strong>
                    <span>表格主视图 · 点击行或编辑按钮打开编辑抽屉</span>
                  </div>
                  <button type="button" class="secondary" id="addUpstreamBtn">新增上游</button>
                </div>
                <div class="config-table-card">
                  <div id="upstreamList" class="config-table-wrap"></div>
                </div>
                <div id="upstreamDetail" class="config-detail-panel"></div>
              </div>
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

  <div id="configDrawerBackdrop" class="config-drawer-backdrop hidden">
    <aside class="config-drawer" aria-label="编辑抽屉" role="dialog" aria-modal="true">
      <div class="config-drawer-header">
        <div>
          <h2 id="configDrawerTitle">编辑配置</h2>
          <span id="configDrawerSubtitle">从列表选择一项后编辑详情。</span>
        </div>
        <button type="button" class="drawer-close" aria-label="关闭编辑抽屉" data-close-config-drawer>×</button>
      </div>
      <div id="configDrawerBody" class="config-drawer-body">
        <div class="config-empty">点击表格行查看或编辑详情。</div>
      </div>
      <div class="config-drawer-actions">
        <button type="button" class="secondary" data-close-config-drawer>取消</button>
        <button type="button" class="primary" id="saveDrawerBtn">保存配置</button>
      </div>
    </aside>
  </div>

  <script>
    const views = {
      dashboardView: ["仪表盘", "查看服务状态、调用量、响应速度和生图任务概览。"],
      clientConfigView: ["接口配置", "管理给 Codex、Skill、OpenClaw 或其他 AI 工具调用的服务 Key 和默认参数。"],
      upstreamConfigView: ["上游中转站", "配置你的服务器转发到上游中转站时使用的 URL 和 Key。"],
      logsView: ["调用日志", "查看生图日志、API 调用日志和响应耗时。"],
      updatesView: ["版本更新", "检查当前版本与 GitHub Release 的对齐情况。"],
      accountView: ["账号与安全", "修改后台登录账号和密码。"]
    };
    const statusEl = document.getElementById("status");
    const loginStatusEl = document.getElementById("loginStatus");
    const configDrawerBackdrop = document.getElementById("configDrawerBackdrop");
    const configDrawerTitle = document.getElementById("configDrawerTitle");
    const configDrawerSubtitle = document.getElementById("configDrawerSubtitle");
    const configDrawerBody = document.getElementById("configDrawerBody");
    const saveDrawerBtn = document.getElementById("saveDrawerBtn");
    let currentConfig = { interfaces: [], upstreams: [] };
    let selectedInterfaceIndex = 0;
    let selectedUpstreamIndex = 0;
    let configDrawerMode = null;

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
      closeConfigDrawer();
      const username = account?.username || "admin";
      document.getElementById("currentAccount").textContent = "当前账号：" + username;
      document.getElementById("accountUsername").value = username;
    }

    function showLogin() {
      closeConfigDrawer();
      document.getElementById("appShell").classList.add("hidden");
      document.getElementById("loginPage").classList.remove("hidden");
    }

    function switchView(viewId) {
      closeConfigDrawer();
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

    function fallbackId(prefix, index) {
      return prefix + "-" + String(index + 1);
    }

    function ensureConfigShape(config) {
      const upstreams = Array.isArray(config?.upstreams) && config.upstreams.length
        ? config.upstreams
        : [{
          id: "default",
          name: "默认上游",
          enabled: true,
          baseURL: config?.upstreamBaseURL || "",
          apiKeySet: !!config?.upstreamApiKeySet
        }];
      const interfaces = Array.isArray(config?.interfaces) && config.interfaces.length
        ? config.interfaces
        : [{
          id: "default",
          name: "默认接口",
          enabled: true,
          apiTokenSet: !!config?.imageApiTokenSet,
          upstreamIds: upstreams[0]?.id ? [upstreams[0].id] : [],
          defaultImageModel: config?.defaultImageModel || "gpt-image-2",
          defaultTextModel: config?.defaultTextModel || "gpt-5.5",
          defaultSize: config?.defaultSize || "1024x1024",
          defaultQuality: config?.defaultQuality || "auto",
          defaultOutputFormat: config?.defaultOutputFormat || "png",
          requestTimeoutSeconds: config?.requestTimeoutSeconds || 120,
          maxConcurrentRequests: config?.maxConcurrentRequests || 1,
          rateLimitPerMinute: config?.rateLimitPerMinute || 10
        }];
      return {
        ...config,
        upstreams: upstreams.map((item, index) => ({
          id: item.id || fallbackId("upstream", index),
          name: item.name || "上游 " + (index + 1),
          enabled: item.enabled !== false,
          baseURL: item.baseURL || "",
          apiKeySet: !!item.apiKeySet
        })),
        interfaces: interfaces.map((item, index) => ({
          id: item.id || fallbackId("interface", index),
          name: item.name || "接口 " + (index + 1),
          enabled: item.enabled !== false,
          apiTokenSet: !!item.apiTokenSet,
          upstreamIds: Array.isArray(item.upstreamIds) ? item.upstreamIds : [],
          defaultImageModel: item.defaultImageModel || "gpt-image-2",
          defaultTextModel: item.defaultTextModel || "gpt-5.5",
          defaultSize: item.defaultSize || "1024x1024",
          defaultQuality: item.defaultQuality || "auto",
          defaultOutputFormat: item.defaultOutputFormat || "png",
          requestTimeoutSeconds: item.requestTimeoutSeconds || 120,
          maxConcurrentRequests: item.maxConcurrentRequests || 1,
          rateLimitPerMinute: item.rateLimitPerMinute || 10
        }))
      };
    }

    function qualityOptions(selected) {
      return ["auto", "low", "medium", "high"]
        .map((value) => '<option value="' + value + '"' + (value === selected ? " selected" : "") + '>' + value + '</option>')
        .join("");
    }

    function formatOptions(selected) {
      return ["png", "jpeg", "webp"]
        .map((value) => '<option value="' + value + '"' + (value === selected ? " selected" : "") + '>' + value + '</option>')
        .join("");
    }

    function upstreamOptions(selectedIds) {
      const selected = new Set(selectedIds || []);
      return currentConfig.upstreams
        .map((upstream) => '<option value="' + escapeHTML(upstream.id) + '"' + (selected.has(upstream.id) ? " selected" : "") + '>' + escapeHTML(upstream.name + " · " + upstream.id) + '</option>')
        .join("");
    }

    function clampSelectedConfig() {
      selectedInterfaceIndex = Math.min(Math.max(selectedInterfaceIndex, 0), Math.max(currentConfig.interfaces.length - 1, 0));
      selectedUpstreamIndex = Math.min(Math.max(selectedUpstreamIndex, 0), Math.max(currentConfig.upstreams.length - 1, 0));
    }

    function statusText(enabled) {
      return enabled ? "启用" : "停用";
    }

    function keyText(isSet) {
      return isSet ? "Key 已保存" : "未保存 Key";
    }

    function chip(text, kind = "") {
      return '<span class="config-chip ' + kind + '">' + escapeHTML(text) + '</span>';
    }

    function maskedKey(isSet) {
      return isSet ? '<span class="config-key-cell">sk-••••...saved</span>' : chip("未保存 Key", "warn");
    }

    function modelCell(value) {
      return '<span class="config-model-cell" title="' + escapeHTML(value || "-") + '">' + escapeHTML(value || "-") + '</span>';
    }

    function urlCell(value) {
      return '<span class="config-url-cell" title="' + escapeHTML(value || "未配置") + '">' + escapeHTML(value || "未配置") + '</span>';
    }

    function secretRevealField({ kind, id, isSet, label }) {
      const disabled = isSet ? "" : " disabled";
      const placeholder = isSet ? "点击显示 Key 后查看完整密钥" : "当前没有保存 Key";
      return [
        '<div class="full">',
        '<label>' + escapeHTML(label),
        '<div class="secret-row">',
        '<input data-secret-output="' + escapeHTML(kind) + '" readonly type="password" value="" placeholder="' + escapeHTML(placeholder) + '">',
        '<button type="button" class="secondary" data-reveal-secret="' + escapeHTML(kind) + '" data-secret-id="' + escapeHTML(id) + '"' + disabled + '>显示 Key</button>',
        '</div>',
        '</label>',
        '<p class="secret-note">默认隐藏完整 Key。只有已登录后台后，手动点击才会读取并显示。</p>',
        '</div>'
      ].join("");
    }

    function getActiveConfigForm() {
      return configDrawerMode === "upstream" ? document.getElementById("upstreamConfigForm") : document.getElementById("clientConfigForm");
    }

    function closeConfigDrawer() {
      configDrawerMode = null;
      if (configDrawerBackdrop) {
        configDrawerBackdrop.classList.add("hidden");
      }
      if (configDrawerTitle) {
        configDrawerTitle.textContent = "编辑配置";
      }
      if (configDrawerSubtitle) {
        configDrawerSubtitle.textContent = "从列表选择一项后编辑详情。";
      }
      if (configDrawerBody) {
        configDrawerBody.innerHTML = '<div class="config-empty">点击表格行查看或编辑详情。</div>';
      }
    }

    function openConfigDrawer(mode) {
      configDrawerMode = mode;
      if (configDrawerBackdrop) {
        configDrawerBackdrop.classList.remove("hidden");
      }
      renderConfigDrawer();
    }

    function renderConfigDrawer() {
      if (!configDrawerBody || !configDrawerTitle || !configDrawerSubtitle) return;
      if (configDrawerMode === "interface") {
        renderInterfaceDetail();
      } else if (configDrawerMode === "upstream") {
        renderUpstreamDetail();
      }
    }

    function syncInterfaceDetail() {
      const section = document.querySelector("[data-interface-detail-index]");
      if (!section) return;
      const index = Number(section.dataset.interfaceDetailIndex);
      if (!Number.isInteger(index) || !currentConfig.interfaces[index]) return;
      const value = (field) => section.querySelector('[data-interface-field="' + field + '"]');
      currentConfig.interfaces[index] = {
        ...currentConfig.interfaces[index],
        id: value("id").value,
        name: value("name").value,
        enabled: value("enabled").checked,
        apiToken: value("apiToken").value,
        upstreamIds: Array.from(value("upstreamIds").selectedOptions).map((option) => option.value),
        defaultImageModel: value("defaultImageModel").value,
        defaultTextModel: value("defaultTextModel").value,
        defaultSize: value("defaultSize").value,
        defaultQuality: value("defaultQuality").value,
        defaultOutputFormat: value("defaultOutputFormat").value,
        requestTimeoutSeconds: value("requestTimeoutSeconds").value,
        maxConcurrentRequests: value("maxConcurrentRequests").value,
        rateLimitPerMinute: value("rateLimitPerMinute").value
      };
    }

    function syncUpstreamDetail() {
      const section = document.querySelector("[data-upstream-detail-index]");
      if (!section) return;
      const index = Number(section.dataset.upstreamDetailIndex);
      if (!Number.isInteger(index) || !currentConfig.upstreams[index]) return;
      const value = (field) => section.querySelector('[data-upstream-field="' + field + '"]');
      currentConfig.upstreams[index] = {
        ...currentConfig.upstreams[index],
        id: value("id").value,
        name: value("name").value,
        enabled: value("enabled").checked,
        baseURL: value("baseURL").value,
        apiKey: value("apiKey").value
      };
    }

    function syncConfigDetails() {
      syncInterfaceDetail();
      syncUpstreamDetail();
    }

    function renderInterfaceList() {
      if (!currentConfig.interfaces.length) {
        document.getElementById("interfaceList").innerHTML = '<div class="config-empty">暂无接口配置。</div>';
        return;
      }
      const rows = currentConfig.interfaces.map((item, index) => [
        '<tr class="' + (index === selectedInterfaceIndex ? "active" : "") + '" data-open-interface-detail="' + index + '">',
        '<td><div class="config-name-cell"><strong>' + escapeHTML(item.name) + '</strong><span>' + escapeHTML(item.id) + '</span></div></td>',
        '<td>' + maskedKey(item.apiTokenSet || item.apiToken) + '</td>',
        '<td>' + modelCell(item.defaultImageModel) + '</td>',
        '<td>' + escapeHTML(item.defaultSize) + ' / ' + escapeHTML(item.defaultQuality) + '</td>',
        '<td>' + chip(escapeHTML(String(item.upstreamIds.length)) + " 个上游", item.upstreamIds.length ? "ok" : "warn") + '</td>',
        '<td>' + escapeHTML(item.rateLimitPerMinute) + '/分钟 · 并发 ' + escapeHTML(item.maxConcurrentRequests) + '</td>',
        '<td>' + chip(statusText(item.enabled), item.enabled ? "ok" : "warn") + '</td>',
        '<td><div class="config-actions"><button type="button" class="secondary" data-open-interface-detail="' + index + '">编辑</button><button type="button" class="danger-button" data-remove-interface="' + index + '">删除</button></div></td>',
        '</tr>'
      ].join("")).join("");
      document.getElementById("interfaceList").innerHTML = [
        '<table class="config-table">',
        '<thead><tr><th>名称</th><th>API Key</th><th>模型</th><th>尺寸/质量</th><th>绑定上游</th><th>限流</th><th>状态</th><th>操作</th></tr></thead>',
        '<tbody>' + rows + '</tbody>',
        '</table>'
      ].join("");
    }

    function renderInterfaceDetail() {
      const item = currentConfig.interfaces[selectedInterfaceIndex];
      if (!item) {
        if (configDrawerTitle) configDrawerTitle.textContent = "接口配置";
        if (configDrawerSubtitle) configDrawerSubtitle.textContent = "点击表格行查看或编辑详情。";
        if (configDrawerBody) configDrawerBody.innerHTML = '<div class="config-empty">点击表格行查看或编辑详情。</div>';
        return;
      }
      if (configDrawerTitle) configDrawerTitle.textContent = "编辑接口 · " + item.name;
      if (configDrawerSubtitle) configDrawerSubtitle.textContent = "接口详情 · " + item.id;
      if (configDrawerBody) configDrawerBody.innerHTML = [
        '<p class="config-help-line">接口配置决定 Codex、Skill 或其他工具请求时的默认模型、限流和上游绑定。</p>',
        '<section data-interface-detail-index="' + selectedInterfaceIndex + '">',
        '<div class="config-form-grid">',
        '<label>接口 ID<input data-interface-field="id" value="' + escapeHTML(item.id) + '"></label>',
        '<label>接口名称<input data-interface-field="name" value="' + escapeHTML(item.name) + '"></label>',
        '<label class="full">服务 API Key<input data-interface-field="apiToken" autocomplete="off" type="password" placeholder="' + (item.apiTokenSet ? "当前 Key 已保存，留空不修改" : "请输入服务 API Key") + '"></label>',
        secretRevealField({ kind: "interface", id: item.id, isSet: item.apiTokenSet || item.apiToken, label: "查看已保存服务 API Key" }),
        '<label class="checkbox-row"><input data-interface-field="enabled" type="checkbox"' + (item.enabled ? " checked" : "") + '>启用这个接口</label>',
        '<label>默认生图模型<input data-interface-field="defaultImageModel" value="' + escapeHTML(item.defaultImageModel) + '"></label>',
        '<label>默认文本模型<input data-interface-field="defaultTextModel" value="' + escapeHTML(item.defaultTextModel) + '"></label>',
        '<label>默认尺寸<input data-interface-field="defaultSize" value="' + escapeHTML(item.defaultSize) + '"></label>',
        '<label>默认质量<select data-interface-field="defaultQuality">' + qualityOptions(item.defaultQuality) + '</select></label>',
        '<label>默认输出格式<select data-interface-field="defaultOutputFormat">' + formatOptions(item.defaultOutputFormat) + '</select></label>',
        '<label>请求超时秒数<input data-interface-field="requestTimeoutSeconds" type="number" min="10" max="900" step="1" value="' + escapeHTML(item.requestTimeoutSeconds) + '"></label>',
        '<label>最大并发请求<input data-interface-field="maxConcurrentRequests" type="number" min="1" max="10" step="1" value="' + escapeHTML(item.maxConcurrentRequests) + '"></label>',
        '<label>每分钟限流<input data-interface-field="rateLimitPerMinute" type="number" min="1" max="600" step="1" value="' + escapeHTML(item.rateLimitPerMinute) + '"></label>',
        '<label class="full">绑定上游中转站（按选择顺序优先尝试）<select data-interface-field="upstreamIds" multiple>' + upstreamOptions(item.upstreamIds) + '</select></label>',
        '</div>',
        '</section>'
      ].join("");
    }

    function renderUpstreamList() {
      if (!currentConfig.upstreams.length) {
        document.getElementById("upstreamList").innerHTML = '<div class="config-empty">暂无上游配置。</div>';
        return;
      }
      const rows = currentConfig.upstreams.map((item, index) => [
        '<tr class="' + (index === selectedUpstreamIndex ? "active" : "") + '" data-open-upstream-detail="' + index + '">',
        '<td><div class="config-name-cell"><strong>' + escapeHTML(item.name) + '</strong><span>' + escapeHTML(item.id) + '</span></div></td>',
        '<td>' + urlCell(item.baseURL) + '</td>',
        '<td>' + maskedKey(item.apiKeySet || item.apiKey) + '</td>',
        '<td>' + chip(statusText(item.enabled), item.enabled ? "ok" : "warn") + '</td>',
        '<td><div class="config-actions"><button type="button" class="secondary" data-open-upstream-detail="' + index + '">编辑</button><button type="button" class="danger-button" data-remove-upstream="' + index + '">删除</button></div></td>',
        '</tr>'
      ].join("")).join("");
      document.getElementById("upstreamList").innerHTML = [
        '<table class="config-table">',
        '<thead><tr><th>名称</th><th>Base URL</th><th>API Key</th><th>状态</th><th>操作</th></tr></thead>',
        '<tbody>' + rows + '</tbody>',
        '</table>'
      ].join("");
    }

    function renderUpstreamDetail() {
      const item = currentConfig.upstreams[selectedUpstreamIndex];
      if (!item) {
        if (configDrawerTitle) configDrawerTitle.textContent = "上游中转站";
        if (configDrawerSubtitle) configDrawerSubtitle.textContent = "点击表格行查看或编辑详情。";
        if (configDrawerBody) configDrawerBody.innerHTML = '<div class="config-empty">点击表格行查看或编辑详情。</div>';
        return;
      }
      if (configDrawerTitle) configDrawerTitle.textContent = "编辑上游 · " + item.name;
      if (configDrawerSubtitle) configDrawerSubtitle.textContent = "上游详情 · " + item.id;
      if (configDrawerBody) configDrawerBody.innerHTML = [
        '<p class="config-help-line">上游中转站会按接口绑定顺序优先尝试，失败后自动切换到下一个可用上游。</p>',
        '<section data-upstream-detail-index="' + selectedUpstreamIndex + '">',
        '<div class="config-form-grid">',
        '<label>上游 ID<input data-upstream-field="id" value="' + escapeHTML(item.id) + '"></label>',
        '<label>上游名称<input data-upstream-field="name" value="' + escapeHTML(item.name) + '"></label>',
        '<label class="full">Base URL<input data-upstream-field="baseURL" value="' + escapeHTML(item.baseURL) + '" placeholder="https://example.com/v1"></label>',
        '<label class="full">上游 API Key<input data-upstream-field="apiKey" autocomplete="off" type="password" placeholder="' + (item.apiKeySet ? "当前 Key 已保存，留空不修改" : "请输入上游 Key") + '"></label>',
        secretRevealField({ kind: "upstream", id: item.id, isSet: item.apiKeySet || item.apiKey, label: "查看已保存上游 API Key" }),
        '<label class="checkbox-row"><input data-upstream-field="enabled" type="checkbox"' + (item.enabled ? " checked" : "") + '>启用这个上游</label>',
        '</div>',
        '</section>'
      ].join("");
    }

    function renderConfigEditors() {
      clampSelectedConfig();
      renderUpstreamList();
      renderInterfaceList();
      if (configDrawerMode) {
        renderConfigDrawer();
      }
    }

    function fillConfig(config) {
      currentConfig = ensureConfigShape(config);
      renderConfigEditors();
      document.getElementById("accountUsername").value = currentConfig.adminUsername || "admin";
    }

    async function loadConfig() {
      setStatus("正在加载配置...");
      const data = await fetchAdminJSON("/config");
      fillConfig(data.config);
      setStatus("配置已加载。", "ok");
      return data.config;
    }

    function readInterfaceForms() {
      syncInterfaceDetail();
      return currentConfig.interfaces;
    }

    function readUpstreamForms() {
      syncUpstreamDetail();
      return currentConfig.upstreams;
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
    document.getElementById("addInterfaceBtn").addEventListener("click", () => {
      syncInterfaceDetail();
      const index = currentConfig.interfaces.length;
      currentConfig.interfaces.push({
        id: fallbackId("interface", index),
        name: "接口 " + (index + 1),
        enabled: true,
        apiTokenSet: false,
        upstreamIds: currentConfig.upstreams[0]?.id ? [currentConfig.upstreams[0].id] : [],
        defaultImageModel: "gpt-image-2",
        defaultTextModel: "gpt-5.5",
        defaultSize: "1024x1024",
        defaultQuality: "auto",
        defaultOutputFormat: "png",
        requestTimeoutSeconds: 120,
        maxConcurrentRequests: 1,
        rateLimitPerMinute: 10
      });
      selectedInterfaceIndex = index;
      renderConfigEditors();
      openConfigDrawer("interface");
    });
    document.getElementById("addUpstreamBtn").addEventListener("click", () => {
      syncConfigDetails();
      const index = currentConfig.upstreams.length;
      currentConfig.upstreams.push({
        id: fallbackId("upstream", index),
        name: "上游 " + (index + 1),
        enabled: true,
        baseURL: "",
        apiKeySet: false
      });
      selectedUpstreamIndex = index;
      renderConfigEditors();
      openConfigDrawer("upstream");
    });
    document.getElementById("interfaceList").addEventListener("click", (event) => {
      const removeButton = event.target.closest("[data-remove-interface]");
      if (removeButton) {
        event.stopPropagation();
        if (currentConfig.interfaces.length <= 1) {
          setStatus("至少保留一个接口配置。", "danger");
          return;
        }
        syncInterfaceDetail();
        const index = Number(removeButton.dataset.removeInterface);
        currentConfig.interfaces.splice(index, 1);
        selectedInterfaceIndex = Math.min(index, currentConfig.interfaces.length - 1);
        renderConfigEditors();
        if (configDrawerMode === "interface") {
          openConfigDrawer("interface");
        }
        return;
      }
      const openTarget = event.target.closest("[data-open-interface-detail]");
      if (!openTarget) return;
      syncInterfaceDetail();
      selectedInterfaceIndex = Number(openTarget.dataset.openInterfaceDetail);
      renderInterfaceList();
      openConfigDrawer("interface");
    });
    document.getElementById("upstreamList").addEventListener("click", (event) => {
      const removeButton = event.target.closest("[data-remove-upstream]");
      if (removeButton) {
        event.stopPropagation();
        if (currentConfig.upstreams.length <= 1) {
          setStatus("至少保留一个上游中转站。", "danger");
          return;
        }
        syncConfigDetails();
        const index = Number(removeButton.dataset.removeUpstream);
        const removed = currentConfig.upstreams.splice(index, 1)[0];
        currentConfig.interfaces = currentConfig.interfaces.map((item) => ({
          ...item,
          upstreamIds: item.upstreamIds.filter((id) => id !== removed.id)
        }));
        selectedUpstreamIndex = Math.min(index, currentConfig.upstreams.length - 1);
        renderConfigEditors();
        if (configDrawerMode === "upstream") {
          openConfigDrawer("upstream");
        }
        return;
      }
      const openTarget = event.target.closest("[data-open-upstream-detail]");
      if (!openTarget) return;
      syncUpstreamDetail();
      selectedUpstreamIndex = Number(openTarget.dataset.openUpstreamDetail);
      renderUpstreamList();
      openConfigDrawer("upstream");
    });
    configDrawerBackdrop?.addEventListener("click", (event) => {
      if (event.target === configDrawerBackdrop || event.target.closest("[data-close-config-drawer]")) {
        syncConfigDetails();
        closeConfigDrawer();
      }
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && configDrawerMode) {
        syncConfigDetails();
        closeConfigDrawer();
      }
    });
    saveDrawerBtn?.addEventListener("click", () => {
      const activeForm = getActiveConfigForm();
      activeForm?.requestSubmit?.();
    });
    configDrawerBody?.addEventListener("click", async (event) => {
      const button = event.target.closest("[data-reveal-secret]");
      if (!button) return;
      const kind = button.dataset.revealSecret;
      const id = button.dataset.secretId;
      const output = configDrawerBody.querySelector('[data-secret-output="' + kind + '"]');
      if (!output || !id) return;
      if (output.type === "text" && output.value) {
        output.type = "password";
        button.textContent = "显示 Key";
        return;
      }
      button.disabled = true;
      button.textContent = "读取中";
      try {
        const data = await fetchAdminJSON("/config/secrets?kind=" + encodeURIComponent(kind) + "&id=" + encodeURIComponent(id));
        output.value = data.secret?.value || "";
        output.type = "text";
        button.textContent = "隐藏 Key";
      } catch (error) {
        output.value = "";
        output.type = "password";
        setStatus(error.message || "读取 Key 失败。", "danger");
        button.textContent = "显示 Key";
      } finally {
        button.disabled = false;
      }
    });
    document.getElementById("testUpstreamBtn").addEventListener("click", async () => {
      setStatus("正在测试上游连接...");
      try {
        const firstEnabled = readUpstreamForms().find((item) => item.enabled && item.baseURL);
        if (!firstEnabled) {
          setStatus("请先填写并保存上游中转站 URL。", "danger");
          return;
        }
        setStatus("上游配置已读取。当前优先测试：" + firstEnabled.name + " · " + firstEnabled.baseURL, "ok");
      } catch (error) {
        setStatus(error.message || "上游连接测试失败。", "danger");
      }
    });
    document.querySelectorAll(".nav-button").forEach((button) => {
      button.addEventListener("click", () => switchView(button.dataset.view));
    });

    document.getElementById("clientConfigForm").addEventListener("submit", async (event) => {
      event.preventDefault();
      syncConfigDetails();
      await saveConfig({
        interfaces: readInterfaceForms(),
        upstreams: readUpstreamForms()
      });
    });

    document.getElementById("upstreamConfigForm").addEventListener("submit", async (event) => {
      event.preventDefault();
      syncConfigDetails();
      await saveConfig({
        interfaces: readInterfaceForms(),
        upstreams: readUpstreamForms()
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
