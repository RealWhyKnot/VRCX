import { describe, expect, test } from "vitest";

import { isNewerRelease, listReleases, parseReleaseVersion, pickLatestRelease, type GitHubRelease } from "../../../src/shared/utils/release-version";

function release(tag: string, overrides: Partial<GitHubRelease> = {}): GitHubRelease {
  return {
    name: `VRCX ${tag}`,
    tag_name: tag,
    body: "notes",
    published_at: "2026-11-12T00:00:00Z",
    prerelease: tag.endsWith("-beta"),
    assets: [
      {
        name: `VRCX_${tag}_Setup_x64.exe`,
        state: "uploaded",
        content_type: "application/x-msdownload",
        browser_download_url: `https://example.invalid/${tag}.exe`,
        digest: "sha256:abc",
        size: 10,
      },
    ],
    ...overrides,
  };
}

describe("parseReleaseVersion", () => {
  test("reads tags, release titles and what the app reports about itself", () => {
    expect(parseReleaseVersion("v2026.11.12.3")).toEqual({ parts: [2026, 11, 12, 3], isBeta: false });
    expect(parseReleaseVersion("VRCX 2026.11.12.0")).toEqual({ parts: [2026, 11, 12, 0], isBeta: false });
    expect(parseReleaseVersion("VRCX Nightly 2026.11.12.4-beta-abc1234")).toEqual({ parts: [2026, 11, 12, 4], isBeta: true });
    expect(parseReleaseVersion("VRCX 2026.09.16")).toEqual({ parts: [2026, 9, 16, 0], isBeta: false });
  });

  test("gives up on builds with no version", () => {
    expect(parseReleaseVersion("VRCX Build")).toBeNull();
    expect(parseReleaseVersion("VRCX Nightly Build")).toBeNull();
    expect(parseReleaseVersion("")).toBeNull();
    expect(parseReleaseVersion("9".repeat(5000))).toBeNull();
  });
});

describe("isNewerRelease", () => {
  test("compares by number, where text order would get it wrong", () => {
    expect(isNewerRelease("v2026.11.12.10", "VRCX 2026.11.12.9")).toBe(true);
    expect(isNewerRelease("v2026.11.2.0", "VRCX 2026.11.12.0")).toBe(false);
    expect(isNewerRelease("v2026.2.1.0", "VRCX 2026.11.12.0")).toBe(false);
    expect(isNewerRelease("v2027.1.1.0", "VRCX 2026.11.12.0")).toBe(true);
  });

  test("does not offer the version already installed", () => {
    expect(isNewerRelease("v2026.11.12.0", "VRCX 2026.11.12.0")).toBe(false);
    expect(isNewerRelease("v2026.11.12.0-beta", "VRCX Nightly 2026.11.12.0-beta-abc1234")).toBe(false);
  });

  test("puts a release above the beta with the same number", () => {
    expect(isNewerRelease("v2026.11.12.0", "VRCX Nightly 2026.11.12.0-beta-abc1234")).toBe(true);
    expect(isNewerRelease("v2026.11.12.0-beta", "VRCX 2026.11.12.0")).toBe(false);
  });

  test("never updates when either side has no version", () => {
    expect(isNewerRelease("v2026.11.12.0", "VRCX Build")).toBe(false);
    expect(isNewerRelease("latest", "VRCX 2026.11.12.0")).toBe(false);
  });
});

describe("listReleases and pickLatestRelease", () => {
  const all = [
    release("v2026.11.10.0"),
    release("v2026.11.12.1-beta"),
    release("v2026.11.12.0"),
    release("v2026.11.11.0", { assets: [] }),
    { name: 5 },
    release("nightly"),
  ];

  test("keeps betas out of the stable list and sorts newest first", () => {
    expect(listReleases(all, false).map((entry) => entry.tag_name)).toEqual(["v2026.11.12.0", "v2026.11.10.0"]);
    expect(listReleases(all, true).map((entry) => entry.tag_name)).toEqual(["v2026.11.12.1-beta", "v2026.11.12.0", "v2026.11.10.0"]);
  });

  test("returns nothing for a reply that is not a list", () => {
    expect(listReleases({ message: "Not Found" }, true)).toEqual([]);
    expect(listReleases(null, true)).toEqual([]);
  });

  test("picks the newest from a list or takes a single release as it is", () => {
    expect(pickLatestRelease(all, true)?.tag_name).toBe("v2026.11.12.1-beta");
    expect(pickLatestRelease(all, false)?.tag_name).toBe("v2026.11.12.0");
    expect(pickLatestRelease(release("v2026.11.9.0"), false)?.tag_name).toBe("v2026.11.9.0");
    expect(pickLatestRelease({ message: "Not Found" }, false)).toBeNull();
    expect(pickLatestRelease([], true)).toBeNull();
  });
});
