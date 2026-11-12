import { beforeEach, describe, expect, test, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";

type Reply = { status: number; data: string };

const mocks = vi.hoisted(() => ({
  getString: vi.fn<(key: string, defaultValue?: string) => Promise<string>>(),
  setString: vi.fn<(key: string, value: string) => Promise<void>>(),
  execute: vi.fn<(request: { url: string; headers: Record<string, string> }) => Promise<Reply>>(),
  downloadUpdate: vi.fn<(url: string, hash: string, size: number) => Promise<void>>(),
  toast: Object.assign(vi.fn<(title: string, options?: unknown) => void>(), { error: vi.fn<(message: string) => void>() }),
}));

vi.mock("../../src/services/config", () => ({ configRepository: { getString: mocks.getString, setString: mocks.setString } }));
vi.mock("../../src/services/app-config", () => ({ logWebRequest: vi.fn<() => void>() }));
vi.mock("vue-sonner", () => ({ toast: mocks.toast }));
vi.mock("vue-i18n", () => ({ useI18n: () => ({ t: (key: string) => key }) }));
vi.mock("worker-timers", () => ({ setTimeout: vi.fn<() => number>() }));

import { useVRCXUpdaterStore } from "../../src/stores/vrcx-updater";

const RELEASES = "https://api.github.com/repos/RealWhyKnot/VRCX/releases";

function release(tag: string) {
  return {
    name: `VRCX ${tag}`,
    tag_name: tag,
    body: "notes",
    published_at: "2026-11-12T00:00:00Z",
    prerelease: tag.endsWith("-beta"),
    assets: [
      {
        name: `VRCX_${tag.slice(1)}_Setup_x64.exe`,
        state: "uploaded",
        content_type: "application/x-msdownload",
        browser_download_url: `https://example.invalid/${tag}.exe`,
        digest: "sha256:abc123",
        size: 42,
      },
    ],
  };
}

function reply(body: unknown, status = 200): Reply {
  return { status, data: JSON.stringify(body) };
}

async function openStore(version: string, autoUpdate: string) {
  mocks.getString.mockImplementation((key, defaultValue) => Promise.resolve(key === "VRCX_autoUpdateVRCX" ? autoUpdate : (defaultValue ?? "")));
  mocks.setString.mockResolvedValue();
  mocks.downloadUpdate.mockResolvedValue();
  vi.stubGlobal("AppApi", {
    GetVersion: () => Promise.resolve(version),
    DownloadUpdate: mocks.downloadUpdate,
    CheckUpdateProgress: () => Promise.resolve(0),
    CheckForUpdateExe: () => Promise.resolve(false),
  });
  vi.stubGlobal("webApiService", { execute: mocks.execute });
  vi.stubGlobal("isHostWindows", true);
  vi.stubGlobal("isHostLinux", false);
  setActivePinia(createPinia());
  const store = useVRCXUpdaterStore();
  await vi.waitFor(() => {
    expect(store.appVersion).toBe(version);
  });
  await vi.waitFor(() => {
    expect(store.checkingForVRCXUpdate).toBe(false);
  });
  return store;
}

describe("checking for updates", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("asks our releases and downloads a newer one with its checksum", async () => {
    mocks.execute.mockResolvedValue(reply(release("v2026.11.12.10")));
    const store = await openStore("VRCX 2026.11.12.9", "Auto Download");
    await vi.waitFor(() => {
      expect(mocks.downloadUpdate).toHaveBeenCalledWith("https://example.invalid/v2026.11.12.10.exe", "abc123", 42);
    });
    expect(mocks.execute.mock.calls[0]?.[0].url).toBe(`${RELEASES}/latest`);
    expect(mocks.execute.mock.calls[0]?.[0].headers).toEqual({ Accept: "application/vnd.github+json" });
    expect(store.pendingVRCXUpdate).toBe(true);
    expect(store.latestAppVersion).toBe("VRCX v2026.11.12.10");
  });

  test("leaves the installed version alone when the release is the same or older", async () => {
    mocks.execute.mockResolvedValue(reply(release("v2026.11.12.0")));
    const store = await openStore("VRCX 2026.11.12.0", "Auto Download");
    expect(await store.checkForVRCXUpdate()).toBe(true);
    mocks.execute.mockResolvedValue(reply(release("v2026.11.2.0")));
    expect(await store.checkForVRCXUpdate()).toBe(true);
    expect(mocks.downloadUpdate).not.toHaveBeenCalled();
    expect(store.pendingVRCXUpdate).toBe(false);
  });

  test("stays quiet while the repository has no release yet", async () => {
    mocks.execute.mockResolvedValue(reply({ message: "Not Found" }, 404));
    const store = await openStore("VRCX 2026.11.12.0", "Auto Download");
    expect(await store.checkForVRCXUpdate()).toBe(false);
    expect(mocks.toast.error).not.toHaveBeenCalled();
  });

  test("does not check at all for a build with no version", async () => {
    const store = await openStore("VRCX Build", "Auto Download");
    expect(await store.checkForVRCXUpdate()).toBe(false);
    expect(mocks.execute).not.toHaveBeenCalled();
  });

  test("a beta build follows the newest release of either kind", async () => {
    mocks.execute.mockResolvedValue(reply([release("v2026.11.12.0"), release("v2026.11.13.0-beta"), release("v2026.11.11.0")]));
    const store = await openStore("VRCX Nightly 2026.11.12.0-beta-abc1234", "Notify");
    await vi.waitFor(() => {
      expect(store.pendingVRCXUpdate).toBe(true);
    });
    expect(store.branch).toBe("Nightly");
    expect(mocks.execute.mock.calls[0]?.[0].url).toBe(`${RELEASES}?per_page=30`);
    expect(store.latestAppVersion).toBe("VRCX v2026.11.13.0-beta");
    expect(mocks.downloadUpdate).not.toHaveBeenCalled();
  });

  test("the version list hides betas on the stable branch", async () => {
    mocks.execute.mockResolvedValue(reply(release("v2026.11.12.0")));
    const store = await openStore("VRCX 2026.11.12.0", "Off");
    mocks.execute.mockResolvedValue(reply([release("v2026.11.13.0-beta"), release("v2026.11.12.0"), release("v2026.11.14.0")]));
    await store.loadBranchVersions();
    expect(store.VRCXUpdateDialog.releases.map((entry) => entry.tag_name)).toEqual(["v2026.11.14.0", "v2026.11.12.0"]);
    expect(store.VRCXUpdateDialog.release).toBe("VRCX v2026.11.14.0");
  });
});
