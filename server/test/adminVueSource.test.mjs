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

function classTokenPattern(token) {
  return new RegExp(`class="[^"]*(?<![A-Za-z0-9_-])${escapeRegExp(token)}(?![A-Za-z0-9_-])`);
}

function cssClassSelectorPattern(token) {
  return new RegExp(`\\.${escapeRegExp(token)}(?![A-Za-z0-9_-])`);
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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
  const styleSource = await readFile(new URL("../../admin/src/styles/art-design-admin.css", import.meta.url), "utf8");

  for (const label of ["模型 ID", "能力", "尺寸", "质量", "默认格式", "推荐用途", "绑定上游", "启用"]) {
    assert.match(modelSection, new RegExp(label), `Model table should expose ${label}`);
  }
  assert.match(modelSection, /art-compact-tags/, "Model table tag groups should use an Art compact tag renderer");
  assert.doesNotMatch(modelSection, /(?<![A-Za-z0-9_-])compact-tags(?![A-Za-z0-9_-])/, "Model table should not keep the generic compact-tags class");

  assert.match(modelDrawer, /defaultOutputFormat/, "Model drawer should edit the default output format");
  assert.match(modelDrawer, /upstreamIds/, "Model drawer should edit upstream bindings");
  assert.match(modelDrawer, /activeUpstreams/, "Model drawer should use configured upstream choices");
  assert.match(styleSource, /\.art-compact-tags/, "Styles should include Art compact tag groups");
  assert.doesNotMatch(styleSource, /\.compact-tags(?![A-Za-z0-9_-])/, "Styles should remove the generic compact-tags selector");
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
  const styleSource = await readFile(new URL("../../admin/src/styles/art-design-admin.css", import.meta.url), "utf8");

  assert.match(interfaceSection, /apiTokenPreview/, "Interface table should show the masked client key suffix");
  assert.match(upstreamSection, /apiKeyPreview/, "Upstream table should show the masked upstream key suffix");
  assert.match(interfaceSection, /art-key-preview/, "Interface key cells should use an Art key preview renderer");
  assert.match(upstreamSection, /art-key-preview/, "Upstream key cells should use an Art key preview renderer");
  assert.match(upstreamSection, /art-health-inline/, "Upstream health cells should use an Art inline health renderer");
  assert.doesNotMatch(interfaceSection, /(?<![A-Za-z0-9_-])key-preview(?![A-Za-z0-9_-])/, "Interface table should not keep the generic key-preview class");
  assert.doesNotMatch(upstreamSection, /(?<![A-Za-z0-9_-])key-preview(?![A-Za-z0-9_-])/, "Upstream table should not keep the generic key-preview class");
  assert.doesNotMatch(upstreamSection, /(?<![A-Za-z0-9_-])health-inline(?![A-Za-z0-9_-])/, "Upstream table should not keep the generic health-inline class");
  assert.match(styleSource, /\.art-key-preview/, "Styles should include Art key preview cells");
  assert.match(styleSource, /\.art-health-inline/, "Styles should include Art health inline cells");
  assert.doesNotMatch(styleSource, /\.key-preview(?![A-Za-z0-9_-])/, "Styles should remove the generic key-preview selector");
  assert.doesNotMatch(styleSource, /\.health-inline(?![A-Za-z0-9_-])/, "Styles should remove the generic health-inline selector");
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

  const expectedAuthTokens = [
    "art-auth-page",
    "art-auth-workspace",
    "art-auth-status-panel",
    "art-auth-brand",
    "art-auth-headline",
    "art-auth-signal-grid",
    "art-auth-pipeline",
    "art-auth-card",
    "art-auth-access-panel",
    "art-auth-security-strip",
  ];
  for (const token of expectedAuthTokens) {
    assert.match(loginSection, new RegExp(token), `Login page should render ${token}`);
    assert.match(styleSource, new RegExp(`\\.${token}`), `Styles should include ${token}`);
  }
  for (const oldToken of [
    "login-page",
    "login-workspace",
    "login-status-panel",
    "brand-orbit",
    "login-headline",
    "login-signal-grid",
    "login-pipeline",
    "login-card",
    "login-access-panel",
    "login-security-strip",
  ]) {
    assert.doesNotMatch(loginSection, classTokenPattern(oldToken), `Login page should not keep old ${oldToken} token`);
    assert.doesNotMatch(styleSource, cssClassSelectorPattern(oldToken), `Styles should not keep old ${oldToken} selector`);
  }
});

test("Vue shell utility controls use Art Design Pro tokens", async () => {
  const source = await readAppSource();
  const loginSection = sourceBetween(
    source,
    "<div v-if=\"!authenticated\"",
    "<div v-else class=\"admin-shell\"",
  );
  const shellHeader = sourceBetween(
    source,
    "<header class=\"admin-topbar\">",
    "</header>",
  );
  const styleSource = await readFile(new URL("../../admin/src/styles/art-design-admin.css", import.meta.url), "utf8");

  assert.match(loginSection, /art-full-button/, "Login submit should use an Art full-width button utility");
  assert.match(shellHeader, /art-dirty-hint/, "Topbar dirty state should use an Art utility hint token");
  assert.doesNotMatch(loginSection, /(?<![A-Za-z0-9_-])full-button(?![A-Za-z0-9_-])/, "Login page should not keep the generic full-button class");
  assert.doesNotMatch(shellHeader, /(?<![A-Za-z0-9_-])dirty-hint(?![A-Za-z0-9_-])/, "Topbar should not keep the generic dirty-hint class");
  assert.match(styleSource, /\.art-full-button/, "Styles should include the Art full button utility");
  assert.match(styleSource, /\.art-dirty-hint/, "Styles should include the Art dirty hint utility");
  assert.doesNotMatch(styleSource, /\.full-button(?![A-Za-z0-9_-])/, "Styles should remove the generic full-button selector");
  assert.doesNotMatch(styleSource, /\.dirty-hint(?![A-Za-z0-9_-])/, "Styles should remove the generic dirty-hint selector");
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
  assert.match(dashboardSection, /art-dashboard-visual-grid/, "Dashboard visualization row should use an Art dashboard visual grid");
  assert.match(dashboardSection, /art-trend-chart/, "Dashboard should render the Art trend chart area");
  assert.match(dashboardSection, /art-trend-bar/, "Dashboard trend chart should render Art trend bars");
  assert.match(dashboardSection, /art-chart-empty/, "Dashboard trend chart should render an Art empty state");
  assert.match(dashboardSection, /art-status-distribution/, "Dashboard should render the Art status distribution chart area");
  assert.match(dashboardSection, /art-distribution-row/, "Dashboard status chart should render Art distribution rows");
  for (const legacyClass of [
    "dashboard-visual-grid",
    "usage-trend",
    "trend-bar",
    "empty-visual",
    "status-distribution",
    "distribution-row",
  ]) {
    assert.doesNotMatch(
      dashboardSection,
      new RegExp(`(?<![A-Za-z0-9_-])${legacyClass}(?![A-Za-z0-9_-])`),
      `Dashboard visualizations should not keep generic ${legacyClass} classes`,
    );
  }
  assert.match(styleSource, /\.art-dashboard-visual-grid/, "Styles should include Art dashboard visual grid layout");
  assert.match(styleSource, /\.art-trend-chart/, "Styles should include Art trend chart layout");
  assert.match(styleSource, /\.art-status-distribution/, "Styles should include Art status distribution layout");
  for (const legacyClass of [
    "dashboard-visual-grid",
    "usage-trend",
    "trend-bar",
    "empty-visual",
    "status-distribution",
    "distribution-row",
  ]) {
    assert.doesNotMatch(
      styleSource,
      new RegExp(`\\.${legacyClass}(?![A-Za-z0-9_-])`),
      `Styles should remove the generic ${legacyClass} selector`,
    );
  }
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
  assert.match(dashboardSection, /art-console-stat-body/, "Dashboard cards should use the Art template card body layout");
  assert.match(dashboardSection, /art-console-stat-meta/, "Dashboard cards should use the Art stat metadata block");
  assert.match(dashboardSection, /art-console-stat-trend/, "Dashboard cards should include the Art template trend row");
  assert.match(dashboardSection, /art-console-stat-icon/, "Dashboard cards should include the Art right-side icon block");
  assert.match(dashboardSection, /<component :is="item.icon"/, "Dashboard card icons should be data-driven");
  assert.doesNotMatch(dashboardSection, /metric-card/, "Dashboard cards should not keep the legacy metric-card class");
  for (const legacyClass of [
    "console-stat-body",
    "console-stat-meta",
    "console-stat-trend",
    "console-stat-icon",
  ]) {
    assert.doesNotMatch(
      dashboardSection,
      new RegExp(`(?<![A-Za-z0-9_-])${legacyClass}(?![A-Za-z0-9_-])`),
      `Dashboard cards should not keep generic ${legacyClass} classes`,
    );
  }
  assert.match(styleSource, /\.art-console-card-list/, "Styles should include the console card-list grid");
  assert.match(styleSource, /\.art-console-stat-card/, "Styles should include console stat card styling");
  assert.match(styleSource, /\.art-console-stat-body/, "Styles should include the Art console stat card body");
  assert.match(styleSource, /\.art-console-stat-trend/, "Styles should include the Art console stat trend row");
  assert.match(styleSource, /\.art-console-stat-icon/, "Styles should include Art console stat icon blocks");
  assert.doesNotMatch(styleSource, /\.metric-card\b/, "Styles should remove the legacy metric card rules");
  for (const legacyClass of [
    "console-stat-body",
    "console-stat-meta",
    "console-stat-trend",
    "console-stat-icon",
  ]) {
    assert.doesNotMatch(
      styleSource,
      new RegExp(`\\.${legacyClass}(?![A-Za-z0-9_-])`),
      `Styles should remove the generic ${legacyClass} selector`,
    );
  }
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
  assert.match(dashboardSection, /art-console-panel-header/g, "Dashboard modules should render template-style Art panel headers");
  assert.match(dashboardSection, /art-console-panel-title/g, "Dashboard modules should render compact Art title blocks");
  assert.match(dashboardSection, /art-console-panel-badge/g, "Dashboard module headers should include Art status badges");
  assert.match(dashboardSection, /art-console-panel-action/g, "Dashboard module headers should expose small Art action affordances");
  assert.doesNotMatch(dashboardSection, /(?<![A-Za-z0-9_-])console-panel-header(?![A-Za-z0-9_-])/, "Dashboard modules should not keep generic console-panel-header classes");
  assert.doesNotMatch(dashboardSection, /(?<![A-Za-z0-9_-])console-panel-title(?![A-Za-z0-9_-])/, "Dashboard modules should not keep generic console-panel-title classes");
  assert.doesNotMatch(dashboardSection, /(?<![A-Za-z0-9_-])console-panel-tools(?![A-Za-z0-9_-])/, "Dashboard modules should not keep generic console-panel-tools classes");
  assert.doesNotMatch(dashboardSection, /(?<![A-Za-z0-9_-])console-panel-badge(?![A-Za-z0-9_-])/, "Dashboard modules should not keep generic console-panel-badge classes");
  assert.doesNotMatch(dashboardSection, /(?<![A-Za-z0-9_-])console-panel-action(?![A-Za-z0-9_-])/, "Dashboard modules should not keep generic console-panel-action classes");
  assert.match(dashboardSection, /@click="navigateTo\('usage'\)"/, "Usage trend panel should link to usage details");
  assert.match(dashboardSection, /@click="navigateTo\('logs'\)"/, "Failure panel should link to logs");
  assert.match(styleSource, /\.art-console-panel/, "Styles should include console panel shell");
  assert.match(styleSource, /\.art-console-section-grid/, "Styles should include Art console section grid layout");
  assert.match(styleSource, /\.art-console-status-list/, "Styles should include Art console status list styling");
  assert.doesNotMatch(styleSource, /\.content-grid\b/, "Styles should remove the legacy content grid selector");
  assert.match(styleSource, /\.art-console-panel-header/, "Styles should include Art console panel header");
  assert.match(styleSource, /\.art-console-panel-badge/, "Styles should include Art console panel status badges");
  assert.match(styleSource, /\.art-console-panel-action/, "Styles should include Art console panel action buttons");
  for (const legacyClass of [
    "console-panel-header",
    "console-panel-title",
    "console-panel-tools",
    "console-panel-badge",
    "console-panel-action",
  ]) {
    assert.doesNotMatch(
      styleSource,
      new RegExp(`\\.${legacyClass}(?![A-Za-z0-9_-])`),
      `Styles should remove the generic ${legacyClass} selector`,
    );
  }
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
  assert.match(shellSection, /art-page-breadcrumb/, "Shell should render an Art Design Pro style breadcrumb row");
  assert.match(shellSection, /art-worktab-bar/, "Shell should render route-like Art work tabs");
  assert.match(shellSection, /art-operations-panel/, "Shell should render an Art operations panel below the topbar");
  assert.match(shellSection, /art-operations-heading/, "Operations panel should render an Art heading");
  assert.match(shellSection, /art-quick-actions/, "Operations panel should render Art quick action buttons");
  assert.match(shellSection, /art-risk-board/, "Operations panel should render the Art risk summary board");
  assert.doesNotMatch(shellSection, /(?<![A-Za-z0-9_-])page-breadcrumb(?![A-Za-z0-9_-])/, "Shell should not keep the generic page-breadcrumb class");
  assert.doesNotMatch(shellSection, /(?<![A-Za-z0-9_-])page-tabs(?![A-Za-z0-9_-])/, "Shell should not keep the generic page-tabs class");
  assert.doesNotMatch(shellSection, /(?<![A-Za-z0-9_-])operations-panel(?![A-Za-z0-9_-])/, "Shell should not keep the generic operations-panel class");
  assert.doesNotMatch(shellSection, /(?<![A-Za-z0-9_-])panel-heading(?![A-Za-z0-9_-])/, "Shell should not keep the generic panel-heading class");
  assert.doesNotMatch(shellSection, /(?<![A-Za-z0-9_-])quick-actions(?![A-Za-z0-9_-])/, "Shell should not keep the generic quick-actions class");
  assert.doesNotMatch(shellSection, /(?<![A-Za-z0-9_-])risk-board(?![A-Za-z0-9_-])/, "Shell should not keep the generic risk-board class");
  assert.match(styleSource, /\.art-page-breadcrumb/, "Styles should include Art breadcrumb layout");
  assert.match(styleSource, /\.art-worktab-bar/, "Styles should include Art worktab layout");
  assert.match(styleSource, /\.art-operations-panel/, "Styles should include the Art operations panel layout");
  assert.match(styleSource, /\.art-operations-heading/, "Styles should include the Art operations panel heading");
  assert.match(styleSource, /\.art-quick-actions/, "Styles should include Art quick action layout");
  assert.match(styleSource, /\.art-risk-board/, "Styles should include Art risk board layout");
  assert.doesNotMatch(styleSource, /\.page-breadcrumb(?![A-Za-z0-9_-])/, "Styles should remove the generic page-breadcrumb selector");
  assert.doesNotMatch(styleSource, /\.page-tabs(?![A-Za-z0-9_-])/, "Styles should remove the generic page-tabs selector");
  assert.doesNotMatch(styleSource, /\.operations-panel(?![A-Za-z0-9_-])/, "Styles should remove the legacy operations-panel selector");
  assert.doesNotMatch(styleSource, /\.panel-heading(?![A-Za-z0-9_-])/, "Styles should remove the legacy panel-heading selector");
  assert.doesNotMatch(styleSource, /\.quick-actions(?![A-Za-z0-9_-])/, "Styles should remove the legacy quick-actions selector");
  assert.doesNotMatch(styleSource, /\.risk-board(?![A-Za-z0-9_-])/, "Styles should remove the legacy risk-board selector");
});

