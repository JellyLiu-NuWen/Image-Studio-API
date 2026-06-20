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

test("Vue login page uses an Art Design Pro access workspace", async () => {
  const source = await readAppSource();
  const loginSection = sourceBetween(
    source,
    "<div v-if=\"!authenticated\"",
    "<div v-else class=\"admin-shell\"",
  );
  const styleSource = await readFile(new URL("../../admin/src/styles/art-design-admin.css", import.meta.url), "utf8");

  assert.match(loginSection, /login-workspace/, "Login page should render a template-style workspace wrapper");
  assert.match(loginSection, /login-status-panel/, "Login page should render an operational status panel");
  assert.match(loginSection, /login-signal-grid/, "Login page should render compact system signal cards");
  assert.match(loginSection, /login-access-panel/, "Login page should render a dedicated access panel");
  assert.match(loginSection, /login-security-strip/, "Login page should render login security affordances");
  assert.match(styleSource, /\.login-workspace/, "Styles should include login workspace layout");
  assert.match(styleSource, /\.login-status-panel/, "Styles should include login status panel styling");
  assert.match(styleSource, /\.login-signal-grid/, "Styles should include login signal cards");
  assert.match(styleSource, /\.login-access-panel/, "Styles should include login access panel styling");
  assert.match(styleSource, /\.login-security-strip/, "Styles should include login security strip styling");
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

test("Vue page tabs behave like an Art Design Pro worktab bar", async () => {
  const source = await readAppSource();
  const tabSection = sourceBetween(
    source,
    "<nav class=\"page-tabs art-work-tab\"",
    "<section class=\"operations-panel\"",
  );
  const styleSource = await readFile(new URL("../../admin/src/styles/art-design-admin.css", import.meta.url), "utf8");

  assert.match(source, /fixedPageTabs/, "Worktab state should track fixed tabs");
  assert.match(source, /workTabActions/, "Worktab should expose Art Design style bulk actions");
  assert.match(source, /closePageTabsToLeft/, "Worktab should close tabs to the left");
  assert.match(source, /closePageTabsToRight/, "Worktab should close tabs to the right");
  assert.match(source, /closeOtherPageTabs/, "Worktab should close other tabs");
  assert.match(source, /closeAllPageTabs/, "Worktab should close all non-fixed tabs");
  assert.match(source, /toggleFixedPageTab/, "Worktab should toggle fixed tabs");
  assert.match(source, /refreshCurrentPageTab/, "Worktab should refresh the active module");
  assert.match(tabSection, /art-work-tab/, "Page tabs should use the Art Design worktab shell class");
  assert.match(tabSection, /worktab-scroll/, "Worktab should keep scrollable tab content");
  assert.match(tabSection, /worktab-action-trigger/, "Worktab should expose a dropdown trigger");
  assert.match(tabSection, /@contextmenu\.prevent/, "Worktab should support a context menu action on tabs");
  assert.match(tabSection, /isPageTabFixed/, "Worktab should show fixed state");
  assert.match(tabSection, /workTabActions/, "Worktab dropdown should render bulk actions");
  assert.match(styleSource, /\.art-work-tab/, "Styles should include Art Design worktab shell");
  assert.match(styleSource, /\.worktab-scroll/, "Styles should include worktab scroll area");
  assert.match(styleSource, /\.worktab-action-trigger/, "Styles should include worktab action trigger");
});

test("Vue topbar exposes Art Design Pro header tools", async () => {
  const source = await readAppSource();
  const topbarSection = sourceBetween(
    source,
    "<header class=\"admin-topbar\">",
    "</header>",
  );
  const styleSource = await readFile(new URL("../../admin/src/styles/art-design-admin.css", import.meta.url), "utf8");

  assert.match(source, /headerSearchKeyword/, "Topbar should keep a global search keyword");
  assert.match(source, /headerSearchResults/, "Topbar should compute global search results");
  assert.match(source, /toggleFullscreen/, "Topbar should expose fullscreen switching");
  assert.match(topbarSection, /header-tools/, "Topbar should render a template-style tools group");
  assert.match(topbarSection, /global-search/, "Topbar should render a global search control");
  assert.match(topbarSection, /notification-entry/, "Topbar should render a notification entry");
  assert.match(topbarSection, /settings-entry/, "Topbar should render a settings entry");
  assert.match(topbarSection, /user-entry/, "Topbar should render a user entry");
  assert.match(styleSource, /\.header-tools/, "Styles should include header tools layout");
  assert.match(styleSource, /\.global-search/, "Styles should include global search layout");
  assert.match(styleSource, /\.notification-entry/, "Styles should include notification entry styling");
  assert.match(styleSource, /\.settings-entry/, "Styles should include settings entry styling");
  assert.match(styleSource, /\.user-entry/, "Styles should include user entry styling");
});

test("Vue topbar notifications use an Art Design Pro notification panel", async () => {
  const source = await readAppSource();
  const topbarSection = sourceBetween(
    source,
    "<header class=\"admin-topbar\">",
    "</header>",
  );
  const notificationPanel = sourceBetween(
    source,
    "<div v-if=\"notificationPanelVisible\"",
    "<el-dialog v-model=\"globalSearchVisible\"",
  );
  const styleSource = await readFile(new URL("../../admin/src/styles/art-design-admin.css", import.meta.url), "utf8");

  assert.match(source, /notificationPanelVisible/, "Admin should keep notification panel visibility state");
  assert.match(source, /notificationTabs/, "Notification panel should define Art Design style tabs");
  assert.match(source, /notificationPreviewItems/, "Notification panel should derive preview items from alert state");
  assert.match(source, /activeNotificationTab/, "Notification panel should track the selected tab");
  assert.match(source, /viewAllNotifications/, "Notification panel should keep a full alert center action");
  assert.match(topbarSection, /@click="toggleNotificationPanel"/, "Notification button should toggle a panel");
  assert.doesNotMatch(sourceBetween(source, "function openNotifications()", "function openSettings()"), /navigateTo\('alerts'\)/, "Opening notifications should not immediately navigate away");
  assert.match(notificationPanel, /art-notification-panel/, "Notification preview should use Art Design panel class");
  assert.match(notificationPanel, /notification-tab-bar/, "Notification panel should render tabs");
  assert.match(notificationPanel, /notification-list/, "Notification panel should render preview list");
  assert.match(notificationPanel, /notification-empty/, "Notification panel should render an empty state");
  assert.match(notificationPanel, /@click="viewAllNotifications"/, "Notification panel should link to the full alerts page");
  assert.match(styleSource, /\.art-notification-panel/, "Styles should include notification panel shell");
  assert.match(styleSource, /\.notification-tab-bar/, "Styles should include notification tabs");
  assert.match(styleSource, /\.notification-list/, "Styles should include notification list");
});

test("Vue global search uses an Art Design Pro command dialog", async () => {
  const source = await readAppSource();
  const topbarSection = sourceBetween(
    source,
    "<header class=\"admin-topbar\">",
    "</header>",
  );
  const searchDialog = sourceBetween(
    source,
    "<el-dialog v-model=\"globalSearchVisible\"",
    "<el-drawer v-model=\"settingsPanelVisible\"",
  );
  const styleSource = await readFile(new URL("../../admin/src/styles/art-design-admin.css", import.meta.url), "utf8");

  assert.match(source, /globalSearchVisible/, "Admin should keep command dialog visibility state");
  assert.match(source, /highlightedSearchIndex/, "Command dialog should track the highlighted result");
  assert.match(source, /openGlobalSearch/, "Topbar should open the command dialog");
  assert.match(source, /handleGlobalSearchKeydown/, "Command dialog should handle keyboard shortcuts");
  assert.match(source, /document\.addEventListener\('keydown', handleGlobalSearchKeydown\)/, "Global search should register Ctrl/Command+K");
  assert.match(topbarSection, /@click="openGlobalSearch"/, "Search trigger should open the command dialog");
  assert.match(searchDialog, /global-search-command/, "Search should render a command dialog");
  assert.match(searchDialog, /command-search-input/, "Command dialog should include a focused search input");
  assert.match(searchDialog, /command-result-list/, "Command dialog should render command results");
  assert.match(searchDialog, /command-shortcuts/, "Command dialog should show keyboard affordances");
  assert.match(searchDialog, /@click="selectHeaderSearch/, "Command results should navigate to modules");
  assert.match(styleSource, /\.global-search-command/, "Styles should include command dialog shell");
  assert.match(styleSource, /\.command-result-list/, "Styles should include command result list");
  assert.match(styleSource, /\.command-shortcuts/, "Styles should include keyboard shortcut footer");
});

test("Vue topbar settings open an Art Design Pro settings panel", async () => {
  const source = await readAppSource();
  const topbarSection = sourceBetween(
    source,
    "<header class=\"admin-topbar\">",
    "</header>",
  );
  const settingsDrawer = sourceBetween(
    source,
    "<el-drawer v-model=\"settingsPanelVisible\"",
    "<el-drawer v-model=\"drawerVisible\"",
  );
  const styleSource = await readFile(new URL("../../admin/src/styles/art-design-admin.css", import.meta.url), "utf8");

  assert.match(source, /settingsPanelVisible/, "Admin should keep settings panel visibility state");
  assert.match(source, /layoutMode/, "Admin should keep a menu layout preference state");
  assert.match(source, /menuStyleMode/, "Admin should keep a menu style preference state");
  assert.match(source, /settingsOptions/, "Admin should expose Art Design style settings options");
  assert.match(source, /applySettingsPreset/, "Admin should expose a settings option action");
  assert.match(topbarSection, /@click="openSettings"/, "Settings entry should open the settings panel");
  assert.doesNotMatch(sourceBetween(source, "function openSettings()", "function closePageTab"), /navigateTo\('system'\)/, "Opening settings should not navigate away from the current page");
  assert.match(settingsDrawer, /art-settings-panel/, "Settings should render an Art Design settings panel drawer");
  assert.match(settingsDrawer, /setting-panel-header/, "Settings panel should render a template-style header");
  assert.match(settingsDrawer, /setting-section/g, "Settings panel should group preferences into sections");
  assert.match(settingsDrawer, /setting-option-grid/, "Settings panel should render selectable option cards");
  assert.match(settingsDrawer, /v-model="themeMode"/, "Settings panel should control the shell theme");
  assert.match(settingsDrawer, /v-model="tableDensity"/, "Settings panel should control table density");
  assert.match(styleSource, /\.art-settings-panel/, "Styles should include the settings panel shell");
  assert.match(styleSource, /\.setting-option-grid/, "Styles should include settings option card layout");
  assert.match(styleSource, /\.setting-panel-header/, "Styles should include settings panel header styling");
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

test("Vue tables expose Art Design Pro empty states", async () => {
  const source = await readAppSource();
  const managementSection = sourceBetween(
    source,
    "<section v-if=\"activeView === 'interfaces'\"",
    "<section v-if=\"activeView === 'logs'\"",
  );
  const logSection = sourceBetween(
    source,
    "<section v-if=\"activeView === 'logs'\"",
    "<section v-if=\"activeView === 'usage'\"",
  );
  const systemSection = sourceBetween(
    source,
    "<section v-if=\"activeView === 'system'\"",
    "</main>",
  );
  const styleSource = await readFile(new URL("../../admin/src/styles/art-design-admin.css", import.meta.url), "utf8");

  assert.match(source, /emptyStateCopy/, "Admin should centralize empty-state copy");
  assert.match(managementSection, /#empty/g, "Management tables should provide custom empty slots");
  assert.match(logSection, /#empty/g, "Log tables should provide custom empty slots");
  assert.match(systemSection, /#empty/g, "System tables should provide custom empty slots");
  assert.match(source, /art-empty-state/g, "Tables should render the shared Art Design empty state");
  assert.match(styleSource, /\.art-empty-state/, "Styles should include the shared empty-state shell");
  assert.match(styleSource, /\.table-workspace :deep\(\.el-table__empty-block\)/, "Styles should give empty tables stable template-like height");
});

test("Vue config drawer uses an Art Design Pro form workspace", async () => {
  const source = await readAppSource();
  const drawerSection = sourceBetween(
    source,
    "<el-drawer v-model=\"drawerVisible\"",
    "<el-drawer v-model=\"logDetailVisible\"",
  );
  const styleSource = await readFile(new URL("../../admin/src/styles/art-design-admin.css", import.meta.url), "utf8");

  assert.match(source, /drawerContext/, "Config drawer should compute the edited item context");
  assert.match(source, /drawerStatusCards/, "Config drawer should compute status summary cards");
  assert.match(drawerSection, /config-drawer/, "Config drawer should apply a dedicated workspace class");
  assert.match(drawerSection, /drawer-overview/, "Config drawer should render an overview header");
  assert.match(drawerSection, /drawer-status-grid/, "Config drawer should render status cards");
  assert.match(drawerSection, /drawer-section/, "Config drawer should group fields into sections");
  assert.match(drawerSection, /drawer-form-grid/, "Config drawer should use a structured field grid");
  assert.match(drawerSection, /drawer-footer-actions/, "Config drawer should render a sticky action bar");
  assert.match(styleSource, /\.config-drawer/, "Styles should include config drawer styling");
  assert.match(styleSource, /\.drawer-overview/, "Styles should include drawer overview styling");
  assert.match(styleSource, /\.drawer-status-grid/, "Styles should include drawer status card styling");
  assert.match(styleSource, /\.drawer-form-grid/, "Styles should include drawer form grid styling");
  assert.match(styleSource, /\.drawer-footer-actions/, "Styles should include drawer footer action styling");
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

test("Vue log detail drawer uses an Art Design Pro detail workspace", async () => {
  const source = await readAppSource();
  const detailDrawer = sourceBetween(
    source,
    "<el-drawer v-model=\"logDetailVisible\"",
    "</el-drawer>",
  );
  const styleSource = await readFile(new URL("../../admin/src/styles/art-design-admin.css", import.meta.url), "utf8");

  assert.match(source, /logDetailSummaryCards/, "Log detail drawer should compute compact summary cards");
  assert.match(source, /logDetailRouteSteps/, "Log detail drawer should compute route step data");
  assert.match(detailDrawer, /log-detail-drawer/, "Log detail drawer should apply a dedicated workspace class");
  assert.match(detailDrawer, /detail-overview/, "Log detail drawer should render an overview header");
  assert.match(detailDrawer, /detail-summary-grid/, "Log detail drawer should render summary cards");
  assert.match(detailDrawer, /detail-route-steps/, "Log detail drawer should render route steps");
  assert.match(detailDrawer, /detail-action-bar/, "Log detail drawer should render an action bar");
  assert.match(styleSource, /\.log-detail-drawer/, "Styles should include log detail drawer styling");
  assert.match(styleSource, /\.detail-overview/, "Styles should include detail overview styling");
  assert.match(styleSource, /\.detail-summary-grid/, "Styles should include detail summary styling");
  assert.match(styleSource, /\.detail-route-steps/, "Styles should include route step styling");
  assert.match(styleSource, /\.detail-action-bar/, "Styles should include detail action bar styling");
});

test("Vue usage page uses an Art Design Pro analytics workspace", async () => {
  const source = await readAppSource();
  const usageSection = sourceBetween(
    source,
    "<section v-if=\"activeView === 'usage'\"",
    "<section v-if=\"activeView === 'alerts'\"",
  );
  const styleSource = await readFile(new URL("../../admin/src/styles/art-design-admin.css", import.meta.url), "utf8");

  assert.match(source, /usageSummaryCards/, "Usage page should compute compact KPI summary cards");
  assert.match(source, /usageCostLeaders/, "Usage page should compute cost leader rows");
  assert.match(source, /usageEfficiencyRows/, "Usage page should compute efficiency diagnostics");
  assert.match(usageSection, /usage-workspace/, "Usage page should render a workspace wrapper");
  assert.match(usageSection, /usage-summary-grid/, "Usage page should render compact usage summary cards");
  assert.match(usageSection, /usage-analytics-grid/, "Usage page should render an analytics grid");
  assert.match(usageSection, /usage-trend-workspace/, "Usage page should render a dedicated trend workspace");
  assert.match(usageSection, /usage-breakdown-workspace/, "Usage page should render a breakdown table workspace");
  assert.match(usageSection, /result-toolbar/, "Usage page should render a result toolbar above tables");
  assert.match(usageSection, /:size="tableSize"/, "Usage tables should respect shared density size");
  assert.match(styleSource, /\.usage-workspace/, "Styles should include usage workspace layout");
  assert.match(styleSource, /\.usage-summary-grid/, "Styles should include usage summary layout");
  assert.match(styleSource, /\.usage-analytics-grid/, "Styles should include usage analytics grid layout");
  assert.match(styleSource, /\.usage-breakdown-workspace/, "Styles should include usage breakdown workspace styling");
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

test("Vue system page uses an Art Design Pro backup and update workspace", async () => {
  const source = await readAppSource();
  const systemSection = sourceBetween(
    source,
    "<section v-if=\"activeView === 'system'\"",
    "</main>",
  );
  const styleSource = await readFile(new URL("../../admin/src/styles/art-design-admin.css", import.meta.url), "utf8");

  assert.match(source, /systemSummaryCards/, "System page should compute backup and update summary cards");
  assert.match(source, /latestBackup/, "System page should compute the latest retained backup");
  assert.match(systemSection, /system-workspace/, "System page should render a workspace wrapper");
  assert.match(systemSection, /system-summary-grid/, "System page should render compact system summary cards");
  assert.match(systemSection, /backup-workspace/, "System page should render a backup workspace");
  assert.match(systemSection, /version-workspace/, "System page should render a config version workspace");
  assert.match(systemSection, /update-workspace/, "System page should render an update workspace");
  assert.match(systemSection, /:size="tableSize"/, "System tables should respect shared density size");
  assert.match(styleSource, /\.system-workspace/, "Styles should include system workspace layout");
  assert.match(styleSource, /\.system-summary-grid/, "Styles should include system summary grid layout");
  assert.match(styleSource, /\.backup-workspace/, "Styles should include backup workspace styling");
  assert.match(styleSource, /\.update-workspace/, "Styles should include update workspace styling");
});

test("Vue alerts page uses an Art Design Pro alert center workspace", async () => {
  const source = await readAppSource();
  const alertsSection = sourceBetween(
    source,
    "<section v-if=\"activeView === 'alerts'\"",
    "<section v-if=\"activeView === 'security'\"",
  );
  const styleSource = await readFile(new URL("../../admin/src/styles/art-design-admin.css", import.meta.url), "utf8");

  assert.match(source, /alertSummaryCards/, "Alerts page should compute alert summary cards");
  assert.match(source, /pendingAlertCount/, "Alerts page should compute pending alert count");
  assert.match(alertsSection, /alerts-workspace/, "Alerts page should render a workspace wrapper");
  assert.match(alertsSection, /alerts-summary-grid/, "Alerts page should render compact alert summary cards");
  assert.match(alertsSection, /alert-queue-workspace/, "Alerts page should render an alert queue workspace");
  assert.match(alertsSection, /alert-rules-workspace/, "Alerts page should render alert rules workspace");
  assert.match(alertsSection, /notification-workspace/, "Alerts page should render notification workspace");
  assert.match(alertsSection, /:size="tableSize"/, "Alert table should respect shared density size");
  assert.match(styleSource, /\.alerts-workspace/, "Styles should include alerts workspace layout");
  assert.match(styleSource, /\.alerts-summary-grid/, "Styles should include alert summary grid layout");
  assert.match(styleSource, /\.alert-queue-workspace/, "Styles should include alert queue workspace styling");
  assert.match(styleSource, /\.alert-rules-workspace/, "Styles should include alert rules workspace styling");
});
