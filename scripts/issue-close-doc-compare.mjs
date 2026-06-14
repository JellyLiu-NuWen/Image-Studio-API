export function normalizeIssueCloseDocForCompare(value) {
  return String(value ?? "").replace(/\r\n?/g, "\n");
}

function findFirstDiff(left, right) {
  const end = Math.min(left.length, right.length);
  for (let index = 0; index < end; index += 1) {
    if (left[index] !== right[index]) return index;
  }
  return left.length === right.length ? -1 : end;
}

function previewAround(value, index) {
  if (index < 0) return "";
  const start = Math.max(0, index - 48);
  const end = Math.min(value.length, index + 96);
  return value.slice(start, end).replace(/\n/g, "\\n");
}

export function compareIssueCloseDocs(rendered, tracked) {
  const normalizedRendered = normalizeIssueCloseDocForCompare(rendered);
  const normalizedTracked = normalizeIssueCloseDocForCompare(tracked);
  const firstDiff = findFirstDiff(normalizedRendered, normalizedTracked);
  return {
    matches: normalizedRendered === normalizedTracked,
    renderedLength: normalizedRendered.length,
    trackedLength: normalizedTracked.length,
    firstDiff,
    renderedPreview: previewAround(normalizedRendered, firstDiff),
    trackedPreview: previewAround(normalizedTracked, firstDiff),
  };
}