test("Vue page tabs behave like an Art Design Pro worktab bar", async () => {
  const source = await readAppSource();
  const tabSection = sourceBetween(
    source,
    "<nav class=\"art-worktab-bar art-work-tab\"",
    "<section class=\"art-operations-panel\"",
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
  assert.match(tabSection, /art-worktab-scroll/, "Worktab should keep Art scrollable tab content");
  assert.match(tabSection, /art-worktab-action-trigger/, "Worktab should expose an Art dropdown trigger");
  assert.match(tabSection, /art-worktab-close/, "Worktab should use an Art close icon token");
  assert.match(tabSection, /@contextmenu\.prevent/, "Worktab should support a context menu action on tabs");
  assert.match(tabSection, /isPageTabFixed/, "Worktab should show fixed state");
  assert.match(tabSection, /workTabActions/, "Worktab dropdown should render bulk actions");
  assert.doesNotMatch(tabSection, /(?<![A-Za-z0-9_-])worktab-scroll(?![A-Za-z0-9_-])/, "Worktab should not keep the generic worktab-scroll class");
  assert.doesNotMatch(tabSection, /(?<![A-Za-z0-9_-])worktab-action-trigger(?![A-Za-z0-9_-])/, "Worktab should not keep the generic worktab-action-trigger class");
  assert.doesNotMatch(tabSection, /(?<![A-Za-z0-9_-])tab-close(?![A-Za-z0-9_-])/, "Worktab should not keep the generic tab-close class");
  assert.match(styleSource, /\.art-work-tab/, "Styles should include Art Design worktab shell");
  assert.match(styleSource, /\.art-worktab-scroll/, "Styles should include Art worktab scroll area");
  assert.match(styleSource, /\.art-worktab-action-trigger/, "Styles should include Art worktab action trigger");
  assert.match(styleSource, /\.art-worktab-close/, "Styles should include Art worktab close affordance");
  assert.doesNotMatch(styleSource, /\.worktab-scroll(?![A-Za-z0-9_-])/, "Styles should remove the generic worktab-scroll selector");
  assert.doesNotMatch(styleSource, /\.worktab-action-trigger(?![A-Za-z0-9_-])/, "Styles should remove the generic worktab-action-trigger selector");
  assert.doesNotMatch(styleSource, /\.tab-close(?![A-Za-z0-9_-])/, "Styles should remove the generic tab-close selector");
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
  assert.match(topbarSection, /art-header-tools/, "Topbar should render an Art header tool group");
  assert.match(topbarSection, /art-header-tool/, "Topbar buttons should use Art header tool tokens");
  assert.doesNotMatch(topbarSection, /topbar-actions/, "Topbar should not keep the generic topbar-actions class");
  assert.match(topbarSection, /art-header-search/, "Topbar should render an Art global search control");
  assert.match(topbarSection, /art-header-notification-entry/, "Topbar should render an Art notification entry");
  assert.match(topbarSection, /art-header-settings-entry/, "Topbar should render an Art settings entry");
  assert.match(topbarSection, /art-header-user-entry/, "Topbar should render an Art user entry");
  assert.doesNotMatch(topbarSection, /(?<![A-Za-z0-9_-])header-tools(?![A-Za-z0-9_-])/, "Topbar should not keep the generic header-tools class");
  assert.doesNotMatch(topbarSection, /(?<![A-Za-z0-9_-])header-tool(?![A-Za-z0-9_-])/, "Topbar should not keep the generic header-tool class");
  assert.doesNotMatch(topbarSection, /(?<![A-Za-z0-9_-])global-search(?![A-Za-z0-9_-])/, "Topbar should not keep the generic global-search class");
  assert.doesNotMatch(topbarSection, /(?<![A-Za-z0-9_-])notification-entry(?![A-Za-z0-9_-])/, "Topbar should not keep the generic notification-entry class");
  assert.doesNotMatch(topbarSection, /(?<![A-Za-z0-9_-])settings-entry(?![A-Za-z0-9_-])/, "Topbar should not keep the generic settings-entry class");
  assert.doesNotMatch(topbarSection, /(?<![A-Za-z0-9_-])user-entry(?![A-Za-z0-9_-])/, "Topbar should not keep the generic user-entry class");
  assert.match(styleSource, /\.art-header-actions/, "Styles should include Art header action group layout");
  assert.doesNotMatch(styleSource, /\.topbar-actions\b/, "Styles should remove the legacy topbar-actions selector");
  assert.match(styleSource, /\.art-header-tools/, "Styles should include Art header tools layout");
  assert.match(styleSource, /\.art-header-search/, "Styles should include Art global search layout");
  assert.match(styleSource, /\.art-header-notification-entry/, "Styles should include Art notification entry styling");
  assert.match(styleSource, /\.art-header-settings-entry/, "Styles should include Art settings entry styling");
  assert.match(styleSource, /\.art-header-user-entry/, "Styles should include Art user entry styling");
  assert.doesNotMatch(styleSource, /\.header-tools(?![A-Za-z0-9_-])/, "Styles should remove the generic header-tools selector");
  assert.doesNotMatch(styleSource, /\.header-tool(?![A-Za-z0-9_-])/, "Styles should remove the generic header-tool selector");
  assert.doesNotMatch(styleSource, /\.global-search(?![A-Za-z0-9_-])/, "Styles should remove the generic global-search selector");
  assert.doesNotMatch(styleSource, /\.notification-entry(?![A-Za-z0-9_-])/, "Styles should remove the generic notification-entry selector");
  assert.doesNotMatch(styleSource, /\.settings-entry(?![A-Za-z0-9_-])/, "Styles should remove the generic settings-entry selector");
  assert.doesNotMatch(styleSource, /\.user-entry(?![A-Za-z0-9_-])/, "Styles should remove the generic user-entry selector");
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
  assert.match(shellSection, /art-sidebar-brand/, "Sidebar should render an Art sidebar brand block");
  assert.match(shellSection, /art-sidebar-logo/, "Sidebar should render an Art sidebar logo");
  assert.match(shellSection, /art-sidebar-nav/, "Sidebar should render an Art sidebar navigation list");
  assert.match(shellSection, /art-sidebar-footer/, "Sidebar should render an Art sidebar footer");
  assert.match(shellSection, /menu-left-open/, "Sidebar should expose an open state class");
  assert.match(shellSection, /menu-left-close/, "Sidebar should expose a collapsed state class");
  assert.match(shellSection, /menu-model/, "Shell should render a mobile menu overlay model");
  assert.doesNotMatch(shellSection, /(?<![A-Za-z0-9_-])sidebar-brand(?![A-Za-z0-9_-])/, "Sidebar should not keep the generic sidebar-brand class");
  assert.doesNotMatch(shellSection, /(?<![A-Za-z0-9_-])sidebar-nav(?![A-Za-z0-9_-])/, "Sidebar should not keep the generic sidebar-nav class");
  assert.doesNotMatch(shellSection, /(?<![A-Za-z0-9_-])sidebar-footer(?![A-Za-z0-9_-])/, "Sidebar should not keep the generic sidebar-footer class");
  assert.doesNotMatch(shellSection, /(?<![A-Za-z0-9_-])brand-logo(?![A-Za-z0-9_-])/, "Sidebar should not keep the generic brand-logo class");
  assert.match(topbarSection, /header-menu-trigger/, "Topbar should render the ArtHeaderBar menu trigger");
  assert.match(topbarSection, /@click="toggleMenuVisibility"/, "Menu trigger should toggle sidebar visibility");
  assert.match(styleSource, /\.layout-sidebar/, "Styles should include ArtSidebarMenu layout shell");
  assert.match(styleSource, /\.art-sidebar-brand/, "Styles should include Art sidebar brand styling");
  assert.match(styleSource, /\.art-sidebar-logo/, "Styles should include Art sidebar logo styling");
  assert.match(styleSource, /\.art-sidebar-nav/, "Styles should include Art sidebar navigation styling");
  assert.match(styleSource, /\.art-sidebar-footer/, "Styles should include Art sidebar footer styling");
  assert.match(styleSource, /\.menu-left-open/, "Styles should include sidebar open state");
  assert.match(styleSource, /\.menu-left-close/, "Styles should include sidebar close state");
  assert.match(styleSource, /\.menu-model/, "Styles should include mobile overlay model");
  assert.match(styleSource, /\.header-menu-trigger/, "Styles should include header menu trigger");
  assert.doesNotMatch(styleSource, /\.sidebar-brand(?![A-Za-z0-9_-])/, "Styles should remove the generic sidebar-brand selector");
  assert.doesNotMatch(styleSource, /\.sidebar-nav(?![A-Za-z0-9_-])/, "Styles should remove the generic sidebar-nav selector");
  assert.doesNotMatch(styleSource, /\.sidebar-footer(?![A-Za-z0-9_-])/, "Styles should remove the generic sidebar-footer selector");
  assert.doesNotMatch(styleSource, /\.brand-logo(?![A-Za-z0-9_-])/, "Styles should remove the generic brand-logo selector");
});

test("Vue narrow-screen styles protect tables drawers logs and system panels", async () => {
  const styleSource = await readFile(new URL("../../admin/src/styles/art-design-admin.css", import.meta.url), "utf8");

  assert.match(styleSource, /@media \(max-width: 720px\)/, "Styles should keep a narrow-screen breakpoint");
  assert.match(styleSource, /@media \(max-width: 720px\)[\s\S]*\.art-table-workspace,[\s\S]*overflow-x: auto/, "Narrow tables should be horizontally scrollable");
  assert.match(styleSource, /@media \(max-width: 720px\)[\s\S]*\.art-system-panel-body :deep\(\.el-table\)[\s\S]*min-width: 680px/, "System tables should keep a stable scan width on phones");
  assert.match(styleSource, /@media \(max-width: 720px\)[\s\S]*\.config-drawer\.el-drawer,[\s\S]*\.art-log-detail-drawer\.el-drawer,[\s\S]*width: 100vw !important/, "Config and log drawers should fill the phone viewport");
  assert.match(styleSource, /@media \(max-width: 720px\)[\s\S]*\.art-detail-panel-header,[\s\S]*\.art-system-panel-header,[\s\S]*flex-direction: column/, "Detail and system panel headers should stack on narrow screens");
  assert.match(styleSource, /@media \(max-width: 720px\)[\s\S]*\.art-detail-action-bar strong,[\s\S]*white-space: normal/, "Log detail footer text should wrap instead of clipping");
  assert.match(styleSource, /@media \(max-width: 720px\)[\s\S]*\.art-curl-block[\s\S]*max-width: calc\(100vw - 48px\)/, "Curl replay blocks should stay inside the viewport");
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
  assert.match(notificationPanel, /art-notification-panel-head/, "Notification panel should render an Art header");
  assert.match(notificationPanel, /art-notification-tab-bar/, "Notification panel should render Art tabs");
  assert.match(notificationPanel, /art-notification-list/, "Notification panel should render an Art preview list");
  assert.match(notificationPanel, /art-notification-empty/, "Notification panel should render an Art empty state");
  assert.match(notificationPanel, /art-notification-view-all/, "Notification panel should render an Art view-all action");
  assert.doesNotMatch(notificationPanel, /(?<![A-Za-z0-9_-])notification-panel-head(?![A-Za-z0-9_-])/, "Notification panel should not keep the generic notification-panel-head class");
  assert.doesNotMatch(notificationPanel, /(?<![A-Za-z0-9_-])notification-tab-bar(?![A-Za-z0-9_-])/, "Notification panel should not keep the generic notification-tab-bar class");
  assert.doesNotMatch(notificationPanel, /(?<![A-Za-z0-9_-])notification-list(?![A-Za-z0-9_-])/, "Notification panel should not keep the generic notification-list class");
  assert.doesNotMatch(notificationPanel, /(?<![A-Za-z0-9_-])notification-empty(?![A-Za-z0-9_-])/, "Notification panel should not keep the generic notification-empty class");
  assert.doesNotMatch(notificationPanel, /(?<![A-Za-z0-9_-])notification-view-all(?![A-Za-z0-9_-])/, "Notification panel should not keep the generic notification-view-all class");
  assert.match(notificationPanel, /@click="viewAllNotifications"/, "Notification panel should link to the full alerts page");
  assert.match(styleSource, /\.art-notification-panel/, "Styles should include notification panel shell");
  assert.match(styleSource, /\.art-notification-panel-head/, "Styles should include Art notification header");
  assert.match(styleSource, /\.art-notification-tab-bar/, "Styles should include Art notification tabs");
  assert.match(styleSource, /\.art-notification-list/, "Styles should include Art notification list");
  assert.match(styleSource, /\.art-notification-empty/, "Styles should include Art notification empty state");
  assert.match(styleSource, /\.art-notification-view-all/, "Styles should include Art notification view-all action");
  assert.doesNotMatch(styleSource, /\.notification-panel-head(?![A-Za-z0-9_-])/, "Styles should remove the generic notification-panel-head selector");
  assert.doesNotMatch(styleSource, /\.notification-tab-bar(?![A-Za-z0-9_-])/, "Styles should remove the generic notification-tab-bar selector");
  assert.doesNotMatch(styleSource, /\.notification-list(?![A-Za-z0-9_-])/, "Styles should remove the generic notification-list selector");
  assert.doesNotMatch(styleSource, /\.notification-empty(?![A-Za-z0-9_-])/, "Styles should remove the generic notification-empty selector");
  assert.doesNotMatch(styleSource, /\.notification-view-all(?![A-Za-z0-9_-])/, "Styles should remove the generic notification-view-all selector");
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
  assert.match(searchDialog, /art-command-search-input/, "Command dialog should include a focused Art search input");
  assert.match(searchDialog, /art-command-result-list/, "Command dialog should render Art command results");
  assert.match(searchDialog, /art-command-empty/, "Command dialog should render an Art empty state");
  assert.match(searchDialog, /art-command-shortcuts/, "Command dialog should show Art keyboard affordances");
  assert.doesNotMatch(searchDialog, /(?<![A-Za-z0-9_-])command-search-input(?![A-Za-z0-9_-])/, "Command dialog should not keep the generic command-search-input class");
  assert.doesNotMatch(searchDialog, /(?<![A-Za-z0-9_-])command-result-list(?![A-Za-z0-9_-])/, "Command dialog should not keep the generic command-result-list class");
  assert.doesNotMatch(searchDialog, /(?<![A-Za-z0-9_-])global-search-empty(?![A-Za-z0-9_-])/, "Command dialog should not keep the generic global-search-empty class");
  assert.doesNotMatch(searchDialog, /(?<![A-Za-z0-9_-])command-shortcuts(?![A-Za-z0-9_-])/, "Command dialog should not keep the generic command-shortcuts class");
  assert.match(searchDialog, /@click="selectHeaderSearch/, "Command results should navigate to modules");
  assert.match(styleSource, /\.global-search-command/, "Styles should include command dialog shell");
  assert.match(styleSource, /\.art-command-search-input/, "Styles should include Art command search input");
  assert.match(styleSource, /\.art-command-result-list/, "Styles should include Art command result list");
  assert.match(styleSource, /\.art-command-empty/, "Styles should include Art command empty state");
  assert.match(styleSource, /\.art-command-shortcuts/, "Styles should include Art keyboard shortcut footer");
  assert.doesNotMatch(styleSource, /\.command-search-input(?![A-Za-z0-9_-])/, "Styles should remove the generic command-search-input selector");
  assert.doesNotMatch(styleSource, /\.command-result-list(?![A-Za-z0-9_-])/, "Styles should remove the generic command-result-list selector");
  assert.doesNotMatch(styleSource, /\.global-search-empty(?![A-Za-z0-9_-])/, "Styles should remove the generic global-search-empty selector");
  assert.doesNotMatch(styleSource, /\.command-shortcuts(?![A-Za-z0-9_-])/, "Styles should remove the generic command-shortcuts selector");
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
  assert.match(settingsDrawer, /art-setting-panel-header/, "Settings panel should render an Art header");
  assert.match(settingsDrawer, /art-setting-section/g, "Settings panel should group preferences into Art sections");
  assert.match(settingsDrawer, /art-setting-section-title/, "Settings sections should render Art section titles");
  assert.match(settingsDrawer, /art-setting-option-grid/, "Settings panel should render Art selectable option cards");
  assert.match(settingsDrawer, /art-setting-density-preview/, "Settings panel should render an Art density preview");
  assert.match(settingsDrawer, /art-setting-actions/, "Settings footer should use Art actions");
  assert.doesNotMatch(settingsDrawer, /(?<![A-Za-z0-9_-])setting-panel-header(?![A-Za-z0-9_-])/, "Settings panel should not keep the generic setting-panel-header class");
  assert.doesNotMatch(settingsDrawer, /(?<![A-Za-z0-9_-])setting-section(?![A-Za-z0-9_-])/, "Settings panel should not keep the generic setting-section class");
  assert.doesNotMatch(settingsDrawer, /(?<![A-Za-z0-9_-])setting-section-title(?![A-Za-z0-9_-])/, "Settings panel should not keep the generic setting-section-title class");
  assert.doesNotMatch(settingsDrawer, /(?<![A-Za-z0-9_-])setting-option-grid(?![A-Za-z0-9_-])/, "Settings panel should not keep the generic setting-option-grid class");
  assert.doesNotMatch(settingsDrawer, /(?<![A-Za-z0-9_-])setting-density-preview(?![A-Za-z0-9_-])/, "Settings panel should not keep the generic setting-density-preview class");
  assert.doesNotMatch(settingsDrawer, /(?<![A-Za-z0-9_-])setting-actions(?![A-Za-z0-9_-])/, "Settings panel should not keep the generic setting-actions class");
  assert.match(settingsDrawer, /v-model="themeMode"/, "Settings panel should control the shell theme");
  assert.match(settingsDrawer, /v-model="tableDensity"/, "Settings panel should control table density");
  assert.match(styleSource, /\.art-settings-panel/, "Styles should include the settings panel shell");
  assert.match(styleSource, /\.art-setting-panel-header/, "Styles should include Art settings panel header styling");
  assert.match(styleSource, /\.art-setting-section/, "Styles should include Art settings sections");
  assert.match(styleSource, /\.art-setting-section-title/, "Styles should include Art settings section titles");
  assert.match(styleSource, /\.art-setting-option-grid/, "Styles should include Art settings option card layout");
  assert.match(styleSource, /\.art-setting-density-preview/, "Styles should include Art density preview styling");
  assert.match(styleSource, /\.art-setting-actions/, "Styles should include Art settings actions");
  assert.doesNotMatch(styleSource, /\.setting-panel-header(?![A-Za-z0-9_-])/, "Styles should remove the generic setting-panel-header selector");
  assert.doesNotMatch(styleSource, /\.setting-section(?![A-Za-z0-9_-])/, "Styles should remove the generic setting-section selector");
  assert.doesNotMatch(styleSource, /\.setting-section-title(?![A-Za-z0-9_-])/, "Styles should remove the generic setting-section-title selector");
  assert.doesNotMatch(styleSource, /\.setting-option-grid(?![A-Za-z0-9_-])/, "Styles should remove the generic setting-option-grid selector");
  assert.doesNotMatch(styleSource, /\.setting-density-preview(?![A-Za-z0-9_-])/, "Styles should remove the generic setting-density-preview selector");
  assert.doesNotMatch(styleSource, /\.setting-actions(?![A-Za-z0-9_-])/, "Styles should remove the generic setting-actions selector");
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
    assert.match(section, /art-table-workspace/, "Management section should render an Art table workspace wrapper");
    assert.match(section, /art-table-toolbar/, "Management section should render an Art table toolbar");
    assert.doesNotMatch(section, /(?<![A-Za-z0-9_-])table-workspace(?![A-Za-z0-9_-])/, "Management section should not keep the generic table-workspace class");
    assert.doesNotMatch(section, /(?<![A-Za-z0-9_-])table-toolbar(?![A-Za-z0-9_-])/, "Management section should not keep the generic table-toolbar class");
    assert.match(section, /tableSearch/, "Management section should expose module search");
    assert.match(section, /tableDensity/, "Management section should expose density controls");
    assert.match(section, /:size="tableSize"/, "Management table should respect density size");
  }

  assert.match(interfaceSection, /filteredInterfaces/, "Interface table should render filtered rows");
  assert.match(upstreamSection, /filteredUpstreams/, "Upstream table should render filtered rows");
  assert.match(modelSection, /filteredModels/, "Model table should render filtered rows");
  assert.match(qualitySection, /filteredPresets/, "Quality preset table should render filtered rows");
  assert.match(styleSource, /\.art-table-workspace/, "Styles should include Art table workspace layout");
  assert.match(styleSource, /\.art-table-toolbar/, "Styles should include Art table toolbar layout");
  assert.doesNotMatch(styleSource, /\.table-workspace(?![A-Za-z0-9_-])/, "Styles should remove the legacy table-workspace selector");
  assert.doesNotMatch(styleSource, /\.table-toolbar(?![A-Za-z0-9_-])/, "Styles should remove the legacy table-toolbar selector");
  assert.doesNotMatch(styleSource, /\.toolbar-meta\b/, "Styles should remove the unused legacy toolbar-meta selector");
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
    assert.match(section, /art-table-header-main/, "Art table header should include the title/search side");
    assert.match(section, /art-table-header-tools/, "Art table header should include the tool cluster");
    assert.match(section, /art-table-tool-button/, "Art table header should render compact tool buttons");
    assert.doesNotMatch(section, /(?<![A-Za-z0-9_-])table-header-main(?![A-Za-z0-9_-])/, "Art table header should not keep the generic table-header-main class");
    assert.doesNotMatch(section, /(?<![A-Za-z0-9_-])table-header-tools(?![A-Za-z0-9_-])/, "Art table header should not keep the generic table-header-tools class");
    assert.doesNotMatch(section, /(?<![A-Za-z0-9_-])table-tool-button(?![A-Za-z0-9_-])/, "Art table header should not keep the generic table-tool-button class");
    assert.match(section, /tableHeaderTools/, "Art table header should render the shared tool list");
    assert.match(section, /art-toolbar-actions/, "Art table header should use the shared Art toolbar action cluster");
    assert.doesNotMatch(section, /class="toolbar-actions"/, "Art table header should not keep the legacy toolbar actions class");
  }
  assert.match(styleSource, /\.art-table-card/, "Styles should include Art table card shell");
  assert.match(styleSource, /\.art-table-header/, "Styles should include ArtTableHeader layout");
  assert.match(styleSource, /\.art-table-header-main/, "Styles should include Art table header main layout");
  assert.match(styleSource, /\.art-table-header-tools/, "Styles should include Art table header tool cluster");
  assert.match(styleSource, /\.art-table-tool-button/, "Styles should include Art compact table tool buttons");
  assert.match(styleSource, /\.art-toolbar-actions/, "Styles should include the shared Art toolbar actions class");
  assert.doesNotMatch(styleSource, /\.table-header-main(?![A-Za-z0-9_-])/, "Styles should remove the legacy table-header-main selector");
  assert.doesNotMatch(styleSource, /\.table-header-tools(?![A-Za-z0-9_-])/, "Styles should remove the legacy table-header-tools selector");
  assert.doesNotMatch(styleSource, /\.table-tool-button(?![A-Za-z0-9_-])/, "Styles should remove the legacy table-tool-button selector");
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
  assert.doesNotMatch(styleSource, /\.art-table-header-main \.card-title/, "Styles should no longer target legacy table card titles");
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
  assert.match(interfaceSection, /art-table-search-input/, "Interface search input should use an Art table search class");
  assert.match(interfaceSection, /v-show="isTableSearchVisible\('interfaces'\)"/, "Interface search input should be hideable");
  assert.match(upstreamSection, /art-table-search-input/, "Upstream search input should use an Art table search class");
  assert.match(upstreamSection, /v-show="isTableSearchVisible\('upstreams'\)"/, "Upstream search input should be hideable");
  assert.match(modelSection, /art-table-search-input/, "Model search input should use an Art table search class");
  assert.match(modelSection, /v-show="isTableSearchVisible\('models'\)"/, "Model search input should be hideable");
  assert.match(qualitySection, /art-table-search-input/, "Quality search input should use an Art table search class");
  assert.match(qualitySection, /v-show="isTableSearchVisible\('quality'\)"/, "Quality search input should be hideable");
  for (const section of [interfaceSection, upstreamSection, modelSection, qualitySection]) {
    assert.doesNotMatch(section, /(?<![A-Za-z0-9_-])table-search-input(?![A-Za-z0-9_-])/, "Management table search should not keep the generic table-search-input class");
  }
  assert.match(styleSource, /\.art-table-header-main\.search-hidden/, "Styles should define hidden-search header layout");
  assert.match(styleSource, /\.art-table-header-main \.art-table-search-input/, "Styles should scope Art table search inputs");
  assert.doesNotMatch(styleSource, /\.table-search-input(?![A-Za-z0-9_-])/, "Styles should remove the legacy table-search-input selector");
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
  assert.match(source, /art-column-settings-popover/, "Template should render an Art column settings popover");
  assert.match(source, /art-column-settings-panel/, "Template should render an Art column settings panel");
  assert.match(source, /art-column-settings-head/, "Template should render an Art column settings header");
  assert.match(source, /art-column-option-list/, "Template should render an Art column option list");
  assert.match(source, /art-column-option-row/, "Template should render Art column option rows");
  assert.match(source, /art-column-drag-icon/, "Template should render an Art drag affordance");
  assert.match(source, /art-column-settings-anchor/, "Template should render an Art popover anchor");
  assert.doesNotMatch(source, /(?<![A-Za-z0-9_-])column-settings-popover(?![A-Za-z0-9_-])/, "Template should not keep the generic column-settings-popover class");
  assert.doesNotMatch(source, /(?<![A-Za-z0-9_-])column-settings-panel(?![A-Za-z0-9_-])/, "Template should not keep the generic column-settings-panel class");
  assert.doesNotMatch(source, /(?<![A-Za-z0-9_-])column-settings-head(?![A-Za-z0-9_-])/, "Template should not keep the generic column-settings-head class");
  assert.doesNotMatch(source, /(?<![A-Za-z0-9_-])column-option-list(?![A-Za-z0-9_-])/, "Template should not keep the generic column-option-list class");
  assert.doesNotMatch(source, /(?<![A-Za-z0-9_-])column-option-row(?![A-Za-z0-9_-])/, "Template should not keep the generic column-option-row class");
  assert.doesNotMatch(source, /(?<![A-Za-z0-9_-])drag-icon(?![A-Za-z0-9_-])/, "Template should not keep the generic drag-icon class");
  assert.doesNotMatch(source, /(?<![A-Za-z0-9_-])column-settings-anchor(?![A-Za-z0-9_-])/, "Template should not keep the generic column-settings-anchor class");
  assert.match(source, /@update:model-value=".*toggleTableColumn/, "Column checkboxes should update visibility");

  assert.match(interfaceSection, /isTableColumnVisible\('interfaces', 'apiToken'\)/, "Interface API Key column should be hideable");
  assert.match(interfaceSection, /isTableColumnVisible\('interfaces', 'lastUsedAt'\)/, "Interface last-used column should be hideable");
  assert.match(upstreamSection, /isTableColumnVisible\('upstreams', 'baseURL'\)/, "Upstream Base URL column should be hideable");
  assert.match(upstreamSection, /isTableColumnVisible\('upstreams', 'health'\)/, "Upstream health column should be hideable");
  assert.match(modelSection, /isTableColumnVisible\('models', 'capabilities'\)/, "Model capabilities column should be hideable");
  assert.match(modelSection, /isTableColumnVisible\('models', 'recommendedUse'\)/, "Model use-case column should be hideable");
  assert.match(qualitySection, /isTableColumnVisible\('quality', 'quality'\)/, "Quality preset quality column should be hideable");
  assert.match(qualitySection, /isTableColumnVisible\('quality', 'useCase'\)/, "Quality preset use-case column should be hideable");
  assert.match(styleSource, /\.art-column-settings-popover/, "Styles should include Art column settings popover");
  assert.match(styleSource, /\.art-column-settings-panel/, "Styles should include Art column settings panel");
  assert.match(styleSource, /\.art-column-settings-head/, "Styles should include Art column settings header");
  assert.match(styleSource, /\.art-column-option-list/, "Styles should include Art column option list");
  assert.match(styleSource, /\.art-column-option-row/, "Styles should include Art column option rows");
  assert.match(styleSource, /\.art-column-drag-icon/, "Styles should include Art drag affordance");
  assert.match(styleSource, /\.art-column-settings-anchor/, "Styles should include Art column settings anchor");
  assert.doesNotMatch(styleSource, /\.column-settings-popover(?![A-Za-z0-9_-])/, "Styles should remove the legacy column-settings-popover selector");
  assert.doesNotMatch(styleSource, /\.column-settings-panel(?![A-Za-z0-9_-])/, "Styles should remove the legacy column-settings-panel selector");
  assert.doesNotMatch(styleSource, /\.column-settings-head(?![A-Za-z0-9_-])/, "Styles should remove the legacy column-settings-head selector");
  assert.doesNotMatch(styleSource, /\.column-option-list(?![A-Za-z0-9_-])/, "Styles should remove the legacy column-option-list selector");
  assert.doesNotMatch(styleSource, /\.column-option-row(?![A-Za-z0-9_-])/, "Styles should remove the legacy column-option-row selector");
  assert.doesNotMatch(styleSource, /\.drag-icon(?![A-Za-z0-9_-])/, "Styles should remove the legacy drag-icon selector");
  assert.doesNotMatch(styleSource, /\.column-settings-anchor(?![A-Za-z0-9_-])/, "Styles should remove the legacy column-settings-anchor selector");
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
    assert.match(section, /art-table-custom-pagination/, "Pagination footer should use the ArtTable custom pagination token");
    assert.doesNotMatch(section, /(?<![A-Za-z0-9_-])custom-pagination(?![A-Za-z0-9_-])/, "Pagination footer should not keep the generic custom-pagination token");
    assert.match(section, /:current-page="tableEffectiveCurrentPage/, "Pagination footer should bind a clamped current page");
    assert.match(section, /@size-change="/, "Pagination footer should handle page size changes");
    assert.match(section, /@current-change="/, "Pagination footer should handle current page changes");
  }
  assert.match(styleSource, /\.art-table-pagination/, "Styles should include ArtTable pagination footer");
  assert.match(styleSource, /\.art-table-custom-pagination/, "Styles should include Art custom pagination controls");
  assert.doesNotMatch(styleSource, /\.custom-pagination(?![A-Za-z0-9_-])/, "Styles should remove the legacy custom-pagination selector");
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
  assert.match(qualitySection, /art-quality-case-panel-header/, "Quality case panel should use a structured header");
  assert.match(qualitySection, /art-quality-case-panel-title/, "Quality case panel should expose title and helper copy");
  assert.match(qualitySection, /art-quality-case-panel-badge/, "Quality case panel should show case counts as badges");
  assert.match(qualitySection, /art-quality-case-panel-tools/, "Quality case panel should group compact actions");
  assert.match(qualitySection, /qualityBackfillPresetId/, "Quality case panel should choose a preset backfill target");
  assert.match(qualitySection, /qualityCaseSuggestions/, "Quality case panel should render generated suggestions");
  assert.match(qualitySection, /applyQualityCaseSuggestion/, "Quality case panel should apply suggestions to prompt presets");
  assert.match(qualitySection, /art-quality-suggestion-list/, "Quality case rows should show suggestion previews");
  assert.match(qualitySection, /art-table-action-button action-view/, "Quality case rows should use icon action buttons");
  assert.match(qualitySection, /aria-label="回填质量建议到预设"/, "Quality case apply action should be accessible");
  assert.match(qualitySection, /aria-label="查看质量案例日志"/, "Quality case log action should be accessible");
  assert.match(styleSource, /\.art-quality-case-panel/, "Styles should include the quality case panel shell");
  assert.match(styleSource, /\.art-quality-case-panel-header/, "Styles should include quality case panel header");
  assert.match(styleSource, /\.art-quality-case-panel-badge/, "Styles should include quality case badges");
  assert.match(styleSource, /\.art-quality-suggestion-list/, "Styles should include quality suggestion previews");
  for (const oldToken of [
    "quality-case-panel-header",
    "quality-case-panel-title",
    "quality-case-panel-badge",
    "quality-case-panel-tools",
  ]) {
    assert.doesNotMatch(qualitySection, classTokenPattern(oldToken), `Quality case panel should not keep old ${oldToken} token`);
    assert.doesNotMatch(styleSource, cssClassSelectorPattern(oldToken), `Styles should not keep old ${oldToken} selector`);
  }
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
  assert.match(qualitySection, /art-preset-card-header/, "Preset cards should expose a structured header");
  assert.match(qualitySection, /art-preset-card-title/, "Preset cards should expose a title block");
  assert.match(qualitySection, /art-preset-card-meta/, "Preset cards should expose compact metadata");
  assert.match(qualitySection, /art-preset-card-body/, "Preset cards should expose a body section");
  assert.match(qualitySection, /art-preset-card-footer/, "Preset cards should expose footer actions");
  assert.doesNotMatch(qualitySection, /class="preset-card"/, "Preset cards should no longer use the legacy card class");
  assert.match(styleSource, /\.art-preset-grid/, "Styles should include the Art preset grid");
  assert.match(styleSource, /\.art-preset-card/, "Styles should include preset card shell styling");
  assert.match(styleSource, /\.art-preset-card-header/, "Styles should include preset card header styling");
  assert.match(styleSource, /\.art-preset-card-footer/, "Styles should include preset card footer styling");
  for (const oldToken of [
    "preset-card-header",
    "preset-card-icon",
    "preset-card-title",
    "preset-card-meta",
    "preset-card-body",
    "preset-card-footer",
    "preset-list-table",
  ]) {
    assert.doesNotMatch(qualitySection, classTokenPattern(oldToken), `Preset cards should not keep old ${oldToken} token`);
    assert.doesNotMatch(styleSource, cssClassSelectorPattern(oldToken), `Styles should not keep old ${oldToken} selector`);
  }
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
  assert.match(styleSource, /\.art-table-workspace :deep\(\.el-table__empty-block\)/, "Styles should give empty tables stable template-like height");
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
  assert.match(drawerSection, /art-drawer-overview/, "Config drawer should render an Art overview header");
  assert.match(drawerSection, /art-drawer-status-grid/, "Config drawer should render Art status cards");
  assert.match(drawerSection, /art-drawer-section/, "Config drawer should group fields into Art sections");
  assert.match(drawerSection, /art-drawer-section-title/, "Config drawer sections should use Art section titles");
  assert.match(drawerSection, /art-drawer-form/, "Config drawer forms should use an Art drawer form shell");
  assert.match(drawerSection, /art-drawer-form-grid/, "Config drawer should use an Art structured field grid");
  assert.match(drawerSection, /art-drawer-form-wide/, "Wide config drawer fields should use an Art grid span class");
  assert.match(drawerSection, /art-secret-line/, "Config drawer secret controls should use an Art secret action row");
  assert.match(drawerSection, /art-drawer-footer-actions/, "Config drawer should render an Art sticky action bar");
  assert.doesNotMatch(drawerSection, /(?<![A-Za-z0-9_-])drawer-overview(?![A-Za-z0-9_-])/, "Config drawer should not keep the generic drawer-overview class");
  assert.doesNotMatch(drawerSection, /(?<![A-Za-z0-9_-])drawer-status-grid(?![A-Za-z0-9_-])/, "Config drawer should not keep the generic drawer-status-grid class");
  assert.doesNotMatch(drawerSection, /(?<![A-Za-z0-9_-])drawer-footer-actions(?![A-Za-z0-9_-])/, "Config drawer should not keep the generic drawer-footer-actions class");
  assert.doesNotMatch(drawerSection, /(?<![A-Za-z0-9_-])drawer-section(?![A-Za-z0-9_-])/, "Config drawer should not keep the generic drawer-section class");
  assert.doesNotMatch(drawerSection, /(?<![A-Za-z0-9_-])drawer-section-title(?![A-Za-z0-9_-])/, "Config drawer should not keep the generic drawer-section-title class");
  assert.doesNotMatch(drawerSection, /(?<![A-Za-z0-9_-])drawer-form(?![A-Za-z0-9_-])/, "Config drawer should not keep the generic drawer-form class");
  assert.doesNotMatch(drawerSection, /(?<![A-Za-z0-9_-])drawer-form-grid(?![A-Za-z0-9_-])/, "Config drawer should not keep the generic drawer-form-grid class");
  assert.doesNotMatch(drawerSection, /(?<![A-Za-z0-9_-])drawer-form-wide(?![A-Za-z0-9_-])/, "Config drawer should not keep the generic drawer-form-wide class");
  assert.doesNotMatch(drawerSection, /(?<![A-Za-z0-9_-])secret-line(?![A-Za-z0-9_-])/, "Config drawer should not keep the generic secret-line class");
  assert.match(styleSource, /\.config-drawer/, "Styles should include config drawer styling");
  assert.match(styleSource, /\.art-drawer-overview/, "Styles should include Art drawer overview styling");
  assert.match(styleSource, /\.art-drawer-status-grid/, "Styles should include Art drawer status card styling");
  assert.match(styleSource, /\.art-drawer-section/, "Styles should include Art drawer section styling");
  assert.match(styleSource, /\.art-drawer-section-title/, "Styles should include Art drawer section title styling");
  assert.match(styleSource, /\.art-drawer-form/, "Styles should include Art drawer form shell styling");
  assert.match(styleSource, /\.art-drawer-form-grid/, "Styles should include Art drawer form grid styling");
  assert.match(styleSource, /\.art-drawer-form-wide/, "Styles should include Art wide drawer field styling");
  assert.match(styleSource, /\.art-secret-line/, "Styles should include Art secret action row styling");
  assert.match(styleSource, /\.art-drawer-footer-actions/, "Styles should include Art drawer footer action styling");
  assert.doesNotMatch(styleSource, /\.drawer-overview(?![A-Za-z0-9_-])/, "Styles should remove the legacy drawer-overview selector");
  assert.doesNotMatch(styleSource, /\.drawer-status-grid(?![A-Za-z0-9_-])/, "Styles should remove the legacy drawer-status-grid selector");
  assert.doesNotMatch(styleSource, /\.drawer-footer-actions(?![A-Za-z0-9_-])/, "Styles should remove the legacy drawer-footer-actions selector");
  assert.doesNotMatch(styleSource, /\.drawer-section(?![A-Za-z0-9_-])/, "Styles should remove the legacy drawer-section selector");
  assert.doesNotMatch(styleSource, /\.drawer-section-title(?![A-Za-z0-9_-])/, "Styles should remove the legacy drawer-section-title selector");
  assert.doesNotMatch(styleSource, /\.drawer-form(?![A-Za-z0-9_-])/, "Styles should remove the legacy drawer-form selector");
  assert.doesNotMatch(styleSource, /\.drawer-form-grid(?![A-Za-z0-9_-])/, "Styles should remove the legacy drawer-form-grid selector");
  assert.doesNotMatch(styleSource, /\.drawer-form-wide(?![A-Za-z0-9_-])/, "Styles should remove the legacy drawer-form-wide selector");
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
  assert.match(logSection, /art-log-workspace/, "Logs page should render an Art log workspace wrapper");
  assert.match(logSection, /art-log-summary-grid/, "Logs page should render compact Art summary cards");
  assert.match(logSection, /art-query-panel/, "Logs page should render an Art query panel");
  assert.match(logSection, /art-query-panel-heading/, "Logs query panel should render an Art query heading");
  assert.match(logSection, /art-search-form-grid/, "Query panel should use an ArtSearchBar form grid layout");
  assert.match(logSection, /art-search-form-item/, "Query panel fields should use Art search form items");
  assert.match(logSection, /art-result-toolbar/, "Logs page should render an Art result toolbar above tables");
  assert.match(source, /logClearOptions/, "Logs page should define clear-log target options");
  assert.match(source, /clearLogs/, "Logs page should expose a clear-log handler");
  assert.match(source, /CLEAR_LOGS/, "Logs clear flow should require an explicit confirmation phrase");
  assert.match(logSection, /art-log-clear-button/, "Result toolbar should expose a dedicated clear-log action");
  assert.match(logSection, /<el-dropdown/, "Clear-log action should use a dropdown for target selection");
  assert.match(source, /清 Docker stdout/, "Clear-log dropdown should expose Docker stdout as a separate target");
  for (const legacyClass of [
    "query-panel",
    "query-panel-heading",
    "search-form-item",
    "result-toolbar",
  ]) {
    assert.doesNotMatch(
      logSection,
      new RegExp(`(?<![A-Za-z0-9_-])${legacyClass}(?![A-Za-z0-9_-])`),
      `Logs page should not keep generic ${legacyClass} classes`,
    );
  }
  assert.match(logSection, /v-model="activeLogTab"/, "Logs tabs should bind the active tab");
  assert.match(logSection, /:size="tableSize"/, "Logs tables should respect shared density size");
  assert.match(logSection, /刷新日志/, "Result toolbar should include a clear refresh action");
  assert.match(styleSource, /\.art-log-workspace/, "Styles should include Art log workspace layout");
  assert.match(styleSource, /\.art-log-summary-grid/, "Styles should include Art log summary layout");
  assert.match(styleSource, /\.art-query-panel/, "Styles should include Art query panel layout");
  assert.match(styleSource, /\.art-result-toolbar/, "Styles should include Art result toolbar layout");
  assert.match(styleSource, /\.art-search-form-item/, "Styles should include Art search form item layout");
  assert.match(styleSource, /\.art-log-clear-button/, "Styles should include clear-log action styling");
  for (const oldToken of [
    "log-workspace",
    "log-summary-grid",
  ]) {
    assert.doesNotMatch(logSection, classTokenPattern(oldToken), `Logs page should not keep old ${oldToken} token`);
    assert.doesNotMatch(styleSource, cssClassSelectorPattern(oldToken), `Styles should not keep old ${oldToken} selector`);
  }
  for (const legacyClass of [
    "query-panel",
    "query-panel-heading",
    "search-form-item",
    "result-toolbar",
  ]) {
    assert.doesNotMatch(
      styleSource,
      new RegExp(`\\.${legacyClass}(?![A-Za-z0-9_-])`),
      `Styles should remove the generic ${legacyClass} selector`,
    );
  }
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
  assert.match(logSection, /art-log-panel-header/, "Logs panels should render structured headers");
  assert.match(logSection, /art-log-panel-title/, "Logs panels should expose title blocks");
  assert.match(logSection, /art-log-panel-meta/, "Logs panels should expose metadata/actions in headers");
  assert.match(logSection, /art-log-panel-body/, "Logs panels should wrap fields and tables in panel bodies");
  assert.match(logSection, /art-log-query-panel/, "Logs query area should use the shared Art panel shell");
  assert.match(logSection, /art-log-result-panel/, "Logs result area should use the shared Art panel shell");
  assert.doesNotMatch(logSection, /<div class="card-title"><Document \/>日志查询<\/div>/, "Logs query panel should not use the legacy card title");
  assert.doesNotMatch(logSection, /<div class="card-title"><DataAnalysis \/>日志结果<\/div>/, "Logs result panel should not use the legacy card title");
  assert.match(styleSource, /\.art-log-panel/, "Styles should include the Art log panel shell");
  assert.match(styleSource, /\.art-log-panel-header/, "Styles should include log panel header styling");
  assert.match(styleSource, /\.art-log-panel-body/, "Styles should include log panel body styling");
  for (const oldToken of [
    "log-query-panel",
    "log-result-panel",
    "log-panel-header",
    "log-panel-title",
    "log-panel-meta",
    "log-panel-body",
  ]) {
    assert.doesNotMatch(logSection, classTokenPattern(oldToken), `Logs page should not keep old ${oldToken} token`);
    assert.doesNotMatch(styleSource, cssClassSelectorPattern(oldToken), `Styles should not keep old ${oldToken} selector`);
  }
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
  assert.match(detailDrawer, /art-log-detail-drawer/, "Log detail drawer should apply a dedicated Art workspace class");
  assert.match(detailDrawer, /art-detail-stack/, "Log detail drawer should render an Art detail stack");
  assert.match(detailDrawer, /art-detail-overview/, "Log detail drawer should render an Art overview header");
  assert.match(detailDrawer, /art-detail-summary-grid/, "Log detail drawer should render Art summary cards");
  assert.match(detailDrawer, /art-detail-route-steps/, "Log detail drawer should render route steps");
  assert.match(detailDrawer, /art-detail-action-bar/, "Log detail drawer should render an Art action bar");
  assert.match(detailDrawer, /art-stream-detail-card/, "Log detail drawer should render stream diagnostics");
  assert.doesNotMatch(detailDrawer, /(?<![A-Za-z0-9_-])detail-stack(?![A-Za-z0-9_-])/, "Log detail drawer should not keep the generic detail-stack class");
  assert.doesNotMatch(detailDrawer, /(?<![A-Za-z0-9_-])detail-overview(?![A-Za-z0-9_-])/, "Log detail drawer should not keep the generic detail-overview class");
  assert.doesNotMatch(detailDrawer, /(?<![A-Za-z0-9_-])detail-summary-grid(?![A-Za-z0-9_-])/, "Log detail drawer should not keep the generic detail-summary-grid class");
  assert.doesNotMatch(detailDrawer, /(?<![A-Za-z0-9_-])detail-action-bar(?![A-Za-z0-9_-])/, "Log detail drawer should not keep the generic detail-action-bar class");
  assert.match(styleSource, /\.art-log-detail-drawer/, "Styles should include log detail drawer styling");
  assert.match(styleSource, /\.art-detail-stack/, "Styles should include Art detail stack styling");
  assert.match(styleSource, /\.art-detail-overview/, "Styles should include Art detail overview styling");
  assert.match(styleSource, /\.art-detail-summary-grid/, "Styles should include Art detail summary styling");
  assert.match(styleSource, /\.art-detail-route-steps/, "Styles should include route step styling");
  assert.match(styleSource, /\.art-detail-action-bar/, "Styles should include Art detail action bar styling");
  assert.doesNotMatch(styleSource, /\.detail-stack(?![A-Za-z0-9_-])/, "Styles should remove the legacy detail-stack selector");
  assert.doesNotMatch(styleSource, /\.detail-overview(?![A-Za-z0-9_-])/, "Styles should remove the legacy detail-overview selector");
  assert.doesNotMatch(styleSource, /\.detail-summary-grid(?![A-Za-z0-9_-])/, "Styles should remove the legacy detail-summary-grid selector");
  assert.doesNotMatch(styleSource, /\.detail-action-bar(?![A-Za-z0-9_-])/, "Styles should remove the legacy detail-action-bar selector");
  assert.doesNotMatch(detailDrawer, classTokenPattern("log-detail-drawer"), "Log detail drawer should not keep old log-detail-drawer token");
  assert.doesNotMatch(styleSource, cssClassSelectorPattern("log-detail-drawer"), "Styles should not keep old log-detail-drawer selector");
  assert.doesNotMatch(detailDrawer, classTokenPattern("detail-route-steps"), "Log detail drawer should not keep old detail-route-steps token");
  assert.doesNotMatch(styleSource, cssClassSelectorPattern("detail-route-steps"), "Styles should not keep old detail-route-steps selector");
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
  assert.match(detailDrawer, /art-detail-panel-header/, "Detail cards should render a structured header");
  assert.match(detailDrawer, /art-detail-panel-title/, "Detail cards should expose a title block");
  assert.match(detailDrawer, /art-detail-panel-meta/, "Detail cards should expose metadata in the header");
  assert.match(detailDrawer, /art-detail-panel-body/, "Detail cards should wrap content in a panel body");
  assert.match(detailDrawer, /art-detail-text/, "Diagnostic summary copy should use an Art detail text token");
  assert.match(detailDrawer, /art-curl-block/, "Sanitized replay command should use an Art curl block token");
  assert.match(detailDrawer, /art-route-detail-panel/, "Route card should use the shared detail panel shell");
  assert.match(detailDrawer, /art-diagnostic-detail-panel/, "Diagnostic card should use the shared detail panel shell");
  assert.match(detailDrawer, /art-curl-detail-panel/, "Curl card should use the shared detail panel shell");
  assert.doesNotMatch(detailDrawer, /(?<![A-Za-z0-9_-])detail-text(?![A-Za-z0-9_-])/, "Detail drawer should not keep the generic detail-text class");
  assert.doesNotMatch(detailDrawer, /(?<![A-Za-z0-9_-])curl-block(?![A-Za-z0-9_-])/, "Detail drawer should not keep the generic curl-block class");
  assert.doesNotMatch(detailDrawer, /<template #header><div class="card-title"/, "Log detail drawer should not use legacy one-line card titles");
  assert.match(styleSource, /\.art-detail-panel/, "Styles should include the Art detail panel shell");
  assert.match(styleSource, /\.art-detail-panel-header/, "Styles should include detail panel header styling");
  assert.match(styleSource, /\.art-detail-panel-body/, "Styles should include detail panel body styling");
  assert.match(styleSource, /\.art-detail-text/, "Styles should include Art detail text styling");
  assert.match(styleSource, /\.art-curl-block/, "Styles should include Art curl block styling");
  assert.match(styleSource, /\.art-stream-detail-card/, "Styles should include stream diagnostics styling");
  assert.doesNotMatch(styleSource, /\.detail-text(?![A-Za-z0-9_-])/, "Styles should remove the generic detail-text selector");
  assert.doesNotMatch(styleSource, /\.curl-block(?![A-Za-z0-9_-])/, "Styles should remove the generic curl-block selector");
  for (const oldToken of [
    "detail-route-card",
    "detail-diagnostic-card",
    "detail-curl-card",
    "detail-panel-header",
    "detail-panel-title",
    "detail-panel-meta",
    "detail-panel-body",
    "route-detail-panel",
    "diagnostic-detail-panel",
    "curl-detail-panel",
  ]) {
    assert.doesNotMatch(detailDrawer, classTokenPattern(oldToken), `Detail drawer should not keep old ${oldToken} token`);
    assert.doesNotMatch(styleSource, cssClassSelectorPattern(oldToken), `Styles should not keep old ${oldToken} selector`);
  }
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
  assert.match(usageSection, /art-usage-workspace/, "Usage page should render an Art usage workspace wrapper");
  assert.match(usageSection, /art-usage-summary-grid/, "Usage page should render compact Art usage summary cards");
  assert.match(usageSection, /art-usage-analytics-grid/, "Usage page should render an Art analytics grid");
  assert.match(usageSection, /art-usage-trend-workspace/, "Usage page should render a dedicated Art trend workspace");
  assert.match(usageSection, /art-usage-breakdown-workspace/, "Usage page should render an Art breakdown table workspace");
  assert.match(usageSection, /art-result-toolbar/, "Usage page should render an Art result toolbar above tables");
  assert.doesNotMatch(usageSection, /(?<![A-Za-z0-9_-])result-toolbar(?![A-Za-z0-9_-])/, "Usage page should not keep the generic result-toolbar class");
  assert.match(usageSection, /:size="tableSize"/, "Usage tables should respect shared density size");
  assert.match(styleSource, /\.art-usage-workspace/, "Styles should include Art usage workspace layout");
  assert.match(styleSource, /\.art-usage-summary-grid/, "Styles should include Art usage summary layout");
  assert.match(styleSource, /\.art-usage-analytics-grid/, "Styles should include Art usage analytics grid layout");
  assert.match(styleSource, /\.art-usage-breakdown-workspace/, "Styles should include Art usage breakdown workspace styling");
  for (const oldToken of [
    "usage-workspace",
    "usage-summary-grid",
    "usage-analytics-grid",
    "usage-trend-workspace",
    "usage-breakdown-workspace",
  ]) {
    assert.doesNotMatch(usageSection, classTokenPattern(oldToken), `Usage page should not keep old ${oldToken} token`);
    assert.doesNotMatch(styleSource, cssClassSelectorPattern(oldToken), `Styles should not keep old ${oldToken} selector`);
  }
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
  assert.match(usageSection, /art-usage-panel-header/, "Usage analytics cards should render a structured panel header");
  assert.match(usageSection, /art-usage-panel-title/, "Usage analytics cards should expose a title block");
  assert.match(usageSection, /art-usage-panel-meta/, "Usage analytics cards should expose right-side metadata");
  assert.match(usageSection, /art-usage-panel-body/, "Usage analytics cards should wrap content in a panel body");
  assert.match(usageSection, /art-usage-breakdown-panel/, "Usage breakdown should use the shared Art usage panel shell");
  assert.doesNotMatch(usageSection, /<template #header><div class="card-title"/, "Usage page should not use legacy one-line card titles");
  assert.match(styleSource, /\.art-usage-panel/, "Styles should include the Art usage panel shell");
  assert.match(styleSource, /\.art-usage-panel-header/, "Styles should include the structured usage panel header");
  assert.match(styleSource, /\.art-usage-panel-body/, "Styles should include the usage panel body");
  for (const oldToken of [
    "usage-cost-workspace",
    "usage-efficiency-workspace",
    "usage-panel-header",
    "usage-panel-title",
    "usage-panel-meta",
    "usage-panel-body",
    "usage-breakdown-panel",
  ]) {
    assert.doesNotMatch(usageSection, classTokenPattern(oldToken), `Usage page should not keep old ${oldToken} token`);
    assert.doesNotMatch(styleSource, cssClassSelectorPattern(oldToken), `Styles should not keep old ${oldToken} selector`);
  }
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
  assert.match(securitySection, /art-security-center/, "Security page should render an Art security center wrapper");
  assert.match(securitySection, /art-security-overview/, "Security page should render an Art security overview area");
  assert.match(securitySection, /art-security-score-card/, "Security page should render an Art score card");
  assert.match(securitySection, /art-security-summary-grid/, "Security page should render Art summary cards");
  assert.match(securitySection, /art-security-policy-grid/, "Security page should render policy controls in an Art grid");
  assert.match(securitySection, /art-session-workspace/, "Security page should render an Art session workspace");
  assert.match(securitySection, /art-audit-workspace/, "Security page should render an Art audit workspace");
  assert.match(securitySection, /:size="tableSize"/, "Security tables should respect shared density size");
  assert.match(styleSource, /\.art-security-center/, "Styles should include Art security center layout");
  assert.match(styleSource, /\.art-security-overview/, "Styles should include Art security overview layout");
  assert.match(styleSource, /\.art-security-summary-grid/, "Styles should include Art security summary grid layout");
  assert.match(styleSource, /\.art-security-policy-grid/, "Styles should include Art security policy grid layout");
  assert.match(styleSource, /\.art-session-workspace/, "Styles should include Art session workspace styling");
  for (const oldToken of [
    "security-workspace",
    "security-overview",
    "security-score-card",
    "security-summary-grid",
    "security-policy-grid",
    "session-workspace",
    "audit-workspace",
  ]) {
    assert.doesNotMatch(securitySection, classTokenPattern(oldToken), `Security page should not keep old ${oldToken} token`);
    assert.doesNotMatch(styleSource, cssClassSelectorPattern(oldToken), `Styles should not keep old ${oldToken} selector`);
  }
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
  assert.match(securitySection, /art-security-account-panel/, "Security page should style the account policy card");
  assert.match(securitySection, /art-security-totp-panel/, "Security page should style the TOTP card");
  assert.match(securitySection, /art-security-password-panel/, "Security page should style the password card");
  assert.match(securitySection, /art-session-list-panel/, "Security page should style the session card");
  assert.match(securitySection, /art-login-history-panel/, "Security page should style the login history card");
  assert.match(securitySection, /art-security-panel-header/g, "Security panels should use structured headers");
  assert.match(securitySection, /art-security-panel-title/g, "Security panels should expose title and helper copy");
  assert.match(securitySection, /art-security-panel-body/g, "Security panels should wrap body content consistently");
  assert.match(securitySection, /art-security-panel-action/, "Security panels should use compact action affordances");
  assert.match(securitySection, /art-security-form/g, "Security policy forms should use a dedicated Art form layout");
  assert.match(securitySection, /art-security-status-row/, "TOTP status should use a dedicated Art status row");
  assert.doesNotMatch(securitySection, /class="narrow-form"/, "Security panels should not keep the generic narrow-form class");
  assert.doesNotMatch(securitySection, /class="status-row"/, "Security panels should not keep the generic status-row class");
  assert.match(styleSource, /\.art-security-panel/, "Styles should include security panel shell");
  assert.match(styleSource, /\.art-security-panel-header/, "Styles should include security panel header");
  assert.match(styleSource, /\.art-security-panel-body/, "Styles should include security panel body layout");
  assert.match(styleSource, /\.art-security-panel-action/, "Styles should include security panel actions");
  assert.match(styleSource, /\.art-security-form/, "Styles should include security form layout");
  assert.match(styleSource, /\.art-security-status-row/, "Styles should include security status row layout");
  assert.doesNotMatch(styleSource, /\.narrow-form\b/, "Styles should remove the legacy narrow-form selector");
  assert.doesNotMatch(styleSource, /\.status-row\b/, "Styles should remove the legacy status-row selector");
  for (const oldToken of [
    "security-account-panel",
    "security-totp-panel",
    "security-password-panel",
    "session-list-panel",
    "login-history-panel",
    "security-panel-header",
    "security-panel-title",
    "security-panel-body",
    "security-panel-action",
  ]) {
    assert.doesNotMatch(securitySection, classTokenPattern(oldToken), `Security panels should not keep old ${oldToken} token`);
    assert.doesNotMatch(styleSource, cssClassSelectorPattern(oldToken), `Styles should not keep old ${oldToken} selector`);
  }
});

test("Vue audit log uses an Art Design Pro security panel", async () => {
  const source = await readAppSource();
  const securitySection = sourceBetween(
    source,
    "<section v-if=\"activeView === 'security'\"",
    "<section v-if=\"activeView === 'system'\"",
  );
  const styleSource = await readFile(new URL("../../admin/src/styles/art-design-admin.css", import.meta.url), "utf8");

  assert.match(securitySection, /art-audit-log-panel/, "Audit logs should use a dedicated Art security panel");
  assert.match(securitySection, /art-audit-panel-header/, "Audit log panel should use a structured header");
  assert.match(securitySection, /art-audit-panel-title/, "Audit log panel should expose title and helper copy");
  assert.match(securitySection, /art-audit-panel-body/, "Audit log panel should wrap table content");
  assert.match(securitySection, /art-audit-panel-action/, "Audit log panel should expose a compact refresh action");
  assert.match(styleSource, /\.art-audit-log-panel/, "Styles should include audit log panel shell");
  assert.match(styleSource, /\.art-audit-panel-header/, "Styles should include audit panel header");
  assert.match(styleSource, /\.art-audit-panel-body/, "Styles should include audit panel body layout");
  for (const oldToken of [
    "audit-log-panel",
    "audit-panel-header",
    "audit-panel-title",
    "audit-panel-body",
    "audit-panel-action",
  ]) {
    assert.doesNotMatch(securitySection, classTokenPattern(oldToken), `Audit panel should not keep old ${oldToken} token`);
    assert.doesNotMatch(styleSource, cssClassSelectorPattern(oldToken), `Styles should not keep old ${oldToken} selector`);
  }
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
  assert.match(systemSection, /art-system-console/, "System page should render an Art system console wrapper");
  assert.match(systemSection, /art-system-summary-grid/, "System page should render compact Art system summary cards");
  assert.match(systemSection, /art-backup-workspace/, "System page should render an Art backup workspace");
  assert.match(systemSection, /art-version-workspace/, "System page should render an Art config version workspace");
  assert.match(systemSection, /art-update-workspace/, "System page should render an Art update workspace");
  assert.match(systemSection, /art-health-workspace/, "System page should render a no-cost health workspace");
  assert.match(systemSection, /部署一致性/, "System page should call out deployment consistency");
  assert.match(systemSection, /GitHub main/, "System page should show the GitHub main commit");
  assert.match(systemSection, /runNoCostHealthCheck/, "System page should expose no-cost health checks");
  assert.match(systemSection, /:size="tableSize"/, "System tables should respect shared density size");
  assert.match(styleSource, /\.art-system-console/, "Styles should include Art system console layout");
  assert.match(styleSource, /\.art-system-summary-grid/, "Styles should include Art system summary grid layout");
  assert.match(styleSource, /\.art-backup-workspace/, "Styles should include Art backup workspace styling");
  assert.match(styleSource, /\.art-update-workspace/, "Styles should include Art update workspace styling");
  for (const oldToken of [
    "system-workspace",
    "system-summary-grid",
    "backup-workspace",
    "version-workspace",
    "update-workspace",
  ]) {
    assert.doesNotMatch(systemSection, classTokenPattern(oldToken), `System page should not keep old ${oldToken} token`);
    assert.doesNotMatch(styleSource, cssClassSelectorPattern(oldToken), `Styles should not keep old ${oldToken} selector`);
  }
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
  assert.match(systemSection, /art-system-backup-panel/, "System page should style the backup card");
  assert.match(systemSection, /art-system-version-panel/, "System page should style the version history card");
  assert.match(systemSection, /art-system-update-panel/, "System page should style the update card");
  assert.match(systemSection, /art-system-health-panel/, "System page should style the no-cost health card");
  assert.match(systemSection, /art-system-panel-header/g, "System panels should use structured headers");
  assert.match(systemSection, /art-system-panel-title/g, "System panels should expose title and helper copy");
  assert.match(systemSection, /art-system-panel-body/g, "System panels should wrap body content consistently");
  assert.match(systemSection, /art-system-panel-actions/g, "System panels should group compact actions");
  assert.match(systemSection, /art-system-panel-action/, "System panel buttons should use compact action styling");
  assert.match(systemSection, /art-system-status-list/, "System update status should use a dedicated Art status list");
  assert.match(systemSection, /art-system-backup-status/, "System backup status should use a dedicated Art status row");
  assert.match(systemSection, /art-system-file-input/, "System restore input should use a dedicated Art hidden file control");
  assert.match(systemSection, /art-system-update-actions/, "System update actions should use a dedicated Art action row");
  assert.match(systemSection, /art-deployment-status/, "System update should expose a prominent deployment status block");
  assert.match(systemSection, /art-changelog-preview/, "System changelog preview should use an Art preview token");
  assert.match(systemSection, /art-rollback-command/, "System rollback command should use an Art command token");
  assert.doesNotMatch(systemSection, /class="status-list"/, "System panels should not keep the legacy status-list class");
  assert.doesNotMatch(systemSection, /class="system-actions"/, "System panels should not keep the generic system-actions class");
  assert.doesNotMatch(systemSection, /class="hidden-file"/, "System panels should not keep the generic hidden-file class");
  assert.doesNotMatch(systemSection, /class="update-actions art-system-panel-actions"/, "System panels should not keep the generic update-actions class");
  assert.doesNotMatch(systemSection, /(?<![A-Za-z0-9_-])changelog-preview(?![A-Za-z0-9_-])/, "System panels should not keep the generic changelog-preview class");
  assert.doesNotMatch(systemSection, /(?<![A-Za-z0-9_-])rollback-command(?![A-Za-z0-9_-])/, "System panels should not keep the generic rollback-command class");
  assert.match(styleSource, /\.art-system-panel/, "Styles should include system panel shell");
  assert.match(styleSource, /\.art-system-panel-header/, "Styles should include system panel header");
  assert.match(styleSource, /\.art-system-panel-body/, "Styles should include system panel body layout");
  assert.match(styleSource, /\.art-system-panel-action/, "Styles should include system panel actions");
  assert.match(styleSource, /\.art-system-status-list/, "Styles should include system status list styling");
  assert.match(styleSource, /\.art-system-backup-status/, "Styles should include system backup status row");
  assert.match(styleSource, /\.art-system-file-input/, "Styles should include system hidden file input");
  assert.match(styleSource, /\.art-system-update-actions/, "Styles should include system update actions row");
  assert.match(styleSource, /\.art-deployment-status/, "Styles should include Art deployment status styling");
  assert.match(styleSource, /\.art-changelog-preview/, "Styles should include Art changelog preview styling");
  assert.match(styleSource, /\.art-rollback-command/, "Styles should include Art rollback command styling");
  assert.doesNotMatch(styleSource, /\.system-actions\b/, "Styles should remove the legacy system-actions selector");
  assert.doesNotMatch(styleSource, /\.hidden-file\b/, "Styles should remove the legacy hidden-file selector");
  assert.doesNotMatch(styleSource, /\.update-actions\b/, "Styles should remove the legacy update-actions selector");
  assert.doesNotMatch(styleSource, /\.changelog-preview(?![A-Za-z0-9_-])/, "Styles should remove the generic changelog-preview selector");
  assert.doesNotMatch(styleSource, /\.rollback-command(?![A-Za-z0-9_-])/, "Styles should remove the generic rollback-command selector");
  for (const oldToken of [
    "system-backup-panel",
    "system-version-panel",
    "system-update-panel",
    "system-health-panel",
    "system-panel-header",
    "system-panel-title",
    "system-panel-body",
    "system-panel-actions",
    "system-panel-action",
  ]) {
    assert.doesNotMatch(systemSection, classTokenPattern(oldToken), `System panels should not keep old ${oldToken} token`);
    assert.doesNotMatch(styleSource, cssClassSelectorPattern(oldToken), `Styles should not keep old ${oldToken} selector`);
  }
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
  assert.match(alertsSection, /art-alert-center/, "Alerts page should render an Art alert center wrapper");
  assert.match(alertsSection, /art-alert-summary-grid/, "Alerts page should render compact Art alert summary cards");
  assert.match(alertsSection, /art-alert-queue-workspace/, "Alerts page should render an Art alert queue workspace");
  assert.match(alertsSection, /art-alert-rules-workspace/, "Alerts page should render Art alert rules workspace");
  assert.match(alertsSection, /art-alert-notification-workspace/, "Alerts page should render Art notification workspace");
  assert.match(alertsSection, /art-alert-ack-workspace/, "Alerts page should render acknowledged alert history");
  assert.match(alertsSection, /:size="tableSize"/, "Alert table should respect shared density size");
  assert.match(alertsSection, /:data="pendingActiveAlerts"/, "Alert queue should only render pending alerts");
  assert.match(alertsSection, /acknowledgedActiveAlerts/, "Alerts page should keep acknowledged alerts visible outside the pending queue");
  assert.match(alertsSection, /acknowledgeAllAlerts/, "Alerts page should support acknowledging all pending alerts");
  assert.match(styleSource, /\.art-alert-center/, "Styles should include Art alert center layout");
  assert.match(styleSource, /\.art-alert-summary-grid/, "Styles should include Art alert summary grid layout");
  assert.match(styleSource, /\.art-alert-queue-workspace/, "Styles should include Art alert queue workspace styling");
  assert.match(styleSource, /\.art-alert-rules-workspace/, "Styles should include Art alert rules workspace styling");
  assert.match(styleSource, /\.art-alert-ack-list/, "Styles should include acknowledged alert history styling");
  for (const oldToken of [
    "alerts-workspace",
    "alerts-summary-grid",
    "alert-queue-workspace",
    "alert-rules-workspace",
    "notification-workspace",
  ]) {
    assert.doesNotMatch(alertsSection, classTokenPattern(oldToken), `Alerts page should not keep old ${oldToken} token`);
    assert.doesNotMatch(styleSource, cssClassSelectorPattern(oldToken), `Styles should not keep old ${oldToken} selector`);
  }
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
  assert.match(alertsSection, /art-alert-queue-panel/, "Alerts page should style the alert queue card");
  assert.match(alertsSection, /art-alert-notification-panel/, "Alerts page should style the notification status card");
  assert.match(alertsSection, /art-alert-rules-panel/, "Alerts page should style the rules card");
  assert.match(alertsSection, /art-alert-panel-header/g, "Alert panels should use structured headers");
  assert.match(alertsSection, /art-alert-panel-title/g, "Alert panels should expose title and helper copy");
  assert.match(alertsSection, /art-alert-panel-body/g, "Alert panels should wrap body content consistently");
  assert.match(alertsSection, /art-alert-panel-actions/g, "Alert panels should group compact actions");
  assert.match(alertsSection, /art-alert-panel-action/, "Alert panel buttons should use compact action styling");
  assert.match(alertsSection, /art-alert-status-list/, "Alert notification status should use a dedicated Art status list");
  assert.match(alertsSection, /art-alert-form/, "Alert rules should use a dedicated Art form layout");
  assert.doesNotMatch(alertsSection, /class="status-list"/, "Alert panels should not keep the legacy status-list class");
  assert.doesNotMatch(alertsSection, /class="narrow-form"/, "Alert panels should not keep the generic narrow-form class");
  assert.match(styleSource, /\.art-alert-panel/, "Styles should include alert panel shell");
  assert.match(styleSource, /\.art-alert-panel-header/, "Styles should include alert panel header");
  assert.match(styleSource, /\.art-alert-panel-body/, "Styles should include alert panel body layout");
  assert.match(styleSource, /\.art-alert-panel-action/, "Styles should include alert panel actions");
  assert.match(styleSource, /\.art-alert-status-list/, "Styles should include alert status list styling");
  assert.match(styleSource, /\.art-alert-form/, "Styles should include alert form layout");
  for (const oldToken of [
    "alert-queue-panel",
    "alert-notification-panel",
    "alert-rules-panel",
    "alert-panel-header",
    "alert-panel-title",
    "alert-panel-body",
    "alert-panel-actions",
    "alert-panel-action",
  ]) {
    assert.doesNotMatch(alertsSection, classTokenPattern(oldToken), `Alerts page should not keep old ${oldToken} token`);
    assert.doesNotMatch(styleSource, cssClassSelectorPattern(oldToken), `Styles should not keep old ${oldToken} selector`);
  }
});
