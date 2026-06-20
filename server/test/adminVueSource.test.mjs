import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const APP_SOURCE_URL = new URL("../../admin/src/App.vue", import.meta.url);

async function readAppSource() {
  return readFile(APP_SOURCE_URL, "utf8");
}

function sourceBetween(source, start, end) {
  const startIndex = source.indexOf(start);
  assert.notEqual(startIndex, -1, `Missing start marker: ${start}`);
  const endIndex = source.indexOf(end, startIndex);
  assert.notEqual(endIndex, -1, `Missing end marker: ${end}`);
  return source.slice(startIndex, endIndex);
}

test("Vue model catalog exposes the complete model capability fields", async () => {
  const source = await readAppSource();
  const modelSection = sourceBetween(
    source,
    "<section v-if=\"activeView === 'models'\"",
    "<section v-if=\"activeView === 'quality'\"",
  );
  const modelDrawer = sourceBetween(
    source,
    "drawerMode === 'model'",
    "drawerMode === 'quality'",
  );

  for (const label of ["模型 ID", "能力", "尺寸", "质量", "默认格式", "推荐用途", "绑定上游", "启用"]) {
    assert.match(modelSection, new RegExp(label), `Model table should expose ${label}`);
  }

  assert.match(modelDrawer, /defaultOutputFormat/, "Model drawer should edit the default output format");
  assert.match(modelDrawer, /upstreamIds/, "Model drawer should edit upstream bindings");
  assert.match(modelDrawer, /activeUpstreams/, "Model drawer should use configured upstream choices");
});

test("Vue interface and upstream tables expose masked key previews", async () => {
  const source = await readAppSource();
  const interfaceSection = sourceBetween(
    source,
    "<section v-if=\"activeView === 'interfaces'\"",
    "<section v-if=\"activeView === 'upstreams'\"",
  );
  const upstreamSection = sourceBetween(
    source,
    "<section v-if=\"activeView === 'upstreams'\"",
    "<section v-if=\"activeView === 'models'\"",
  );

  assert.match(interfaceSection, /apiTokenPreview/, "Interface table should show the masked client key suffix");
  assert.match(upstreamSection, /apiKeyPreview/, "Upstream table should show the masked upstream key suffix");
});

test("Vue admin shell exposes an Art Design Pro style theme switch", async () => {
  const source = await readAppSource();
  const shellSection = sourceBetween(
    source,
    "<div v-else class=\"admin-shell\"",
    "<main class=\"admin-main\">",
  );
  const topbarSection = sourceBetween(
    source,
    "<header class=\"admin-topbar\">",
    "</header>",
  );
  const styleSource = await readFile(new URL("../../admin/src/styles/art-design-admin.css", import.meta.url), "utf8");

  assert.match(source, /themeMode/, "Admin shell should track a theme mode state");
  assert.match(source, /toggleTheme/, "Admin shell should expose a theme toggle action");
  assert.match(shellSection, /data-theme/, "Admin shell should bind the current theme to a data attribute");
  assert.match(topbarSection, /主题/, "Topbar should expose a visible theme switch control");
  assert.match(styleSource, /\.admin-shell\[data-theme="dark"\]/, "Styles should define dark theme variables");
});

test("Vue dashboard exposes trend and status distribution visualizations", async () => {
  const source = await readAppSource();
  const dashboardSection = sourceBetween(
    source,
    "<section v-if=\"activeView === 'dashboard'\"",
    "<section v-if=\"activeView === 'interfaces'\"",
  );
  const styleSource = await readFile(new URL("../../admin/src/styles/art-design-admin.css", import.meta.url), "utf8");

  assert.match(source, /usageTrendBars/, "Dashboard should compute usage trend bars from usage buckets");
  assert.match(source, /statusDistribution/, "Dashboard should compute success and failure distribution");
  assert.match(dashboardSection, /usage-trend/, "Dashboard should render the usage trend chart area");
  assert.match(dashboardSection, /status-distribution/, "Dashboard should render the status distribution chart area");
  assert.match(styleSource, /\.usage-trend/, "Styles should include trend chart layout");
  assert.match(styleSource, /\.status-distribution/, "Styles should include status distribution layout");
});

