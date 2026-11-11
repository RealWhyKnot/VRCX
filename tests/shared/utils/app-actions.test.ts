import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
  searchStore: {
    directAccessParse: vi.fn(),
  },
  externalLinkStore: {
    showExternalLinkDialog: vi.fn(),
  },
  i18n: {
    global: {
      t: vi.fn(() => "copy failed"),
    },
  },
  clipboard: {
    writeText: vi.fn(),
  },
  appApi: {
    OpenLink: vi.fn(),
    OpenDiscordProfile: vi.fn(),
    OpenFolderAndSelectItem: vi.fn(),
  },
}));

vi.mock("vue-sonner", () => ({
  toast: mocks.toast,
}));

vi.mock("../../../src/stores/search", () => ({
  useSearchStore: () => mocks.searchStore,
}));
vi.mock("../../../src/stores/external-link", () => ({
  useExternalLinkStore: () => mocks.externalLinkStore,
}));

vi.mock("../../../src/plugins/i18n", () => ({
  i18n: mocks.i18n,
}));

import { copyToClipboard, downloadAndSaveJson, openDiscordProfile, openExternalLink, openFolderGeneric } from "../../../src/shared/utils/app-actions";

describe("appActions utils", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.clearAllMocks();
    mocks.searchStore.directAccessParse.mockReturnValue(false);
    mocks.clipboard.writeText.mockReset().mockResolvedValue(undefined);
    mocks.appApi.OpenLink.mockReset();
    mocks.appApi.OpenDiscordProfile.mockReset().mockResolvedValue(undefined);
    mocks.appApi.OpenFolderAndSelectItem.mockReset().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: mocks.clipboard.writeText,
      },
    });
    vi.stubGlobal("AppApi", mocks.appApi);
  });

  afterEach(() => {
    vi.mocked(console.error).mockRestore();
    vi.unstubAllGlobals();
  });

  test("downloadAndSaveJson returns early for invalid params", () => {
    downloadAndSaveJson("", { a: 1 });
    downloadAndSaveJson("name", null);
    expect(document.querySelectorAll("a[download]").length).toBe(0);
  });

  test("downloadAndSaveJson creates and clicks download link", () => {
    const appendSpy = vi.spyOn(document.body, "appendChild");
    const removeSpy = vi.spyOn(document.body, "removeChild");

    downloadAndSaveJson("profile", { id: 1 });

    expect(appendSpy).toHaveBeenCalledTimes(1);
    expect(removeSpy).toHaveBeenCalledTimes(1);
    appendSpy.mockRestore();
    removeSpy.mockRestore();
  });

  test("copyToClipboard shows success toast", async () => {
    copyToClipboard("hello", "copied");
    expect(mocks.clipboard.writeText).toHaveBeenCalledWith("hello");
    await vi.waitFor(() => {
      expect(mocks.toast.success).toHaveBeenCalledWith("copied");
    });
  });

  test("copyToClipboard shows translated error toast on failure", async () => {
    mocks.clipboard.writeText.mockRejectedValue(new Error("denied"));
    copyToClipboard("hello");
    await vi.waitFor(() => {
      expect(mocks.toast.error).toHaveBeenCalledWith("copy failed");
    });
  });

  test("openExternalLink returns early when direct access parse succeeds", () => {
    mocks.searchStore.directAccessParse.mockReturnValue(true);
    openExternalLink("vrcx://user/usr_1");
    expect(mocks.externalLinkStore.showExternalLinkDialog).not.toHaveBeenCalled();
    expect(mocks.appApi.OpenLink).not.toHaveBeenCalled();
  });

  test("openExternalLink shows the external link dialog", () => {
    openExternalLink("https://example.com");

    expect(mocks.externalLinkStore.showExternalLinkDialog).toHaveBeenCalledWith("https://example.com");
    expect(mocks.appApi.OpenLink).not.toHaveBeenCalled();
  });

  test("openDiscordProfile validates empty discord id", () => {
    openDiscordProfile("");
    expect(mocks.toast.error).toHaveBeenCalledWith("No Discord ID provided!");
  });

  test("openDiscordProfile shows error toast when api fails", async () => {
    mocks.appApi.OpenDiscordProfile.mockRejectedValue(new Error("fail"));
    openDiscordProfile("123");
    await vi.waitFor(() => {
      expect(mocks.toast.error).toHaveBeenCalledWith("Failed to open Discord profile!");
    });
  });

  test("openFolderGeneric delegates to AppApi", () => {
    openFolderGeneric("/tmp/a.txt");
    expect(mocks.appApi.OpenFolderAndSelectItem).toHaveBeenCalledWith("/tmp/a.txt", true);
  });

  test("openFolderGeneric logs when AppApi rejects", async () => {
    const consoleErrorSpy = vi.mocked(console.error);
    mocks.appApi.OpenFolderAndSelectItem.mockRejectedValue(new Error("no folder"));
    openFolderGeneric("/tmp/a.txt");
    await vi.waitFor(() => {
      expect(consoleErrorSpy).toHaveBeenCalledWith("Failed to open folder:", expect.any(Error));
    });
  });
});
