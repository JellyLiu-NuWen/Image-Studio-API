function parseReleaseVersion(version) {
  const match = String(version || "").trim().match(/^v?(\d+)\.(\d+)\.(\d+)$/);
  if (!match) return null;
  return match.slice(1).map((part) => Number(part));
}

function truncateCommit(value) {
  return String(value || "").trim().slice(0, 8);
}

function rollbackCommand() {
  return "docker compose -p current -f docker-compose.self-hosted.yml up -d --no-deps image-studio-api";
}

function emptyResult(currentVersion, status, metadata = {}) {
  return {
    currentVersion,
    currentCommit: metadata.currentCommit || "",
    dockerImageTag: metadata.dockerImageTag || "",
    latestVersion: "",
    status,
    releaseURL: "",
    changelogURL: "",
    changelog: "",
    rollbackCommand: rollbackCommand(),
    source: "release",
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
  currentCommit = process.env.IMAGE_STUDIO_COMMIT || process.env.GITHUB_SHA || "",
  dockerImageTag = process.env.IMAGE_STUDIO_API_TAG || process.env.IMAGE_STUDIO_VERSION || "",
  repository = process.env.IMAGE_STUDIO_GITHUB_REPOSITORY || "",
  fetchImpl = globalThis.fetch,
} = {}) {
  const normalizedCurrentVersion = String(currentVersion || "dev").trim() || "dev";
  const normalizedCurrentCommit = truncateCommit(currentCommit);
  const normalizedDockerImageTag = String(dockerImageTag || "").trim();
  const normalizedRepository = normalizeRepository(repository);
  const metadata = {
    currentCommit: normalizedCurrentCommit,
    dockerImageTag: normalizedDockerImageTag,
  };

  return {
    async checkLatest() {
      if (!normalizedRepository) {
        return emptyResult(normalizedCurrentVersion, "unconfigured", metadata);
      }
      if (!fetchImpl) {
        return emptyResult(normalizedCurrentVersion, "error", metadata);
      }

      try {
        const releaseResponse = await fetchImpl(
          `https://api.github.com/repos/${normalizedRepository}/releases/latest`,
          { headers: { accept: "application/vnd.github+json" } },
        );
        if (releaseResponse?.ok) {
          const release = await releaseResponse.json().catch(() => ({}));
          const latestVersion = String(release?.tag_name || "").trim();
          const releaseURL = String(release?.html_url || "").trim();
          return {
            currentVersion: normalizedCurrentVersion,
            ...metadata,
            latestVersion,
            status: compareReleaseVersions(normalizedCurrentVersion, latestVersion),
            releaseURL,
            changelogURL: releaseURL,
            changelog: String(release?.body || "").trim(),
            rollbackCommand: rollbackCommand(),
            source: "release",
          };
        }

        if (releaseResponse?.status !== 404) {
          return emptyResult(normalizedCurrentVersion, "error", metadata);
        }

        const commitResponse = await fetchImpl(
          `https://api.github.com/repos/${normalizedRepository}/commits/main`,
          { headers: { accept: "application/vnd.github+json" } },
        );
        if (!commitResponse?.ok) {
          return emptyResult(normalizedCurrentVersion, "error", metadata);
        }

        const commit = await commitResponse.json().catch(() => ({}));
        const latestVersion = String(commit?.sha || "").trim().slice(0, 8);
        const releaseURL = String(commit?.html_url || "").trim();
        const currentParts = String(normalizedCurrentVersion || "").trim();
        const status = currentParts && latestVersion
          ? (currentParts === latestVersion ? "same" : "newer")
          : "unknown";
        return {
          currentVersion: normalizedCurrentVersion,
          ...metadata,
          latestVersion,
          status,
          releaseURL,
          changelogURL: releaseURL,
          changelog: String(commit?.commit?.message || "").trim(),
          rollbackCommand: rollbackCommand(),
          source: "commit",
        };
      } catch {
        return emptyResult(normalizedCurrentVersion, "error", metadata);
      }
    },
  };
}
