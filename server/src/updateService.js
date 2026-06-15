function parseReleaseVersion(version) {
  const match = String(version || "").trim().match(/^v?(\d+)\.(\d+)\.(\d+)$/);
  if (!match) return null;
  return match.slice(1).map((part) => Number(part));
}

function emptyResult(currentVersion, status) {
  return {
    currentVersion,
    latestVersion: "",
    status,
    releaseURL: "",
  };
}

function normalizeRepository(repository) {
  const normalized = String(repository || "").trim();
  if (!normalized) return "";
  return /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(normalized) ? normalized : "";
}

export function compareReleaseVersions(current, latest) {
  const currentParts = parseReleaseVersion(current);
  const latestParts = parseReleaseVersion(latest);
  if (!currentParts || !latestParts) return "unknown";

  for (let index = 0; index < 3; index += 1) {
    if (latestParts[index] > currentParts[index]) return "newer";
    if (latestParts[index] < currentParts[index]) return "older";
  }
  return "same";
}

export function createUpdateService({
  currentVersion = process.env.IMAGE_STUDIO_VERSION || "dev",
  repository = process.env.IMAGE_STUDIO_GITHUB_REPOSITORY || "",
  fetchImpl = globalThis.fetch,
} = {}) {
  const normalizedCurrentVersion = String(currentVersion || "dev").trim() || "dev";
  const normalizedRepository = normalizeRepository(repository);

  return {
    async checkLatest() {
      if (!normalizedRepository) {
        return emptyResult(normalizedCurrentVersion, "unconfigured");
      }
      if (!fetchImpl) {
        return emptyResult(normalizedCurrentVersion, "error");
      }

      try {
        const response = await fetchImpl(
          `https://api.github.com/repos/${normalizedRepository}/releases/latest`,
          { headers: { accept: "application/vnd.github+json" } },
        );
        if (!response?.ok) {
          return emptyResult(normalizedCurrentVersion, "error");
        }

        const release = await response.json().catch(() => ({}));
        const latestVersion = String(release?.tag_name || "").trim();
        const releaseURL = String(release?.html_url || "").trim();
        return {
          currentVersion: normalizedCurrentVersion,
          latestVersion,
          status: compareReleaseVersions(normalizedCurrentVersion, latestVersion),
          releaseURL,
        };
      } catch {
        return emptyResult(normalizedCurrentVersion, "error");
      }
    },
  };
}
