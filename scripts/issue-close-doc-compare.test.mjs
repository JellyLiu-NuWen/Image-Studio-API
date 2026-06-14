import assert from "node:assert/strict";
import test from "node:test";
import { compareIssueCloseDocs } from "./issue-close-doc-compare.mjs";

test("issue close doc comparison ignores checkout line ending differences", () => {
  const result = compareIssueCloseDocs("line 1\nline 2\n", "line 1\r\nline 2\r\n");

  assert.equal(result.matches, true);
  assert.equal(result.firstDiff, -1);
});

test("issue close doc comparison still detects real content drift", () => {
  const result = compareIssueCloseDocs("line 1\nline 2\n", "line 1\nchanged\n");

  assert.equal(result.matches, false);
  assert.equal(result.firstDiff, 7);
  assert.equal(result.renderedLength, 14);
  assert.equal(result.trackedLength, 15);
  assert.match(result.renderedPreview, /line 2/);
  assert.match(result.trackedPreview, /changed/);
});
