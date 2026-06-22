import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { renderAdminPage } from "../src/adminPage.js";

test("renderAdminPage includes admin dashboard sections", () => {
  const html = renderAdminPage();

  assert.match(html, /id="metricsPanel"/);
  assert.match(html, /id="generationLogs"/);
  assert.match(html, /id="apiLogs"/);
  assert.match(html, /id="updateStatus"/);
});

test("renderAdminPage exposes the Chinese sidebar admin system landmarks", () => {
  const html = renderAdminPage();

  assert.match(html, /登录后进入管理后台/);
  assert.match(html, /原生后台 fallback/);
  assert.match(html, /Vue Art Design Pro 后台构建产物缺失/);
  assert.match(html, /账号密码登录/);
  assert.match(html, /仪表盘/);
  assert.match(html, /接口配置/);
  assert.match(html, /上游中转站/);
  assert.match(html, /账号与安全/);
  assert.match(html, /退出登录/);
});

test("renderAdminPage exposes the operations-console template controls", () => {
  const html = renderAdminPage();

  assert.match(html, /测试上游连接/);
  assert.match(html, /调用链路/);
  assert.match(html, /<table/);
  assert.match(html, /响应耗时/);
  assert.match(html, /当前账号/);
  assert.match(html, /新增接口/);
  assert.match(html, /新增上游/);
  assert.match(html, /data-interface-field="upstreamIds"/);
});

test("renderAdminPage exposes richer dashboard operations panels", () => {
  const html = renderAdminPage();

  assert.match(html, /id="dashboardHealthPanel"/);
  assert.match(html, /id="dashboardLatencyPanel"/);
  assert.match(html, /id="dashboardUpstreamPanel"/);
  assert.match(html, /id="dashboardRecentPanel"/);
  assert.match(html, /成功率/);
  assert.match(html, /错误率/);
  assert.match(html, /上游概况/);
  assert.match(html, /最近生图任务/);
  assert.match(html, /renderDashboardExtras/);
});

test("renderAdminPage exposes log filters summaries and expandable details", () => {
  const html = renderAdminPage();

  assert.match(html, /class="log-toolbar"/);
  assert.match(html, /id="generationLogSearch"/);
  assert.match(html, /id="apiLogSearch"/);
  assert.match(html, /id="generationLogSummary"/);
  assert.match(html, /id="apiLogSummary"/);
  assert.match(html, /data-log-detail/);
  assert.match(html, /function filterRecords/);
  assert.match(html, /function renderLogTable/);
  assert.match(html, /查看详情/);
});

test("renderAdminPage shows interface and upstream configs as full width table editors", () => {
  const html = renderAdminPage();

  assert.match(html, /class="table-editor-shell"/);
  assert.match(html, /id="interfaceList"/);
  assert.match(html, /id="interfaceDetail"/);
  assert.match(html, /data-open-interface-detail/);
  assert.match(html, /id="upstreamList"/);
  assert.match(html, /id="upstreamDetail"/);
  assert.match(html, /data-open-upstream-detail/);
  assert.match(html, /点击表格行查看或编辑详情/);
});

test("renderAdminPage uses a table-first drawer editor for configs", () => {
  const html = renderAdminPage();

  assert.match(html, /id="configDrawerBackdrop"/);
  assert.match(html, /class="config-drawer-backdrop hidden"/);
  assert.match(html, /class="config-drawer"/);
  assert.match(html, /id="configDrawerTitle"/);
  assert.match(html, /id="configDrawerBody"/);
  assert.match(html, /data-close-config-drawer/);
  assert.match(html, /config-table-card/);
  assert.match(html, /编辑抽屉/);
  assert.match(html, /表格主视图 · 点击行或编辑按钮打开编辑抽屉/);
});

test("renderAdminPage lets admins reveal saved api keys in the drawer", () => {
  const html = renderAdminPage();

  assert.match(html, /data-reveal-secret/);
  assert.match(html, /data-secret-output/);
  assert.match(html, /显示已保存 Key/);
  assert.match(html, /config\/secrets/);
  assert.match(html, /隐藏 Key/);
});

test("renderAdminPage saves drawer configs directly and reports failures", () => {
  const html = renderAdminPage();

  assert.match(html, /async function saveDrawerConfig/);
  assert.match(html, /saveDrawerBtn\?\.addEventListener\("click", saveDrawerConfig\)/);
  assert.match(html, /await saveConfigFromCurrentForms\(\);\s+closeConfigDrawer\(\);/);
  assert.doesNotMatch(html, /requestSubmit/);
  assert.match(html, /保存失败/);
});

test("renderAdminPage labels service api key as the skill calling key", () => {
  const html = renderAdminPage();

  assert.match(html, /Skill 调用 Key/);
  assert.match(html, /配置到 Codex、skills、OpenClaw 或其他 AI 工具里/);
  assert.match(html, /secretRole: "client-token"/);
});

