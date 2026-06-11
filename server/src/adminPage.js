export function renderAdminPage() {
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Image Studio Self-Hosted API</title>
  <style>
    :root {
      color-scheme: light dark;
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      background: #f7f7f4;
      color: #1f2328;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      display: grid;
      place-items: center;
      padding: 32px 16px;
    }
    main {
      width: min(880px, 100%);
      background: #ffffff;
      border: 1px solid #d8d8d0;
      border-radius: 8px;
      padding: 24px;
      box-shadow: 0 18px 50px rgba(31, 35, 40, 0.08);
    }
    h1 {
      margin: 0 0 6px;
      font-size: 24px;
      line-height: 1.2;
    }
    p {
      margin: 0 0 20px;
      color: #59636e;
      line-height: 1.6;
    }
    form {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 16px;
    }
    label {
      display: grid;
      gap: 6px;
      font-size: 13px;
      font-weight: 650;
      color: #394049;
    }
    label.full { grid-column: 1 / -1; }
    input, select {
      width: 100%;
      min-height: 42px;
      border: 1px solid #c8c8bf;
      border-radius: 6px;
      padding: 9px 11px;
      font: inherit;
      background: #fff;
      color: #1f2328;
    }
    input::placeholder { color: #8a929a; }
    .actions {
      grid-column: 1 / -1;
      display: flex;
      align-items: center;
      gap: 12px;
      flex-wrap: wrap;
      margin-top: 4px;
    }
    button {
      border: 0;
      border-radius: 6px;
      min-height: 42px;
      padding: 0 16px;
      font: inherit;
      font-weight: 700;
      cursor: pointer;
      background: #176b5f;
      color: #fff;
    }
    button.secondary {
      background: #eef1f3;
      color: #1f2328;
      border: 1px solid #d5dade;
    }
    .status {
      min-height: 24px;
      color: #59636e;
    }
    .danger { color: #a5332a; }
    .ok { color: #176b5f; }
    @media (max-width: 720px) {
      main { padding: 18px; }
      form { grid-template-columns: 1fr; }
    }
    @media (prefers-color-scheme: dark) {
      :root { background: #111416; color: #f4f4f0; }
      main { background: #181c1f; border-color: #30363d; box-shadow: none; }
      p, .status { color: #a8b0b8; }
      label { color: #d7dce1; }
      input, select { background: #101316; color: #f4f4f0; border-color: #394049; }
      button.secondary { background: #23292e; color: #f4f4f0; border-color: #394049; }
    }
  </style>
</head>
<body>
  <main>
    <h1>Image Studio Self-Hosted API</h1>
    <p>Use this page to configure the private API service. Blank secret fields keep the existing saved values.</p>
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
        <button type="submit">Save Config</button>
        <span id="status" class="status"></span>
      </div>
    </form>
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
    document.getElementById("configForm").addEventListener("submit", saveConfig);
  </script>
</body>
</html>`;
}
