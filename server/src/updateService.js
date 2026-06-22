function parseReleaseVersion(version) {
  const match = String(version || "").trim().match(/^v?(\d+)\.(\d+)\.(\d+)$/);
  if (!match) return null;
  return match.slice(1).map((part) => Number(part));
}

function truncateCommit(value) {
  return String(value || "").trim().slice(0, 8);
}

function looksLikeCommit(value) {
  return /^[0-9a-f]{7,40}$/i.test(String(value || "").trim());
}

function rollbackCommand() {
  return "docker compose -p current -f docker-compose.self-hosted.yml up -d --no-deps image-studio-api";
}

function deploymentMessage(deployment) {
  if (deployment.status === "current") {
    if (deployment.imageTagStatus === "floating") {
      return `服务器 commit 已与 GitHub main 一致；镜像 tag 是 ${deployment.dockerImageTag}，按 commit 判定。`;
    }
    if (deployment.imageTagStatus === "release") {
      return `服务器 commit 已与 GitHub main 一致；镜像 tag 是发布标签 ${deployment.dockerImageTag}。`;
    }
    return "服务器 commit 已与 GitHub main 一致。";
  }
  if (deployment.status === "behind") return "服务器 commit 与 GitHub main 不一致，部署可能落后。";
  if (deployment.status === "unconfigured") return "未配置 GitHub 仓库，暂不能对比 main。";
  if (deployment.status === "error") return "无法读取 GitHub main，暂不能确认服务器版本。";
  return "缺少可对比的服务器 commit 或镜像 tag。";
}

function deploymentInfo(metadata = {}, main = {}) {
  const currentCommit = metadata.currentCommit || "";
  const dockerImageTag = metadata.dockerImageTag || "";
  const mainCommit = main.mainCommit || "";
  const currentCommitIsHash = looksLikeCommit(currentCommit);
  const mainCommitIsHash = looksLikeCommit(mainCommit);
  const tagIsHash = looksLikeCommit(dockerImageTag);
  const commitStatus = !currentCommit
    ? "missing"
    : (!currentCommitIsHash || !mainCommitIsHash ? "unknown" : (currentCommit === mainCommit ? "current" : "behind"));
  let imageTagStatus = "missing";
  if (dockerImageTag) {
    if (/^(latest|dev)$/i.test(dockerImageTag)) imageTagStatus = "floating";
    else if (/^v?\d+\.\d+\.\d+/.test(dockerImageTag)) imageTagStatus = "release";
    else if (!tagIsHash || !mainCommitIsHash) imageTagStatus = "unknown";
    else imageTagStatus = truncateCommit(dockerImageTag) === mainCommit ? "current" : "behind";
  }

  let status = "unknown";
  if (main.status === "unconfigured") status = "unconfigured";
  else if (main.status === "error") status = "error";
  else if (commitStatus === "current") status = "current";
  else if (commitStatus === "behind") status = "behind";
  else if (commitStatus === "missing" && imageTagStatus === "current") status = "current";
  else if (commitStatus === "missing" && imageTagStatus === "behind") status = "behind";

  const deployment = {
    status,
    currentCommit,
    dockerImageTag,
    mainCommit,
    mainCommitURL: main.mainCommitURL || "",
    commitStatus,
    imageTagStatus,
  };
  return {
    ...deployment,
    message: deploymentMessage(deployment),
  };
}

function emptyResult(currentVersion, status, metadata = {}, main = {}) {
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
    deployment: deploymentInfo(metadata, main),
  };
}

function normalizeRepository(repository) {
  const normalized = String(repository || "").trim();
  if (!normalized) return "";
  return /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(normalized) ? normalized : "";
}

async function fetchMainCommit(repository, fetchImpl) {
  if (!repository) return { status: "unconfigured" };
  if (!fetchImpl) return { status: "error" };
  try {
    const response = await fetchImpl(
      `https://api.github.com/repos/${repository}/commits/main`,
      { headers: { accept: "application/vnd.github+json" } },
    );
    if (!response?.ok) return { status: "error", upstreamStatus: response?.status || 0 };
    const commit = await response.json().catch(() => ({}));
    return {
      status: "ok",
      mainCommit: truncateCommit(commit?.sha),
      mainCommitURL: String(commit?.html_url || "").trim(),
      mainCommitMessage: String(commit?.commit?.message || "").trim(),
    };
  } catch {
    return { status: "error" };
  }
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
        return emptyResult(normalizedCurrentVersion, "unconfigured", metadata, { status: "unconfigured" });
      }
      if (!fetchImpl) {
        return emptyResult(normalizedCurrentVersion, "error", metadata, { status: "error" });
      }

      try {
        const releaseResponse = await fetchImpl(
          `https://api.github.com/repos/${normalizedRepository}/releases/latest`,
          { headers: { accept: "application/vnd.github+json" } },
        );
        const main = await fetchMainCommit(normalizedRepository, fetchImpl);
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
            deployment: deploymentInfo(metadata, main),
          };
        }

        if (releaseResponse?.status !== 404) {
          return emptyResult(normalizedCurrentVersion, "error", metadata, main);
        }

        if (main.status !== "ok" || !main.mainCommit) {
          return emptyResult(normalizedCurrentVersion, "error", metadata, main);
        }

        const latestVersion = main.mainCommit;
        const releaseURL = main.mainCommitURL || "";
        const currentParts = metadata.currentCommit || truncateCommit(normalizedCurrentVersion);
        const status = currentParts && latestVersion && looksLikeCommit(currentParts)
          ? (currentParts === latestVersion ? "same" : "newer")
          : "unknown";
        return {
          currentVersion: normalizedCurrentVersion,
          ...metadata,
          latestVersion,
          status,
          releaseURL,
          changelogURL: releaseURL,
          changelog: main.mainCommitMessage || "",
          rollbackCommand: rollbackCommand(),
          source: "commit",
          deployment: deploymentInfo(metadata, main),
        };
      } catch {
        return emptyResult(normalizedCurrentVersion, "error", metadata, { status: "error" });
      }
    },
  };
}
