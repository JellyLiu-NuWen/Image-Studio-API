import test from "node:test";
import assert from "node:assert/strict";

import { renderAdminPage } from "../src/adminPage.js";

test("renderAdminPage includes admin dashboard sections", () => {
  const html = renderAdminPage();

  assert.match(html, /id="metricsPanel"/);
  assert.match(html, /id="generationLogs"/);
  assert.match(html, /id="apiLogs"/);
  assert.match(html, /id="updateStatus"/);
});

test("renderAdminPage validates release link protocol before rendering href", () => {
  const html = renderAdminPage();

  assert.match(html, /new URL\(releaseURL\)/);
  assert.match(html, /protocol === "https:"/);
  assert.match(html, /safeReleaseURL/);
});
