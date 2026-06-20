import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { createAdminAssetHandler } from "../src/adminAssets.js";

test("admin asset handler serves built Vue admin index and assets", async () => {
  const root = await mkdtemp(join(tmpdir(), "image-studio-admin-assets-"));
  const dist = join(root, "dist");
  await mkdir(join(dist, "assets"), { recursive: true });
  await writeFile(join(dist, "index.html"), "<div id=\"app\">Art Design Pro Admin</div>", "utf8");
  await writeFile(join(dist, "assets", "app.js"), "console.log('admin')", "utf8");

  try {
    const handler = createAdminAssetHandler({ distDir: dist });
    const index = await handler(new Request("http://localhost/admin"));
    assert.equal(index.status, 200);
    assert.equal(index.headers.get("content-type"), "text/html; charset=utf-8");
    assert.equal(await index.text(), "<div id=\"app\">Art Design Pro Admin</div>");

    const asset = await handler(new Request("http://localhost/admin/assets/app.js"));
    assert.equal(asset.status, 200);
    assert.equal(asset.headers.get("content-type"), "text/javascript; charset=utf-8");
    assert.equal(await asset.text(), "console.log('admin')");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("admin asset handler returns null when the build output is missing", async () => {
  const handler = createAdminAssetHandler({ distDir: join(tmpdir(), "missing-image-studio-admin") });
  assert.equal(await handler(new Request("http://localhost/admin")), null);
  assert.equal(await handler(new Request("http://localhost/admin/assets/app.js")), null);
});
