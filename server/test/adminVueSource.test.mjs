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

test("Vue dashboard uses an Art Design Pro console card list", async () => {
  const source = await readAppSource();
  const dashboardSection = sourceBetween(
    source,
    "<section v-if=\"activeView === 'dashboard'\"",
    "<section v-if=\"activeView === 'interfaces'\"",
  );
  const styleSource = await readFile(new URL("../../admin/src/styles/art-design-admin.css", import.meta.url), "utf8");

  assert.match(source, /dashboardSummaryCards/, "Dashboard should compute console summary cards");
  assert.match(dashboardSection, /art-console-card-list/, "Dashboard metric row should use the console card-list shell");
  assert.match(dashboardSection, /v-for="item in dashboardSummaryCards"/, "Dashboard should render summary cards from metadata");
  assert.match(dashboardSection, /art-console-stat-card/, "Dashboard should render Art Design stat cards");
  assert.match(dashboardSection, /console-stat-body/, "Dashboard cards should use the template card body layout");
  assert.match(dashboardSection, /console-stat-trend/, "Dashboard cards should include the template trend row");
  assert.match(dashboardSection, /console-stat-icon/, "Dashboard cards should include the right-side icon block");
  assert.match(dashboardSection, /<component :is="item.icon"/, "Dashboard card icons should be data-driven");
  assert.doesNotMatch(dashboardSection, /metric-card/, "Dashboard cards should not keep the legacy metric-card class");
  assert.match(styleSource, /\.art-console-card-list/, "Styles should include the console card-list grid");
  assert.match(styleSource, /\.art-console-stat-card/, "Styles should include console stat card styling");
  assert.match(styleSource, /\.console-stat-body/, "Styles should include the console stat card body");
  assert.match(styleSource, /\.console-stat-trend/, "Styles should include the console stat trend row");
  assert.match(styleSource, /\.console-stat-icon/, "Styles should include console stat icon blocks");
  assert.doesNotMatch(styleSource, /\.metric-card\b/, "Styles should remove the legacy metric card rules");
});

