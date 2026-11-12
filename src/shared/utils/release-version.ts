type ReleaseVersion = {
  parts: readonly [number, number, number, number];
  isBeta: boolean;
};

type GitHubAsset = {
  name: string;
  state: string;
  content_type: string;
  browser_download_url: string;
  digest?: string | null;
  size: number;
};

type GitHubRelease = {
  name: string;
  tag_name?: string | undefined;
  body: string;
  published_at: string;
  prerelease: boolean;
  assets: GitHubAsset[];
};

const RELEASE_VERSION_PATTERN = /(\d{4})\.(\d{1,2})\.(\d{1,2})(?:\.(\d{1,6}))?(-beta)?/;

function parseReleaseVersion(text: string): ReleaseVersion | null {
  const match = RELEASE_VERSION_PATTERN.exec(text);
  if (match === null) {
    return null;
  }
  return {
    parts: [Number(match[1]), Number(match[2]), Number(match[3]), Number(match[4] ?? 0)],
    isBeta: match[5] !== undefined,
  };
}

function compareReleaseVersions(left: ReleaseVersion, right: ReleaseVersion): number {
  for (let index = 0; index < left.parts.length; index += 1) {
    const difference = (left.parts[index] ?? 0) - (right.parts[index] ?? 0);
    if (difference !== 0) {
      return difference;
    }
  }
  return Number(right.isBeta) - Number(left.isBeta);
}

function isNewerRelease(candidate: string, current: string): boolean {
  const candidateVersion = parseReleaseVersion(candidate);
  const currentVersion = parseReleaseVersion(current);
  if (candidateVersion === null || currentVersion === null) {
    return false;
  }
  return compareReleaseVersions(candidateVersion, currentVersion) > 0;
}

function releaseVersionText(release: GitHubRelease): string {
  return release.tag_name ?? release.name;
}

function isGitHubRelease(value: unknown): value is GitHubRelease {
  return typeof value === "object" && value !== null && "name" in value && typeof value.name === "string" && "assets" in value && Array.isArray(value.assets);
}

function isLatestRelease(value: unknown): value is GitHubRelease {
  return (
    isGitHubRelease(value) &&
    value.name !== "" &&
    "published_at" in value &&
    typeof value.published_at === "string" &&
    value.published_at !== "" &&
    "body" in value &&
    typeof value.body === "string"
  );
}

function hasUploadedAsset(release: GitHubRelease): boolean {
  return release.assets.some((asset) => asset.state === "uploaded");
}

function listReleases(json: unknown, canIncludeBeta: boolean): GitHubRelease[] {
  if (!Array.isArray(json)) {
    return [];
  }
  const releases: GitHubRelease[] = [];
  for (const entry of json) {
    if (!isGitHubRelease(entry) || !hasUploadedAsset(entry)) {
      continue;
    }
    if (entry.prerelease && !canIncludeBeta) {
      continue;
    }
    if (parseReleaseVersion(releaseVersionText(entry)) === null) {
      continue;
    }
    releases.push(entry);
  }
  return releases.sort((left, right) => {
    const leftVersion = parseReleaseVersion(releaseVersionText(left));
    const rightVersion = parseReleaseVersion(releaseVersionText(right));
    if (leftVersion === null || rightVersion === null) {
      return 0;
    }
    return compareReleaseVersions(rightVersion, leftVersion);
  });
}

function pickLatestRelease(json: unknown, canIncludeBeta: boolean): GitHubRelease | null {
  if (Array.isArray(json)) {
    return listReleases(json, canIncludeBeta).find((release) => isLatestRelease(release)) ?? null;
  }
  return isLatestRelease(json) ? json : null;
}

export { compareReleaseVersions, isNewerRelease, listReleases, parseReleaseVersion, pickLatestRelease, releaseVersionText };
export type { GitHubAsset, GitHubRelease, ReleaseVersion };
