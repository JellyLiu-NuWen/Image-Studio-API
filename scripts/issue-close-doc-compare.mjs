export function normalizeIssueCloseDocForCompare(value) {
  return String(value ?? "").replace(/\r\n?/g, "\n");
}

export function compareIssueCloseDocs(rendered, tracked) {
  const normalizedRendered = normalizeIssueCloseDocForCompare(rendered);
  const normalizedTracked = normalizeIssueCloseDocForCompare(tracked);
  return {
    matches: normalizedRendered === normalizedTracked,
    renderedLength: normalizedRendered.length,
    trackedLength: normalizedTracked.length,
  };
}
