export function renderAdminPage() {
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Image Studio Self-Hosted API</title>
  <style>
    :root {
      color-scheme: light;
      --bg: #eef1f4;
      --surface: #ffffff;
      --surface-alt: #f7f9fb;
      --surface-soft: #f2f5f8;
      --border: #d7dde5;
      --border-strong: #c7d0da;
      --text: #17212b;
      --text-muted: #5d6b7b;
      --text-soft: #7a8795;
      --accent: #196c5f;
      --accent-strong: #14584e;
      --accent-soft: #e6f3f0;
      --success: #1b7f4d;
      --warning: #9a5b12;
      --danger: #b42318;
      --shadow: 0 16px 45px rgba(17, 24, 39, 0.08);
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      background: var(--bg);
      color: var(--text);
    }
    * { box-sizing: border-box; }
    html { background: var(--bg); }
    body {
      margin: 0;
      min-height: 100vh;
      padding: 24px;
      background:
        linear-gradient(180deg, rgba(255,255,255,0.5), rgba(255,255,255,0)),
        var(--bg);
      color: var(--text);
    }
    a {
      color: var(--accent);
      text-decoration: none;
    }
    a:hover { text-decoration: underline; }
    .shell {
      width: min(1320px, 100%);
      margin: 0 auto;
      display: grid;
      gap: 16px;
    }
    .topbar {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 16px;
      padding: 20px 22px;
      border: 1px solid var(--border);
      border-radius: 14px;
      background: rgba(255, 255, 255, 0.82);
      backdrop-filter: blur(10px);
      box-shadow: var(--shadow);
    }
    .brand {
      display: grid;
      gap: 8px;
      min-width: 0;
    }
    .eyebrow {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      width: fit-content;
      padding: 5px 10px;
      border-radius: 999px;
      background: var(--accent-soft);
      color: var(--accent-strong);
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0;
      line-height: 1.2;
    }
    .eyebrow-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--success);
      box-shadow: 0 0 0 4px rgba(27, 127, 77, 0.12);
      flex: 0 0 auto;
    }
    h1 {
      margin: 0;
      font-size: 26px;
      line-height: 1.15;
      letter-spacing: 0;
    }
    .subtitle {
      margin: 0;
      max-width: 72ch;
      color: var(--text-muted);
      line-height: 1.6;
    }
    .topbar-meta {
      display: grid;
      gap: 8px;
      justify-items: end;
      text-align: right;
      min-width: 180px;
    }
    .meta-line {
      display: flex;
      flex-wrap: wrap;
      justify-content: flex-end;
      gap: 8px;
    }
    .pill {
      display: inline-flex;
      align-items: center;
      min-height: 28px;
      padding: 0 10px;
      border: 1px solid var(--border);
      border-radius: 999px;
      background: #fff;
      color: var(--text-muted);
      font-size: 12px;
      font-weight: 600;
      line-height: 1;
      white-space: nowrap;
    }
    .pill.ok {
      border-color: rgba(27, 127, 77, 0.2);
      background: rgba(27, 127, 77, 0.08);
      color: var(--success);
    }
    .pill.muted {
      background: var(--surface-alt);
    }
    .status {
      min-height: 20px;
      color: var(--text-muted);
      font-size: 13px;
      line-height: 1.45;
    }
    .layout {
      display: grid;
      grid-template-columns: minmax(0, 1.25fr) minmax(320px, 0.75fr);
      gap: 16px;
      align-items: start;
    }
    .card {
      border: 1px solid var(--border);
      border-radius: 14px;
      background: var(--surface);
      box-shadow: var(--shadow);
      min-width: 0;
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
    .card-header .hint {
      color: var(--text-soft);
      font-size: 12px;
      line-height: 1.4;
      text-align: right;
    }
    .card-body {
      padding: 18px 20px 20px;
    }
    .summary-grid {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 10px;
    }
    .metric {
      display: grid;
      gap: 8px;
      min-width: 0;
      padding: 14px;
      border: 1px solid var(--border);
      border-radius: 12px;
      background: var(--surface-alt);
    }
    .metric span {
      color: var(--text-soft);
      font-size: 12px;
      line-height: 1.35;
      letter-spacing: 0;
    }
    .metric strong {
      font-size: 24px;
      line-height: 1.1;
      letter-spacing: 0;
      overflow-wrap: anywhere;
    }
    .metric small {
      color: var(--text-muted);
      font-size: 12px;
      line-height: 1.35;
    }
    .stack {
      display: grid;
      gap: 16px;
    }
    form {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 14px;
    }
    label {
      display: grid;
      gap: 7px;
      font-size: 13px;
      font-weight: 700;
      color: var(--text);
    }
    label.full { grid-column: 1 / -1; }
    input, select {
      width: 100%;
      min-height: 44px;
      border: 1px solid var(--border-strong);
      border-radius: 10px;
      padding: 10px 12px;
      font: inherit;
      background: #fff;
      color: var(--text);
      transition: border-color 160ms ease, box-shadow 160ms ease, background-color 160ms ease;
    }
    input::placeholder { color: #94a0ad; }
    input:focus,
    select:focus {
      outline: none;
      border-color: rgba(25, 108, 95, 0.55);
      box-shadow: 0 0 0 4px rgba(25, 108, 95, 0.12);
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
      font-weight: 700;
      cursor: pointer;
      transition: transform 160ms ease, background-color 160ms ease, border-color 160ms ease, color 160ms ease, box-shadow 160ms ease;
    }
    button:hover { transform: translateY(-1px); }
    button:focus-visible {
      outline: none;
      box-shadow: 0 0 0 4px rgba(25, 108, 95, 0.14);
    }
    button.primary {
      background: var(--accent);
      color: #fff;
      border-color: var(--accent);
      box-shadow: 0 10px 24px rgba(25, 108, 95, 0.18);
    }
    button.primary:hover {
      background: var(--accent-strong);
      border-color: var(--accent-strong);
    }
    button.secondary {
      background: var(--surface-soft);
      color: var(--text);
      border-color: var(--border);
    }
    button.secondary:hover {
      background: #e9eef3;
      border-color: #c9d3dd;
    }
    .dashboard-grid {
      display: grid;
      gap: 16px;
    }
    .panel {
      border-top: 1px solid var(--border);
      padding-top: 16px;
    }
    .panel:first-child {
      border-top: 0;
      padding-top: 0;
    }
    .section-title {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: 12px;
      margin-bottom: 12px;
    }
    .section-title h3,
    .section-title h2 {
      margin: 0;
      font-size: 15px;
      line-height: 1.3;
    }
    .section-title span {
      color: var(--text-soft);
      font-size: 12px;
      line-height: 1.4;
    }
    .log-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 16px;
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
      color: var(--text);
      font-size: 13px;
      line-height: 1.45;
      overflow-wrap: anywhere;
    }
    .log-row:first-child { border-top: 0; padding-top: 0; }
    .log-row.empty { color: var(--text-soft); }
    .log-row strong { color: var(--text); }
    .log-row.ok strong { color: var(--success); }
    .log-row.danger strong { color: var(--danger); }
    .log-row .meta {
      color: var(--text-muted);
      font-size: 12px;
      line-height: 1.4;
    }
    .update-card {
      display: grid;
      gap: 12px;
    }
    .update-card .update-status {
      display: grid;
      gap: 6px;
      padding: 14px;
      border: 1px solid var(--border);
      border-radius: 12px;
      background: var(--surface-alt);
    }
    .update-card .update-status strong {
      font-size: 15px;
      line-height: 1.3;
    }
    .update-card .update-status span {
      color: var(--text-muted);
      font-size: 13px;
      line-height: 1.45;
      overflow-wrap: anywhere;
    }
    .muted {
      color: var(--text-muted);
    }
    .compact {
      font-size: 12px;
      line-height: 1.4;
    }
    @media (max-width: 1100px) {
      .layout { grid-template-columns: 1fr; }
      .topbar { flex-direction: column; }
      .topbar-meta { justify-items: start; text-align: left; }
      .meta-line { justify-content: flex-start; }
    }
    @media (max-width: 820px) {
      body { padding: 16px; }
      .summary-grid,
      .log-grid { grid-template-columns: 1fr; }
      form { grid-template-columns: 1fr; }
      .card-header,
      .section-title { align-items: flex-start; flex-direction: column; }
    }
  </style>
</head>
<body>
  <main class="shell">
    <header class="topbar">
      <div class="brand">
        <span class="eyebrow"><span class="eyebrow-dot"></span>Service online</span>
        <h1>Image Studio Self-Hosted API</h1>
        <p class="subtitle">A private image API console for your own server. Configure upstream access, watch request metrics, and keep the client token separate from your upstream key.</p>
      </div>
      <div class="topbar-meta" aria-label="Service status">
        <div class="meta-line">
          <span class="pill ok">Self-hosted</span>
          <span class="pill muted">v1.2.5</span>
        </div>
        <div class="status" id="status">Load config to begin.</div>
      </div>
    </header>

    <section class="summary-grid" aria-label="Live operations summary">
      <div class="metric">
        <span>Active requests</span>
        <strong id="summaryActive">0</strong>
        <small>Current in-flight calls</small>
      </div>
      <div class="metric">
        <span>API success</span>
        <strong id="summaryApiSuccess">0</strong>
        <small>Authorized service calls</small>
      </div>
      <div class="metric">
        <span>Generation success</span>
        <strong id="summaryGenSuccess">0</strong>
        <small>Completed image jobs</small>
      </div>
      <div class="metric">
        <span>P95 latency</span>
        <strong id="summaryLatency">0ms</strong>
        <small>Latest response tail</small>
      </div>
    </section>

    <section class="layout" aria-label="Admin workspace">
      <section class="card">
        <div class="card-header">
          <div>
            <h2>Configuration</h2>
            <div class="hint">Keep secrets on the server. Blank secret fields preserve the saved value.</div>
          </div>
        </div>
        <div class="card-body">
          <form id="configForm">
            <label class="full">Admin Token
              <input id="adminToken" autocomplete="off" type="password" placeholder="ADMIN_TOKEN">
            </label>
            <label class="full">Upstream Base URL
              <input id="upstreamBaseURL" placeholder="https://api.openai.com/v1">
            </label>
            <label class="full">Upstream API Key
              <input id="upstreamApiKey" autocomplete="off" type="password" placeholder="Leave blank to keep current key">
            </label>
            <label class="full">Image API Token
              <input id="imageApiToken" autocomplete="off" type="password" placeholder="Leave blank to keep current token">
            </label>
            <label>Default Image Model
              <input id="defaultImageModel" placeholder="gpt-image-2">
            </label>
            <label>Default Text Model
              <input id="defaultTextModel" placeholder="gpt-5.5">
            </label>
            <label>Default Size
              <input id="defaultSize" placeholder="1024x1024">
            </label>
            <label>Default Quality
              <select id="defaultQuality">
                <option value="auto">auto</option>
                <option value="low">low</option>
                <option value="medium">medium</option>
                <option value="high">high</option>
              </select>
            </label>
            <label>Default Output Format
              <select id="defaultOutputFormat">
                <option value="png">png</option>
                <option value="jpeg">jpeg</option>
                <option value="webp">webp</option>
              </select>
            </label>
            <label>Request Timeout Seconds
              <input id="requestTimeoutSeconds" type="number" min="10" max="900" step="1">
            </label>
            <label>Max Concurrent Requests
              <input id="maxConcurrentRequests" type="number" min="1" max="10" step="1">
            </label>
            <label>Rate Limit Per Minute
              <input id="rateLimitPerMinute" type="number" min="1" max="600" step="1">
            </label>
            <div class="actions">
              <button type="button" class="secondary" id="loadBtn">Load Config</button>
              <button type="button" class="secondary" id="dashboardBtn">Refresh Dashboard</button>
              <button type="submit" class="primary">Save Config</button>
            </div>
          </form>
        </div>
      </section>

      <section class="stack">
        <section class="card">
          <div class="card-header">
            <div>
              <h2>Live Operations</h2>
              <div class="hint">Metrics and version check refresh from the server API.</div>
            </div>
          </div>
          <div class="card-body dashboard-grid">
            <div class="panel">
              <div class="section-title">
                <h3>Metrics</h3>
                <span>Response speed and throughput</span>
              </div>
              <div id="metricsPanel">
                <div class="muted">No metrics loaded yet.</div>
              </div>
            </div>
            <div class="panel update-card">
              <div class="section-title">
                <h3>Update status</h3>
                <span>Current release versus upstream</span>
              </div>
              <div id="updateStatus" class="update-status">
                <strong>Update status is not connected yet.</strong>
                <span>Load the dashboard to check version alignment.</span>
              </div>
            </div>
          </div>
        </section>

        <section class="card">
          <div class="card-header">
            <div>
              <h2>Recent Activity</h2>
              <div class="hint">Image jobs and API calls are recorded separately.</div>
            </div>
          </div>
          <div class="card-body">
            <div class="log-grid">
              <div class="panel">
                <div class="section-title">
                  <h3>Generation Logs</h3>
                  <span>Recent image requests</span>
                </div>
                <div id="generationLogs" class="log-list">
                  <div class="log-row empty">No records yet.</div>
                </div>
              </div>
              <div class="panel">
                <div class="section-title">
                  <h3>API Logs</h3>
                  <span>Recent API calls</span>
                </div>
                <div id="apiLogs" class="log-list">
                  <div class="log-row empty">No records yet.</div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </section>
    </section>
  </main>
  <script>
    const fields = [
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
    const secretFields = ["upstreamApiKey", "imageApiToken"];
    const statusEl = document.getElementById("status");
    const adminTokenEl = document.getElementById("adminToken");

    function tokenHeader() {
      return { authorization: "Bearer " + adminTokenEl.value.trim() };
    }

    function setStatus(message, kind = "") {
      statusEl.textContent = message;
      statusEl.className = "status " + kind;
    }

    function escapeHTML(value) {
      return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");
    }

    async function fetchAdminJSON(path) {
      const response = await fetch("/api" + path, { headers: tokenHeader() });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error?.message || "Request failed.");
      }
      return data;
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
        '<div class="summary-grid">',
        metricCard("API total", api.total ?? 0, "All tracked API calls"),
        metricCard("API error", api.error ?? 0, "Rejected or failed calls"),
        metricCard("Generation total", generations.total ?? 0, "All tracked image jobs"),
        metricCard("Generation error", generations.failed ?? 0, "Failed image jobs"),
        metricCard("API p50", (api.p50DurationMs ?? 0) + "ms", "Median API response time"),
        metricCard("API p95", (api.p95DurationMs ?? 0) + "ms", "Tail latency"),
        metricCard("Generation p50", (generations.p50DurationMs ?? 0) + "ms", "Median generation time"),
        metricCard("Generation p95", (generations.p95DurationMs ?? 0) + "ms", "Tail generation time"),
        '</div>'
      ].join("");
    }

    function summarizeRecord(record) {
      const parts = [];
      for (const key of ["createdAt", "path", "endpoint", "method", "status", "upstreamStatus", "durationMs"]) {
        if (record?.[key] !== undefined) parts.push(key + ": " + record[key]);
      }
      return parts.length ? parts.join(" | ") : JSON.stringify(record);
    }

    function renderRows(id, records) {
      const container = document.getElementById(id);
      if (!Array.isArray(records) || records.length === 0) {
        container.innerHTML = '<div class="log-row empty">No records yet.</div>';
        return;
      }
      container.innerHTML = records.map((record) => (
        '<div class="log-row ' + escapeHTML(record?.status === "error" ? "danger" : "ok") + '">' +
        '<strong>' + escapeHTML(record?.status ?? record?.method ?? "record") + '</strong>' +
        '<div>' + escapeHTML(summarizeRecord(record)) + '</div>' +
        '</div>'
      )).join("");
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
      const container = document.getElementById("updateStatus");
      const current = update?.currentVersion ?? "";
      const latest = update?.latestVersion ?? "";
      const status = update?.status ?? "unknown";
      const releaseURL = update?.releaseURL ?? "";
      const safeReleaseURL = safeHTTPSURL(releaseURL);
      const rows = [
        "<strong>Version status: " + escapeHTML(status) + "</strong>",
        "<span>Current: " + escapeHTML(current || "unknown") + "</span>",
        "<span>Latest: " + escapeHTML(latest || "unknown") + "</span>"
      ];
      if (safeReleaseURL) {
        rows.push('<span>Release: <a href="' + escapeHTML(safeReleaseURL) + '" rel="noreferrer" target="_blank">' + escapeHTML(safeReleaseURL) + '</a></span>');
      } else if (releaseURL) {
        rows.push("<span>Release: " + escapeHTML(releaseURL) + "</span>");
      }
      container.className = "update-status";
      container.innerHTML = rows.join("");
    }

    async function checkUpdate() {
      const container = document.getElementById("updateStatus");
      container.className = "update-status";
      container.innerHTML = "<strong>Checking for updates...</strong><span>Comparing the running release with upstream.</span>";
      const data = await fetchAdminJSON("/update/check");
      renderUpdate(data.update);
    }

    async function loadDashboard() {
      if (!adminTokenEl.value.trim()) return;
      checkUpdate().catch((error) => {
        const container = document.getElementById("updateStatus");
        container.className = "update-status";
        container.innerHTML = "<strong class='danger'>Update check failed.</strong><span>" + escapeHTML(error.message || "Unable to refresh update status.") + "</span>";
      });
      try {
        const [metricsData, generationData, apiData] = await Promise.all([
          fetchAdminJSON("/metrics"),
          fetchAdminJSON("/logs?type=generations"),
          fetchAdminJSON("/logs?type=api")
        ]);
        renderMetrics(metricsData.metrics);
        renderRows("generationLogs", generationData.records);
        renderRows("apiLogs", apiData.records);
      } catch (error) {
        setStatus(error.message || "Failed to load dashboard.", "danger");
      }
    }

    function fillConfig(config) {
      for (const name of fields) {
        document.getElementById(name).value = config[name] ?? "";
      }
      document.getElementById("upstreamApiKey").placeholder = config.upstreamApiKeySet
        ? "Current key is saved. Leave blank to keep it."
        : "No key saved yet.";
      document.getElementById("imageApiToken").placeholder = config.imageApiTokenSet
        ? "Current token is saved. Leave blank to keep it."
        : "No token saved yet.";
      for (const name of secretFields) document.getElementById(name).value = "";
    }

    async function loadConfig() {
      if (!adminTokenEl.value.trim()) {
        setStatus("Enter ADMIN_TOKEN first.", "danger");
        return;
      }
      setStatus("Loading...");
      const response = await fetch("/api/config", { headers: tokenHeader() });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setStatus(data.error?.message || "Failed to load config.", "danger");
        return;
      }
      fillConfig(data.config);
      setStatus("Config loaded.", "ok");
      await loadDashboard();
    }

    async function saveConfig(event) {
      event.preventDefault();
      if (!adminTokenEl.value.trim()) {
        setStatus("Enter ADMIN_TOKEN first.", "danger");
        return;
      }
      const body = {};
      for (const name of fields.concat(secretFields)) {
        body[name] = document.getElementById(name).value;
      }
      setStatus("Saving...");
      const response = await fetch("/api/config", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...tokenHeader()
        },
        body: JSON.stringify(body)
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setStatus(data.error?.message || "Failed to save config.", "danger");
        return;
      }
      fillConfig(data.config);
      setStatus("Config saved.", "ok");
    }

    document.getElementById("loadBtn").addEventListener("click", loadConfig);
    document.getElementById("dashboardBtn").addEventListener("click", loadDashboard);
    document.getElementById("configForm").addEventListener("submit", saveConfig);
  </script>
</body>
</html>`;
}