test("Vue shell exposes Art Design Pro workspace navigation and quick actions", async () => {
  const source = await readAppSource();
  const shellSection = sourceBetween(
    source,
    "<main class=\"admin-main\">",
    "<section v-if=\"activeView === 'dashboard'\"",
  );
  const styleSource = await readFile(new URL("../../admin/src/styles/art-design-admin.css", import.meta.url), "utf8");

  assert.match(source, /pageTabs/, "Shell should keep an opened page tab list");
  assert.match(source, /navigateTo/, "Shell should route view changes through a navigation helper");
  assert.match(source, /closePageTab/, "Shell should allow closing opened page tabs");
  assert.match(source, /breadcrumbItems/, "Shell should compute breadcrumb items for the active module");
  assert.match(source, /quickActions/, "Shell should expose high-frequency admin quick actions");
  assert.match(source, /riskItems/, "Shell should expose operational risk summaries");
  assert.match(shellSection, /page-breadcrumb/, "Shell should render an Art Design Pro style breadcrumb row");
  assert.match(shellSection, /page-tabs/, "Shell should render route-like page tabs");
  assert.match(shellSection, /operations-panel/, "Shell should render an operations panel below the topbar");
  assert.match(shellSection, /quick-actions/, "Operations panel should render quick action buttons");
  assert.match(shellSection, /risk-board/, "Operations panel should render the risk summary board");
  assert.match(styleSource, /\.page-tabs/, "Styles should include page tab layout");
  assert.match(styleSource, /\.operations-panel/, "Styles should include the operations panel layout");
  assert.match(styleSource, /\.quick-actions/, "Styles should include quick action layout");
  assert.match(styleSource, /\.risk-board/, "Styles should include risk board layout");
});

test("Vue management tables use an Art Design Pro style table workspace", async () => {
  const source = await readAppSource();
  const interfaceSection = sourceBetween(
    source,
    "<section v-if=\"activeView === 'interfaces'\"",
    "<section v-if=\"activeView === 'upstreams'\"",
  );
  const upstreamSection = sourceBetween(
    source,
    "<section v-if=\"activeView === 'upstreams'\"",
    "<section v-if=\"activeView === 'models'\"",
  );
  const modelSection = sourceBetween(
    source,
    "<section v-if=\"activeView === 'models'\"",
    "<section v-if=\"activeView === 'quality'\"",
  );
  const qualitySection = sourceBetween(
    source,
    "<section v-if=\"activeView === 'quality'\"",
    "<section v-if=\"activeView === 'logs'\"",
  );
  const styleSource = await readFile(new URL("../../admin/src/styles/art-design-admin.css", import.meta.url), "utf8");

  assert.match(source, /tableSearch/, "Admin should keep a shared table search state");
  assert.match(source, /tableDensity/, "Admin should keep a shared table density state");
  assert.match(source, /tableSize/, "Admin should map table density to Element Plus table size");
  assert.match(source, /filteredInterfaces/, "Interface table should have a filtered data source");
  assert.match(source, /filteredUpstreams/, "Upstream table should have a filtered data source");
  assert.match(source, /filteredModels/, "Model table should have a filtered data source");
  assert.match(source, /filteredPresets/, "Quality preset table should have a filtered data source");

  for (const section of [interfaceSection, upstreamSection, modelSection, qualitySection]) {
    assert.match(section, /table-workspace/, "Management section should render a table workspace wrapper");
    assert.match(section, /table-toolbar/, "Management section should render a table toolbar");
    assert.match(section, /tableSearch/, "Management section should expose module search");
    assert.match(section, /tableDensity/, "Management section should expose density controls");
    assert.match(section, /:size="tableSize"/, "Management table should respect density size");
  }

  assert.match(interfaceSection, /filteredInterfaces/, "Interface table should render filtered rows");
  assert.match(upstreamSection, /filteredUpstreams/, "Upstream table should render filtered rows");
  assert.match(modelSection, /filteredModels/, "Model table should render filtered rows");
  assert.match(qualitySection, /filteredPresets/, "Quality preset table should render filtered rows");
  assert.match(styleSource, /\.table-workspace/, "Styles should include table workspace layout");
  assert.match(styleSource, /\.table-toolbar/, "Styles should include table toolbar layout");
  assert.match(styleSource, /\.toolbar-meta/, "Styles should include compact table meta styling");
});

