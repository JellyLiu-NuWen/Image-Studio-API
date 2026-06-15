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

test("renderAdminPage exposes the Chinese sidebar admin system landmarks", () => {
  const html = renderAdminPage();

  assert.match(html, /登录后进入管理后台/);
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

test("renderAdminPage validates release link protocol before rendering href", () => {
  const html = renderAdminPage();

  assert.match(html, /new URL\(releaseURL\)/);
  assert.match(html, /protocol === "https:"/);
  assert.match(html, /safeReleaseURL/);
});
