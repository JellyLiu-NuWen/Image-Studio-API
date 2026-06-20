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