test("Vue dashboard chart modules use Art Design Pro console panels", async () => {
  const source = await readAppSource();
  const dashboardSection = sourceBetween(
    source,
    "<section v-if=\"activeView === 'dashboard'\"",
    "<section v-if=\"activeView === 'interfaces'\"",
  );
  const styleSource = await readFile(new URL("../../admin/src/styles/art-design-admin.css", import.meta.url), "utf8");

  assert.match(dashboardSection, /art-console-panel/g, "Dashboard modules should use the console panel card shell");
  assert.match(dashboardSection, /art-console-section-grid/g, "Dashboard modules should use Art console section grids");
  assert.match(dashboardSection, /art-console-status-list/, "Dashboard status summary should use an Art console status list");
  assert.doesNotMatch(dashboardSection, /content-grid/, "Dashboard modules should not keep the legacy content-grid class");
  assert.doesNotMatch(dashboardSection, /class="status-list"/, "Dashboard modules should not keep the legacy status-list class");
  assert.match(dashboardSection, /console-panel-header/g, "Dashboard modules should render template-style panel headers");
  assert.match(dashboardSection, /console-panel-title/g, "Dashboard modules should render compact title blocks");
  assert.match(dashboardSection, /console-panel-badge/g, "Dashboard module headers should include status badges");
  assert.match(dashboardSection, /console-panel-action/g, "Dashboard module headers should expose small action affordances");
  assert.match(dashboardSection, /@click="navigateTo\('usage'\)"/, "Usage trend panel should link to usage details");
  assert.match(dashboardSection, /@click="navigateTo\('logs'\)"/, "Failure panel should link to logs");
  assert.match(styleSource, /\.art-console-panel/, "Styles should include console panel shell");
  assert.match(styleSource, /\.art-console-section-grid/, "Styles should include Art console section grid layout");
  assert.match(styleSource, /\.art-console-status-list/, "Styles should include Art console status list styling");
  assert.doesNotMatch(styleSource, /\.content-grid\b/, "Styles should remove the legacy content grid selector");
  assert.match(styleSource, /\.console-panel-header/, "Styles should include console panel header");
  assert.match(styleSource, /\.console-panel-badge/, "Styles should include console panel status badges");
  assert.match(styleSource, /\.console-panel-action/, "Styles should include console panel action buttons");
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

test("Vue page modules render inside an Art Design Pro page content container", async () => {
  const source = await readAppSource();
  const contentSection = sourceBetween(
    source,
    "<div class=\"layout-content\"",
    "<div v-if=\"notificationPanelVisible\"",
  );
  const styleSource = await readFile(new URL("../../admin/src/styles/art-design-admin.css", import.meta.url), "utf8");

  assert.match(source, /pageContentRefreshing/, "Page content should track refresh state");
  assert.match(source, /pageTransitionName/, "Page content should expose an Art Design transition name");
  assert.match(source, /showPageTransitionMask/, "Page content should expose a transition mask state");
  assert.match(source, /reloadPageContent/, "Page content should support content refresh reloads");
  assert.match(contentSection, /class="layout-content"/, "Main modules should sit inside the ArtPageContent shell");
  assert.match(contentSection, /id="app-content-header"/, "Page content should include the template header slot anchor");
  assert.match(contentSection, /<Transition :name="pageTransitionName" mode="out-in" appear>/, "Page content should use Vue transitions for module changes");
  assert.match(contentSection, /class="art-page-view"/, "Active module body should use the Art Design page view class");
  assert.match(contentSection, /page-transition-mask/, "Page content should render a transition mask");
  assert.match(styleSource, /\.layout-content/, "Styles should include ArtPageContent layout shell");
  assert.match(styleSource, /\.art-page-view/, "Styles should include Art page view");
  assert.match(styleSource, /\.page-transition-mask/, "Styles should include transition mask");
  assert.match(styleSource, /\.slide-left-enter-active/, "Styles should include slide-left page transition");
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
  assert.match(topbarSection, /art-header-actions/, "Topbar should render an Art header action group");
  assert.match(topbarSection, /header-tools/, "Topbar should render a template-style tools group");
  assert.doesNotMatch(topbarSection, /topbar-actions/, "Topbar should not keep the generic topbar-actions class");
  assert.match(topbarSection, /global-search/, "Topbar should render a global search control");
  assert.match(topbarSection, /notification-entry/, "Topbar should render a notification entry");
  assert.match(topbarSection, /settings-entry/, "Topbar should render a settings entry");
  assert.match(topbarSection, /user-entry/, "Topbar should render a user entry");
  assert.match(styleSource, /\.art-header-actions/, "Styles should include Art header action group layout");
  assert.doesNotMatch(styleSource, /\.topbar-actions\b/, "Styles should remove the legacy topbar-actions selector");
  assert.match(styleSource, /\.header-tools/, "Styles should include header tools layout");
  assert.match(styleSource, /\.global-search/, "Styles should include global search layout");
  assert.match(styleSource, /\.notification-entry/, "Styles should include notification entry styling");
  assert.match(styleSource, /\.settings-entry/, "Styles should include settings entry styling");
  assert.match(styleSource, /\.user-entry/, "Styles should include user entry styling");
});

test("Vue stylesheet removes legacy generic action row hooks", async () => {
  const styleSource = await readFile(new URL("../../admin/src/styles/art-design-admin.css", import.meta.url), "utf8");

  assert.match(styleSource, /\.art-header-actions/, "Styles should keep the Art header action row");
  assert.match(styleSource, /\.art-secret-line/, "Styles should keep the Art secret action row");
  for (const legacyClass of ["section-actions", "card-actions", "tag-row"]) {
    assert.doesNotMatch(
      styleSource,
      new RegExp(`\\.${legacyClass}\\b`),
      `Styles should remove the legacy ${legacyClass} selector`,
    );
  }
});

test("Vue header and sidebar expose Art Design Pro menu collapse and mobile shell", async () => {
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

  assert.match(source, /menuOpen/, "Admin should track sidebar menu open state like ArtSidebarMenu");
  assert.match(source, /mobileMenuVisible/, "Admin should track a mobile menu overlay state");
  assert.match(source, /isMobileMenuMode/, "Admin should derive mobile menu mode from viewport state");
  assert.match(source, /toggleMenuVisibility/, "Admin should expose an ArtHeaderBar-style menu visibility action");
  assert.match(source, /closeMobileMenu/, "Admin should close mobile menu overlays");
  assert.match(shellSection, /layout-sidebar/, "Sidebar should use the ArtSidebarMenu layout shell class");
  assert.match(shellSection, /menu-left-open/, "Sidebar should expose an open state class");
  assert.match(shellSection, /menu-left-close/, "Sidebar should expose a collapsed state class");
  assert.match(shellSection, /menu-model/, "Shell should render a mobile menu overlay model");
  assert.match(topbarSection, /header-menu-trigger/, "Topbar should render the ArtHeaderBar menu trigger");
  assert.match(topbarSection, /@click="toggleMenuVisibility"/, "Menu trigger should toggle sidebar visibility");
  assert.match(styleSource, /\.layout-sidebar/, "Styles should include ArtSidebarMenu layout shell");
  assert.match(styleSource, /\.menu-left-open/, "Styles should include sidebar open state");
  assert.match(styleSource, /\.menu-left-close/, "Styles should include sidebar close state");
  assert.match(styleSource, /\.menu-model/, "Styles should include mobile overlay model");
  assert.match(styleSource, /\.header-menu-trigger/, "Styles should include header menu trigger");
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

test("Vue management tables use the ArtTableHeader card pattern", async () => {
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

  assert.match(source, /tableHeaderTools/, "Management table headers should expose template-style tool metadata");
  assert.match(source, /tableHeaderToolLabel/, "Management table headers should resolve tool labels");
  assert.match(source, /handleTableHeaderTool/, "Management table headers should route tool actions");
  for (const section of [interfaceSection, upstreamSection, modelSection, qualitySection]) {
    assert.match(section, /art-table-card/, "Management card should use the Art table card shell");
    assert.match(section, /art-table-header/, "Management card should render an ArtTableHeader-style header");
    assert.match(section, /table-header-main/, "Art table header should include the title/search side");
    assert.match(section, /table-header-tools/, "Art table header should include the tool cluster");
    assert.match(section, /table-tool-button/, "Art table header should render compact tool buttons");
    assert.match(section, /tableHeaderTools/, "Art table header should render the shared tool list");
    assert.match(section, /art-toolbar-actions/, "Art table header should use the shared Art toolbar action cluster");
    assert.doesNotMatch(section, /class="toolbar-actions"/, "Art table header should not keep the legacy toolbar actions class");
  }
  assert.match(styleSource, /\.art-table-card/, "Styles should include Art table card shell");
  assert.match(styleSource, /\.art-table-header/, "Styles should include ArtTableHeader layout");
  assert.match(styleSource, /\.table-header-tools/, "Styles should include table header tool cluster");
  assert.match(styleSource, /\.table-tool-button/, "Styles should include compact table tool buttons");
  assert.match(styleSource, /\.art-toolbar-actions/, "Styles should include the shared Art toolbar actions class");
  assert.doesNotMatch(styleSource, /(^|\n)\.toolbar-actions\b/, "Styles should not keep the standalone legacy toolbar actions selector");
});

test("Vue management table titles use ArtTableHeader title blocks", async () => {
  const source = await readAppSource();
  const sections = [
    sourceBetween(source, "<section v-if=\"activeView === 'interfaces'\"", "<section v-if=\"activeView === 'upstreams'\""),
    sourceBetween(source, "<section v-if=\"activeView === 'upstreams'\"", "<section v-if=\"activeView === 'models'\""),
    sourceBetween(source, "<section v-if=\"activeView === 'models'\"", "<section v-if=\"activeView === 'quality'\""),
    sourceBetween(source, "<section v-if=\"activeView === 'quality'\"", "<section v-if=\"activeView === 'logs'\""),
  ];
  const styleSource = await readFile(new URL("../../admin/src/styles/art-design-admin.css", import.meta.url), "utf8");

  for (const section of sections) {
    assert.match(section, /art-table-title/, "Art table header should use a structured title block");
    assert.match(section, /art-table-meta/, "Art table header should expose a metadata block");
    assert.doesNotMatch(section, /<div class="card-title">/, "Art table header should not use the legacy card title");
  }
  assert.match(styleSource, /\.art-table-title/, "Styles should include Art table title styling");
  assert.match(styleSource, /\.art-table-meta/, "Styles should include Art table meta styling");
  assert.doesNotMatch(styleSource, /\.table-header-main \.card-title/, "Styles should no longer target legacy table card titles");
  assert.doesNotMatch(styleSource, /(^|\n)\.card-title\b/, "Styles should not keep the standalone legacy card title selector");
});

test("Vue management table search follows the ArtTableHeader search toggle", async () => {
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

  assert.match(source, /tableSearchVisible/, "Management tables should track per-module search visibility");
  assert.match(source, /isTableSearchVisible/, "Management tables should expose a search visibility helper");
  assert.match(source, /toggleTableSearchVisible/, "Management tables should toggle search visibility from the header tool");
  assert.match(sourceBetween(source, "function handleTableHeaderTool", "function isTableColumnVisible"), /key === 'search'/, "The search table tool should handle search visibility");

  assert.match(interfaceSection, /search-hidden/, "Interface table header should expose hidden search state");
  assert.match(interfaceSection, /v-show="isTableSearchVisible\('interfaces'\)"/, "Interface search input should be hideable");
  assert.match(upstreamSection, /v-show="isTableSearchVisible\('upstreams'\)"/, "Upstream search input should be hideable");
  assert.match(modelSection, /v-show="isTableSearchVisible\('models'\)"/, "Model search input should be hideable");
  assert.match(qualitySection, /v-show="isTableSearchVisible\('quality'\)"/, "Quality search input should be hideable");
  assert.match(styleSource, /\.table-header-main\.search-hidden/, "Styles should define hidden-search header layout");
  assert.match(styleSource, /\.table-header-main \.table-search-input/, "Styles should scope table search inputs");
});

test("Vue management table headers expose ArtTable column visibility settings", async () => {
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

  assert.match(source, /tableColumnSettingsVisible/, "Column settings popover should track visibility");
  assert.match(source, /tableColumnOptions/, "Column settings should define per-module column options");
  assert.match(source, /visibleTableColumnOptions/, "Column settings should derive visible options for active table");
  assert.match(source, /isTableColumnVisible/, "Tables should check per-column visibility");
  assert.match(source, /toggleTableColumn/, "Column settings should toggle column visibility");
  assert.match(source, /resetTableColumns/, "Column settings should restore default columns");
  assert.match(source, /column-settings-popover/, "Template should render a column settings popover");
  assert.match(source, /column-option-list/, "Template should render column option rows");
  assert.match(source, /@update:model-value=".*toggleTableColumn/, "Column checkboxes should update visibility");

  assert.match(interfaceSection, /isTableColumnVisible\('interfaces', 'apiToken'\)/, "Interface API Key column should be hideable");
  assert.match(interfaceSection, /isTableColumnVisible\('interfaces', 'lastUsedAt'\)/, "Interface last-used column should be hideable");
  assert.match(upstreamSection, /isTableColumnVisible\('upstreams', 'baseURL'\)/, "Upstream Base URL column should be hideable");
  assert.match(upstreamSection, /isTableColumnVisible\('upstreams', 'health'\)/, "Upstream health column should be hideable");
  assert.match(modelSection, /isTableColumnVisible\('models', 'capabilities'\)/, "Model capabilities column should be hideable");
  assert.match(modelSection, /isTableColumnVisible\('models', 'recommendedUse'\)/, "Model use-case column should be hideable");
  assert.match(qualitySection, /isTableColumnVisible\('quality', 'quality'\)/, "Quality preset quality column should be hideable");
  assert.match(qualitySection, /isTableColumnVisible\('quality', 'useCase'\)/, "Quality preset use-case column should be hideable");
  assert.match(styleSource, /\.column-settings-popover/, "Styles should include column settings popover");
  assert.match(styleSource, /\.column-option-list/, "Styles should include column option list");
  assert.match(styleSource, /\.column-option-row/, "Styles should include column option rows");
});

test("Vue management tables expose ArtTable style pagination", async () => {
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

  assert.match(source, /tablePagination/, "Management tables should keep per-module pagination state");
  assert.match(source, /tablePageSizes/, "Management tables should expose ArtTable-style page size choices");
  assert.match(source, /paginateTableRows/, "Management tables should derive paginated rows");
  assert.match(source, /tableEffectiveCurrentPage/, "Management pagination should clamp the visible current page");
  assert.match(source, /handleTablePageSizeChange/, "Management pagination should handle page size changes");
  assert.match(source, /handleTableCurrentPageChange/, "Management pagination should handle current page changes");

  assert.match(interfaceSection, /:data="paginatedInterfaces"/, "Interface table should render paginated rows");
  assert.match(upstreamSection, /:data="paginatedUpstreams"/, "Upstream table should render paginated rows");
  assert.match(modelSection, /:data="paginatedModels"/, "Model table should render paginated rows");
  assert.match(qualitySection, /:data="paginatedPresets"/, "Quality preset table should render paginated rows");
  for (const section of [interfaceSection, upstreamSection, modelSection, qualitySection]) {
    assert.match(section, /art-table-pagination/, "Management table should render an ArtTable pagination footer");
    assert.match(section, /custom-pagination/, "Pagination footer should use the ArtTable custom pagination token");
    assert.match(section, /:current-page="tableEffectiveCurrentPage/, "Pagination footer should bind a clamped current page");
    assert.match(section, /@size-change="/, "Pagination footer should handle page size changes");
    assert.match(section, /@current-change="/, "Pagination footer should handle current page changes");
  }
  assert.match(styleSource, /\.art-table-pagination/, "Styles should include ArtTable pagination footer");
  assert.match(styleSource, /\.custom-pagination/, "Styles should include custom pagination controls");
});

test("Vue management table operations use ArtButtonTable style icon actions", async () => {
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

  for (const section of [interfaceSection, upstreamSection, modelSection, qualitySection]) {
    assert.match(section, /art-table-actions/, "Operation cells should use a compact ArtButtonTable-style action group");
    assert.match(section, /art-table-action-button/, "Operation cells should render icon action buttons");
    assert.match(section, /aria-label=/, "Icon action buttons should keep accessible labels");
    assert.match(section, /<el-tooltip/, "Icon action buttons should keep hover labels");
  }
  assert.match(interfaceSection, /action-key/, "Interface operations should expose a key action button");
  assert.match(interfaceSection, /action-more/, "Interface operations should keep secondary actions in a compact more menu");
  assert.match(interfaceSection, /copySnippet\(row\)/, "Interface operations should preserve Skill/Codex snippet copy");
  assert.match(upstreamSection, /action-test/, "Upstream operations should expose a test action button");
  assert.match(modelSection, /action-danger/, "Model operations should keep destructive delete affordance");
  assert.match(qualitySection, /action-danger/, "Quality operations should keep destructive delete affordance");
  assert.match(styleSource, /\.art-table-actions/, "Styles should define the compact table action group");
  assert.match(styleSource, /\.art-table-action-button/, "Styles should define ArtButtonTable-style buttons");
  assert.match(styleSource, /\.art-table-action-button\.action-danger/, "Styles should define destructive action styling");
});

test("Vue quality case library uses an Art Design Pro table panel", async () => {
  const source = await readAppSource();
  const qualitySection = sourceBetween(
    source,
    "<section v-if=\"activeView === 'quality'\"",
    "<section v-if=\"activeView === 'logs'\"",
  );
  const styleSource = await readFile(new URL("../../admin/src/styles/art-design-admin.css", import.meta.url), "utf8");

  assert.match(qualitySection, /art-quality-case-panel/, "Quality cases should use a dedicated Art panel shell");
  assert.match(qualitySection, /quality-case-panel-header/, "Quality case panel should use a structured header");
  assert.match(qualitySection, /quality-case-panel-title/, "Quality case panel should expose title and helper copy");
  assert.match(qualitySection, /quality-case-panel-badge/, "Quality case panel should show case counts as badges");
  assert.match(qualitySection, /quality-case-panel-tools/, "Quality case panel should group compact actions");
  assert.match(qualitySection, /art-table-action-button action-view/, "Quality case rows should use icon action buttons");
  assert.match(qualitySection, /aria-label="查看质量案例日志"/, "Quality case log action should be accessible");
  assert.match(styleSource, /\.art-quality-case-panel/, "Styles should include the quality case panel shell");
  assert.match(styleSource, /\.quality-case-panel-header/, "Styles should include quality case panel header");
  assert.match(styleSource, /\.quality-case-panel-badge/, "Styles should include quality case badges");
});

test("Vue quality metrics use ArtStatsCard style cards", async () => {
  const source = await readAppSource();
  const qualitySection = sourceBetween(
    source,
    "<section v-if=\"activeView === 'quality'\"",
    "<section v-if=\"activeView === 'logs'\"",
  );
  const styleSource = await readFile(new URL("../../admin/src/styles/art-design-admin.css", import.meta.url), "utf8");

  assert.match(source, /qualitySummaryCards/, "Quality metrics should be driven by summary card metadata");
  assert.match(qualitySection, /art-quality-stats-grid/, "Quality metrics should use a dedicated Art stats grid");
  assert.match(qualitySection, /v-for="item in qualitySummaryCards"/, "Quality metrics should render from metadata");
  assert.match(qualitySection, /art-quality-stat-card/, "Quality metrics should use ArtStatsCard style card shells");
  assert.match(qualitySection, /art-quality-stat-icon/, "Quality metric cards should include an icon block");
  assert.match(qualitySection, /art-quality-stat-content/, "Quality metric cards should separate metric copy from icon chrome");
  assert.match(qualitySection, /art-quality-stat-arrow/, "Quality metric cards should include the template-style trailing arrow cue");
  assert.match(qualitySection, /<component :is="item.icon"/, "Quality metric card icons should be data-driven");
  assert.doesNotMatch(qualitySection, /quality-stat-card art-card/, "Quality metric cards should not keep the legacy card shell");
  assert.match(styleSource, /\.art-quality-stats-grid/, "Styles should include quality stats grid layout");
  assert.match(styleSource, /\.art-quality-stat-card/, "Styles should include quality stat card styling");
  assert.match(styleSource, /\.art-quality-stat-content/, "Styles should include quality stat content styling");
  assert.match(styleSource, /\.art-quality-stat-icon/, "Styles should include quality stat icon blocks");
  assert.doesNotMatch(styleSource, /\.quality-stat-card\b/, "Styles should remove the legacy quality stat card selector");
});

test("Vue quality preset cards use an Art Design Pro card template", async () => {
  const source = await readAppSource();
  const qualitySection = sourceBetween(
    source,
    "<section v-if=\"activeView === 'quality'\"",
    "<section v-if=\"activeView === 'logs'\"",
  );
  const styleSource = await readFile(new URL("../../admin/src/styles/art-design-admin.css", import.meta.url), "utf8");

  assert.match(qualitySection, /art-preset-grid/, "Preset cards should render inside an Art card grid");
  assert.match(qualitySection, /art-preset-card/, "Preset cards should use a dedicated Art card shell");
  assert.match(qualitySection, /preset-card-header/, "Preset cards should expose a structured header");
  assert.match(qualitySection, /preset-card-title/, "Preset cards should expose a title block");
  assert.match(qualitySection, /preset-card-meta/, "Preset cards should expose compact metadata");
  assert.match(qualitySection, /preset-card-body/, "Preset cards should expose a body section");
  assert.match(qualitySection, /preset-card-footer/, "Preset cards should expose footer actions");
  assert.doesNotMatch(qualitySection, /class="preset-card"/, "Preset cards should no longer use the legacy card class");
  assert.match(styleSource, /\.art-preset-grid/, "Styles should include the Art preset grid");
  assert.match(styleSource, /\.art-preset-card/, "Styles should include preset card shell styling");
  assert.match(styleSource, /\.preset-card-header/, "Styles should include preset card header styling");
  assert.match(styleSource, /\.preset-card-footer/, "Styles should include preset card footer styling");
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
  assert.match(drawerSection, /art-drawer-form/, "Config drawer forms should use an Art drawer form shell");
  assert.match(drawerSection, /drawer-form-grid/, "Config drawer should use a structured field grid");
  assert.match(drawerSection, /art-secret-line/, "Config drawer secret controls should use an Art secret action row");
  assert.match(drawerSection, /drawer-footer-actions/, "Config drawer should render a sticky action bar");
  assert.doesNotMatch(drawerSection, /(?<![A-Za-z0-9_-])drawer-form(?![A-Za-z0-9_-])/, "Config drawer should not keep the generic drawer-form class");
  assert.doesNotMatch(drawerSection, /(?<![A-Za-z0-9_-])secret-line(?![A-Za-z0-9_-])/, "Config drawer should not keep the generic secret-line class");
  assert.match(styleSource, /\.config-drawer/, "Styles should include config drawer styling");
  assert.match(styleSource, /\.drawer-overview/, "Styles should include drawer overview styling");
  assert.match(styleSource, /\.drawer-status-grid/, "Styles should include drawer status card styling");
  assert.match(styleSource, /\.art-drawer-form/, "Styles should include Art drawer form shell styling");
  assert.match(styleSource, /\.drawer-form-grid/, "Styles should include drawer form grid styling");
  assert.match(styleSource, /\.art-secret-line/, "Styles should include Art secret action row styling");
  assert.match(styleSource, /\.drawer-footer-actions/, "Styles should include drawer footer action styling");
  assert.doesNotMatch(styleSource, /\.drawer-form(?![A-Za-z0-9_-])/, "Styles should remove the legacy drawer-form selector");
  assert.doesNotMatch(styleSource, /\.secret-line\b/, "Styles should remove the legacy secret-line selector");
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
  assert.match(logSection, /art-search-form-grid/, "Query panel should use an ArtSearchBar form grid layout");
  assert.match(logSection, /result-toolbar/, "Logs page should render a result toolbar above tables");
  assert.match(logSection, /v-model="activeLogTab"/, "Logs tabs should bind the active tab");
  assert.match(logSection, /:size="tableSize"/, "Logs tables should respect shared density size");
  assert.match(logSection, /刷新日志/, "Result toolbar should include a clear refresh action");
  assert.match(styleSource, /\.log-workspace/, "Styles should include log workspace layout");
  assert.match(styleSource, /\.log-summary-grid/, "Styles should include log summary layout");
  assert.match(styleSource, /\.query-panel/, "Styles should include query panel layout");
  assert.match(styleSource, /\.result-toolbar/, "Styles should include result toolbar layout");
  assert.doesNotMatch(styleSource, /\.filter-bar\b/, "Styles should remove the legacy filter-bar selector");
  assert.doesNotMatch(styleSource, /\.query-actions\b/, "Styles should remove the legacy query-actions selector");
  assert.doesNotMatch(styleSource, /\.log-actions\b/, "Styles should remove the legacy log-actions selector");
});

test("Vue logs page query panel follows the ArtSearchBar template pattern", async () => {
  const source = await readAppSource();
  const logSection = sourceBetween(
    source,
    "<section v-if=\"activeView === 'logs'\"",
    "<section v-if=\"activeView === 'usage'\"",
  );
  const styleSource = await readFile(new URL("../../admin/src/styles/art-design-admin.css", import.meta.url), "utf8");

  assert.match(source, /logSearchExpanded/, "Logs search bar should track expand and collapse state");
  assert.match(source, /visibleLogSearchFields/, "Logs search bar should compute visible fields");
  assert.match(source, /toggleLogSearchExpanded/, "Logs search bar should expose an expand toggle");
  assert.match(logSection, /art-search-bar/, "Logs query panel should use the ArtSearchBar shell class");
  assert.match(logSection, /art-card-xs/, "Logs query panel should use the compact card token");
  assert.match(logSection, /:class="\{ 'is-expanded': logSearchExpanded \}"/, "Logs query panel should bind expanded state");
  assert.match(logSection, /art-search-form-grid/, "Logs query fields should render in the template form grid");
  assert.doesNotMatch(logSection, /query-grid/, "Logs query fields should not keep the legacy query-grid class");
  assert.match(logSection, /visibleLogSearchFields/, "Logs query grid should render the visible field list");
  assert.match(logSection, /art-search-action-column/, "Logs search bar should render the ArtSearchBar action column");
  assert.match(logSection, /art-search-action-stack/, "Logs search bar should wrap actions in an ArtSearchBar action stack");
  assert.match(logSection, /art-search-form-buttons/, "Logs search bar should group reset and search actions");
  assert.match(logSection, /art-search-reset-button/, "Logs search bar reset button should use an ArtSearchBar class");
  assert.match(logSection, /art-search-submit-button/, "Logs search bar submit button should use an ArtSearchBar class");
  assert.match(logSection, /art-search-filter-toggle/, "Logs search bar should expose expand and collapse control");
  assert.doesNotMatch(logSection, /class="action-column"/, "Logs search bar should not keep the legacy action-column class");
  assert.doesNotMatch(logSection, /class="action-buttons-wrapper"/, "Logs search bar should not keep the legacy action wrapper class");
  assert.doesNotMatch(logSection, /class="form-buttons"/, "Logs search bar should not keep the legacy form-buttons class");
  assert.doesNotMatch(logSection, /class="reset-button"/, "Logs search bar should not keep the legacy reset button class");
  assert.doesNotMatch(logSection, /class="search-button"/, "Logs search bar should not keep the legacy search button class");
  assert.doesNotMatch(logSection, /class="filter-toggle"/, "Logs search bar should not keep the legacy filter toggle class");
  assert.match(styleSource, /\.art-search-bar/, "Styles should include the ArtSearchBar shell");
  assert.match(styleSource, /\.art-search-form-grid/, "Styles should include the ArtSearchBar form grid");
  assert.doesNotMatch(styleSource, /\.query-grid\b/, "Styles should remove the legacy query grid selector");
  assert.match(styleSource, /\.art-search-action-column/, "Styles should include the ArtSearchBar action column");
  assert.match(styleSource, /\.art-search-action-stack/, "Styles should include the ArtSearchBar action stack");
  assert.match(styleSource, /\.art-search-form-buttons/, "Styles should include the ArtSearchBar form buttons");
  assert.match(styleSource, /\.art-search-filter-toggle/, "Styles should include the ArtSearchBar expand toggle");
  assert.doesNotMatch(styleSource, /(^|\n)\.action-column\b/, "Styles should not keep the standalone legacy action-column selector");
  assert.doesNotMatch(styleSource, /(^|\n)\.action-buttons-wrapper\b/, "Styles should not keep the standalone legacy action wrapper selector");
  assert.doesNotMatch(styleSource, /(^|\n)\.form-buttons\b/, "Styles should not keep the standalone legacy form-buttons selector");
  assert.doesNotMatch(styleSource, /(^|\n)\.filter-toggle\b/, "Styles should not keep the standalone legacy filter toggle selector");
});

test("Vue logs page panels use Art Design Pro panel headers", async () => {
  const source = await readAppSource();
  const logSection = sourceBetween(
    source,
    "<section v-if=\"activeView === 'logs'\"",
    "<section v-if=\"activeView === 'usage'\"",
  );
  const styleSource = await readFile(new URL("../../admin/src/styles/art-design-admin.css", import.meta.url), "utf8");

  assert.match(logSection, /art-log-panel/, "Logs query and result areas should use the Art log panel shell");
  assert.match(logSection, /log-panel-header/, "Logs panels should render structured headers");
  assert.match(logSection, /log-panel-title/, "Logs panels should expose title blocks");
  assert.match(logSection, /log-panel-meta/, "Logs panels should expose metadata/actions in headers");
  assert.match(logSection, /log-panel-body/, "Logs panels should wrap fields and tables in panel bodies");
  assert.match(logSection, /log-query-panel/, "Logs query area should use the shared Art panel shell");
  assert.match(logSection, /log-result-panel/, "Logs result area should use the shared Art panel shell");
  assert.doesNotMatch(logSection, /<div class="card-title"><Document \/>日志查询<\/div>/, "Logs query panel should not use the legacy card title");
  assert.doesNotMatch(logSection, /<div class="card-title"><DataAnalysis \/>日志结果<\/div>/, "Logs result panel should not use the legacy card title");
  assert.match(styleSource, /\.art-log-panel/, "Styles should include the Art log panel shell");
  assert.match(styleSource, /\.log-panel-header/, "Styles should include log panel header styling");
  assert.match(styleSource, /\.log-panel-body/, "Styles should include log panel body styling");
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

test("Vue log detail diagnostic cards use Art Design Pro panels", async () => {
  const source = await readAppSource();
  const detailDrawer = sourceBetween(
    source,
    "<el-drawer v-model=\"logDetailVisible\"",
    "</el-drawer>",
  );
  const styleSource = await readFile(new URL("../../admin/src/styles/art-design-admin.css", import.meta.url), "utf8");

  assert.match(detailDrawer, /art-detail-panel/, "Detail cards should share an Art detail panel class");
  assert.match(detailDrawer, /detail-panel-header/, "Detail cards should render a structured header");
  assert.match(detailDrawer, /detail-panel-title/, "Detail cards should expose a title block");
  assert.match(detailDrawer, /detail-panel-meta/, "Detail cards should expose metadata in the header");
  assert.match(detailDrawer, /detail-panel-body/, "Detail cards should wrap content in a panel body");
  assert.match(detailDrawer, /route-detail-panel/, "Route card should use the shared detail panel shell");
  assert.match(detailDrawer, /diagnostic-detail-panel/, "Diagnostic card should use the shared detail panel shell");
  assert.match(detailDrawer, /curl-detail-panel/, "Curl card should use the shared detail panel shell");
  assert.doesNotMatch(detailDrawer, /<template #header><div class="card-title"/, "Log detail drawer should not use legacy one-line card titles");
  assert.match(styleSource, /\.art-detail-panel/, "Styles should include the Art detail panel shell");
  assert.match(styleSource, /\.detail-panel-header/, "Styles should include detail panel header styling");
  assert.match(styleSource, /\.detail-panel-body/, "Styles should include detail panel body styling");
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

test("Vue usage analytics cards use Art Design Pro panel headers", async () => {
  const source = await readAppSource();
  const usageSection = sourceBetween(
    source,
    "<section v-if=\"activeView === 'usage'\"",
    "<section v-if=\"activeView === 'alerts'\"",
  );
  const styleSource = await readFile(new URL("../../admin/src/styles/art-design-admin.css", import.meta.url), "utf8");

  assert.match(usageSection, /art-usage-panel/, "Usage analytics cards should share an Art usage panel class");
  assert.match(usageSection, /usage-panel-header/, "Usage analytics cards should render a structured panel header");
  assert.match(usageSection, /usage-panel-title/, "Usage analytics cards should expose a title block");
  assert.match(usageSection, /usage-panel-meta/, "Usage analytics cards should expose right-side metadata");
  assert.match(usageSection, /usage-panel-body/, "Usage analytics cards should wrap content in a panel body");
  assert.match(usageSection, /usage-breakdown-panel/, "Usage breakdown should use the shared Art usage panel shell");
  assert.doesNotMatch(usageSection, /<template #header><div class="card-title"/, "Usage page should not use legacy one-line card titles");
  assert.match(styleSource, /\.art-usage-panel/, "Styles should include the Art usage panel shell");
  assert.match(styleSource, /\.usage-panel-header/, "Styles should include the structured usage panel header");
  assert.match(styleSource, /\.usage-panel-body/, "Styles should include the usage panel body");
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

test("Vue security policy and session cards use Art Design Pro panels", async () => {
  const source = await readAppSource();
  const securitySection = sourceBetween(
    source,
    "<section v-if=\"activeView === 'security'\"",
    "<section v-if=\"activeView === 'system'\"",
  );
  const styleSource = await readFile(new URL("../../admin/src/styles/art-design-admin.css", import.meta.url), "utf8");

  assert.match(securitySection, /art-security-panel/g, "Security cards should use a reusable Art panel shell");
  assert.match(securitySection, /security-account-panel/, "Security page should style the account policy card");
  assert.match(securitySection, /security-totp-panel/, "Security page should style the TOTP card");
  assert.match(securitySection, /security-password-panel/, "Security page should style the password card");
  assert.match(securitySection, /session-list-panel/, "Security page should style the session card");
  assert.match(securitySection, /login-history-panel/, "Security page should style the login history card");
  assert.match(securitySection, /security-panel-header/g, "Security panels should use structured headers");
  assert.match(securitySection, /security-panel-title/g, "Security panels should expose title and helper copy");
  assert.match(securitySection, /security-panel-body/g, "Security panels should wrap body content consistently");
  assert.match(securitySection, /security-panel-action/, "Security panels should use compact action affordances");
  assert.match(securitySection, /art-security-form/g, "Security policy forms should use a dedicated Art form layout");
  assert.match(securitySection, /art-security-status-row/, "TOTP status should use a dedicated Art status row");
  assert.doesNotMatch(securitySection, /class="narrow-form"/, "Security panels should not keep the generic narrow-form class");
  assert.doesNotMatch(securitySection, /class="status-row"/, "Security panels should not keep the generic status-row class");
  assert.match(styleSource, /\.art-security-panel/, "Styles should include security panel shell");
  assert.match(styleSource, /\.security-panel-header/, "Styles should include security panel header");
  assert.match(styleSource, /\.security-panel-body/, "Styles should include security panel body layout");
  assert.match(styleSource, /\.security-panel-action/, "Styles should include security panel actions");
  assert.match(styleSource, /\.art-security-form/, "Styles should include security form layout");
  assert.match(styleSource, /\.art-security-status-row/, "Styles should include security status row layout");
  assert.doesNotMatch(styleSource, /\.narrow-form\b/, "Styles should remove the legacy narrow-form selector");
  assert.doesNotMatch(styleSource, /\.status-row\b/, "Styles should remove the legacy status-row selector");
});

test("Vue audit log uses an Art Design Pro security panel", async () => {
  const source = await readAppSource();
  const securitySection = sourceBetween(
    source,
    "<section v-if=\"activeView === 'security'\"",
    "<section v-if=\"activeView === 'system'\"",
  );
  const styleSource = await readFile(new URL("../../admin/src/styles/art-design-admin.css", import.meta.url), "utf8");

  assert.match(securitySection, /audit-log-panel/, "Audit logs should use a dedicated Art security panel");
  assert.match(securitySection, /audit-panel-header/, "Audit log panel should use a structured header");
  assert.match(securitySection, /audit-panel-title/, "Audit log panel should expose title and helper copy");
  assert.match(securitySection, /audit-panel-body/, "Audit log panel should wrap table content");
  assert.match(securitySection, /audit-panel-action/, "Audit log panel should expose a compact refresh action");
  assert.match(styleSource, /\.audit-log-panel/, "Styles should include audit log panel shell");
  assert.match(styleSource, /\.audit-panel-header/, "Styles should include audit panel header");
  assert.match(styleSource, /\.audit-panel-body/, "Styles should include audit panel body layout");
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

test("Vue system operation cards use Art Design Pro panels", async () => {
  const source = await readAppSource();
  const systemSection = sourceBetween(
    source,
    "<section v-if=\"activeView === 'system'\"",
    "</main>",
  );
  const styleSource = await readFile(new URL("../../admin/src/styles/art-design-admin.css", import.meta.url), "utf8");

  assert.match(systemSection, /art-system-panel/g, "System cards should use a reusable Art panel shell");
  assert.match(systemSection, /system-backup-panel/, "System page should style the backup card");
  assert.match(systemSection, /system-version-panel/, "System page should style the version history card");
  assert.match(systemSection, /system-update-panel/, "System page should style the update card");
  assert.match(systemSection, /system-panel-header/g, "System panels should use structured headers");
  assert.match(systemSection, /system-panel-title/g, "System panels should expose title and helper copy");
  assert.match(systemSection, /system-panel-body/g, "System panels should wrap body content consistently");
  assert.match(systemSection, /system-panel-actions/g, "System panels should group compact actions");
  assert.match(systemSection, /system-panel-action/, "System panel buttons should use compact action styling");
  assert.match(systemSection, /art-system-status-list/, "System update status should use a dedicated Art status list");
  assert.match(systemSection, /art-system-backup-status/, "System backup status should use a dedicated Art status row");
  assert.match(systemSection, /art-system-file-input/, "System restore input should use a dedicated Art hidden file control");
  assert.match(systemSection, /art-system-update-actions/, "System update actions should use a dedicated Art action row");
  assert.doesNotMatch(systemSection, /class="status-list"/, "System panels should not keep the legacy status-list class");
  assert.doesNotMatch(systemSection, /class="system-actions"/, "System panels should not keep the generic system-actions class");
  assert.doesNotMatch(systemSection, /class="hidden-file"/, "System panels should not keep the generic hidden-file class");
  assert.doesNotMatch(systemSection, /class="update-actions system-panel-actions"/, "System panels should not keep the generic update-actions class");
  assert.match(styleSource, /\.art-system-panel/, "Styles should include system panel shell");
  assert.match(styleSource, /\.system-panel-header/, "Styles should include system panel header");
  assert.match(styleSource, /\.system-panel-body/, "Styles should include system panel body layout");
  assert.match(styleSource, /\.system-panel-action/, "Styles should include system panel actions");
  assert.match(styleSource, /\.art-system-status-list/, "Styles should include system status list styling");
  assert.match(styleSource, /\.art-system-backup-status/, "Styles should include system backup status row");
  assert.match(styleSource, /\.art-system-file-input/, "Styles should include system hidden file input");
  assert.match(styleSource, /\.art-system-update-actions/, "Styles should include system update actions row");
  assert.doesNotMatch(styleSource, /\.system-actions\b/, "Styles should remove the legacy system-actions selector");
  assert.doesNotMatch(styleSource, /\.hidden-file\b/, "Styles should remove the legacy hidden-file selector");
  assert.doesNotMatch(styleSource, /\.update-actions\b/, "Styles should remove the legacy update-actions selector");
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

test("Vue alerts cards use Art Design Pro panels", async () => {
  const source = await readAppSource();
  const alertsSection = sourceBetween(
    source,
    "<section v-if=\"activeView === 'alerts'\"",
    "<section v-if=\"activeView === 'security'\"",
  );
  const styleSource = await readFile(new URL("../../admin/src/styles/art-design-admin.css", import.meta.url), "utf8");

  assert.match(alertsSection, /art-alert-panel/g, "Alert cards should use a reusable Art panel shell");
  assert.match(alertsSection, /alert-queue-panel/, "Alerts page should style the alert queue card");
  assert.match(alertsSection, /alert-notification-panel/, "Alerts page should style the notification status card");
  assert.match(alertsSection, /alert-rules-panel/, "Alerts page should style the rules card");
  assert.match(alertsSection, /alert-panel-header/g, "Alert panels should use structured headers");
  assert.match(alertsSection, /alert-panel-title/g, "Alert panels should expose title and helper copy");
  assert.match(alertsSection, /alert-panel-body/g, "Alert panels should wrap body content consistently");
  assert.match(alertsSection, /alert-panel-actions/g, "Alert panels should group compact actions");
  assert.match(alertsSection, /alert-panel-action/, "Alert panel buttons should use compact action styling");
  assert.match(alertsSection, /art-alert-status-list/, "Alert notification status should use a dedicated Art status list");
  assert.match(alertsSection, /art-alert-form/, "Alert rules should use a dedicated Art form layout");
  assert.doesNotMatch(alertsSection, /class="status-list"/, "Alert panels should not keep the legacy status-list class");
  assert.doesNotMatch(alertsSection, /class="narrow-form"/, "Alert panels should not keep the generic narrow-form class");
  assert.match(styleSource, /\.art-alert-panel/, "Styles should include alert panel shell");
  assert.match(styleSource, /\.alert-panel-header/, "Styles should include alert panel header");
  assert.match(styleSource, /\.alert-panel-body/, "Styles should include alert panel body layout");
  assert.match(styleSource, /\.alert-panel-action/, "Styles should include alert panel actions");
  assert.match(styleSource, /\.art-alert-status-list/, "Styles should include alert status list styling");
  assert.match(styleSource, /\.art-alert-form/, "Styles should include alert form layout");
});