test("Vue logs page uses an Art Design Pro query and results workspace", async () => {
  const source = await readAppSource();
  const logSection = sourceBetween(
    source,
    "<section v-if=\"activeView === 'logs'\"",
    "<section v-if=\"activeView === 'usage'\"",
  );
  const styleSource = await readFile(new URL("../../admin/src/styles/art-design-admin.css", import.meta.url), "utf8");

  assert.match(source, /logSummaryCards/, "Logs page should compute summary cards for generation and API logs");
  assert.match(source, /activeLogTab/, "Logs page should keep the active log tab state");
  assert.match(logSection, /log-workspace/, "Logs page should render a workspace wrapper");
  assert.match(logSection, /log-summary-grid/, "Logs page should render compact summary cards");
  assert.match(logSection, /query-panel/, "Logs page should render a query panel");
  assert.match(logSection, /query-grid/, "Query panel should use a structured grid layout");
  assert.match(logSection, /result-toolbar/, "Logs page should render a result toolbar above tables");
  assert.match(logSection, /v-model="activeLogTab"/, "Logs tabs should bind the active tab");
  assert.match(logSection, /:size="tableSize"/, "Logs tables should respect shared density size");
  assert.match(logSection, /刷新日志/, "Result toolbar should include a clear refresh action");
  assert.match(styleSource, /\.log-workspace/, "Styles should include log workspace layout");
  assert.match(styleSource, /\.log-summary-grid/, "Styles should include log summary layout");
  assert.match(styleSource, /\.query-panel/, "Styles should include query panel layout");
  assert.match(styleSource, /\.result-toolbar/, "Styles should include result toolbar layout");
});

test("Vue security page uses an Art Design Pro security workspace", async () => {
  const source = await readAppSource();
  const securitySection = sourceBetween(
    source,
    "<section v-if=\"activeView === 'security'\"",
    "<section v-if=\"activeView === 'system'\"",
  );
  const styleSource = await readFile(new URL("../../admin/src/styles/art-design-admin.css", import.meta.url), "utf8");

  assert.match(source, /securityScore/, "Security page should compute an overall security score");
  assert.match(source, /securitySummaryCards/, "Security page should compute security summary cards");
  assert.match(source, /loginHistoryRows/, "Security page should compute recent login history rows");
  assert.match(securitySection, /security-workspace/, "Security page should render a workspace wrapper");
  assert.match(securitySection, /security-overview/, "Security page should render a security overview area");
  assert.match(securitySection, /security-score-card/, "Security page should render a score card");
  assert.match(securitySection, /security-summary-grid/, "Security page should render summary cards");
  assert.match(securitySection, /security-policy-grid/, "Security page should render policy controls in a grid");
  assert.match(securitySection, /session-workspace/, "Security page should render session workspace");
  assert.match(securitySection, /audit-workspace/, "Security page should render audit workspace");
  assert.match(securitySection, /:size="tableSize"/, "Security tables should respect shared density size");
  assert.match(styleSource, /\.security-workspace/, "Styles should include security workspace layout");
  assert.match(styleSource, /\.security-overview/, "Styles should include security overview layout");
  assert.match(styleSource, /\.security-summary-grid/, "Styles should include security summary grid layout");
  assert.match(styleSource, /\.security-policy-grid/, "Styles should include security policy grid layout");
  assert.match(styleSource, /\.session-workspace/, "Styles should include session workspace styling");
});