test("renderAdminPage uses one field to edit and reveal each api key", () => {
  const html = renderAdminPage();

  assert.match(html, /function secretKeyField/);
  assert.doesNotMatch(html, /function secretRevealField/);
  assert.match(html, /fieldAttribute: 'data-interface-field="apiToken"'/);
  assert.match(html, /fieldAttribute: 'data-upstream-field="apiKey"'/);
  assert.match(html, /data-secret-output/);
  assert.doesNotMatch(html, /查看已保存 Skill 调用 Key/);
  assert.doesNotMatch(html, /查看已保存上游 API Key/);
  assert.doesNotMatch(html, /readonly type="password" value=""/);
});

test("renderAdminPage validates release link protocol before rendering href", () => {
  const html = renderAdminPage();

  assert.match(html, /new URL\(releaseURL\)/);
  assert.match(html, /protocol === "https:"/);
  assert.match(html, /safeReleaseURL/);
});

test("renderAdminPage labels update source for release or main commit checks", () => {
  const html = renderAdminPage();

  assert.match(html, /update\?\.source/);
  assert.match(html, /仓库 main 版本/);
  assert.match(html, /GitHub Commit/);
  assert.match(html, /GitHub Release/);
});

test("renderAdminPage applies the console style to the dashboard shell", () => {
  const html = renderAdminPage();

  assert.match(html, /id="appShell" class="app-shell hidden" data-view="dashboardView"/);
  assert.match(html, /\.app-shell\[data-view="dashboardView"\] \.dashboard-grid/);
  assert.match(html, /\.app-shell\[data-view="dashboardView"\] \.metric\.compact/);
  assert.doesNotMatch(html, /\.app-shell\[data-view\]:not\(\[data-view="dashboardView"\]\) \.sidebar/);
  assert.match(html, /--console-primary: #111827/);
  assert.match(html, /document\.getElementById\("appShell"\)\.dataset\.view = viewId/);
});

test("renderAdminPage exposes the complete operations-console navigation", () => {
  const html = renderAdminPage();

  assert.match(html, /监控/);
  assert.match(html, /配置/);
  assert.match(html, /质量/);
  assert.match(html, /安全/);
  assert.match(html, /系统/);
  assert.match(html, /接口管理/);
  assert.match(html, /上游管理/);
  assert.match(html, /模型目录/);
  assert.match(html, /生图质量/);
  assert.match(html, /用量与成本/);
  assert.match(html, /告警中心/);
});

test("renderAdminPage exposes model catalog quality usage alert backup and session controls", () => {
  const html = renderAdminPage();

  assert.match(html, /id="modelCatalogView"/);
  assert.match(html, /id="qualityStudioView"/);
  assert.match(html, /id="usageView"/);
  assert.match(html, /id="alertsView"/);
  assert.match(html, /id="modelCatalogList"/);
  assert.match(html, /id="qualityPresetList"/);
  assert.match(html, /id="usagePanel"/);
  assert.match(html, /id="alertsPanel"/);
  assert.match(html, /id="sessionList"/);
  assert.match(html, /id="loginHistoryList"/);
  assert.match(html, /id="configVersionList"/);
  assert.match(html, /id="backupPanel"/);
  assert.match(html, /一键备份/);
  assert.match(html, /恢复配置/);
});

test("renderAdminPage exposes interface operations for key rotation tests clone and skill snippets", () => {
  const html = renderAdminPage();

  assert.match(html, /data-rotate-interface-key/);
  assert.match(html, /data-clone-interface/);
  assert.match(html, /data-test-interface/);
  assert.match(html, /data-copy-skill-snippet/);
  assert.match(html, /最后使用/);
  assert.match(html, /复制 Skill\/Codex 配置/);
  assert.match(html, /qualityPresetId/);
});

test("renderAdminPage exposes upstream health advanced log filters and export controls", () => {
  const html = renderAdminPage();

  assert.match(html, /id="upstreamHealthPanel"/);
  assert.match(html, /data-test-upstream/);
  assert.match(html, /健康状态/);
  assert.match(html, /P95/);
  assert.match(html, /id="logInterfaceFilter"/);
  assert.match(html, /id="logUpstreamFilter"/);
  assert.match(html, /id="logStatusFilter"/);
  assert.match(html, /id="logFromFilter"/);
  assert.match(html, /id="logToFilter"/);
  assert.match(html, /id="exportLogsJsonlBtn"/);
  assert.match(html, /id="exportLogsCsvBtn"/);
  assert.match(html, /复制脱敏 curl/);
  assert.match(html, /标记为质量差案例/);
  assert.match(html, /保存为优秀案例/);
});

test("native admin is explicitly marked as a fallback for missing Vue assets", async () => {
  const entrySource = await readFile(new URL("../src/index.js", import.meta.url), "utf8");
  const readme = await readFile(new URL("../../README.md", import.meta.url), "utf8");

  assert.match(entrySource, /x-image-studio-admin-ui": "native-fallback"/);
  assert.match(readme, /Vue Art Design Pro 后台/);
  assert.match(readme, /server\/src\/adminPage\.js[\s\S]*原生应急 fallback/);
});
