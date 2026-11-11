import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("../../src/shared/utils/file-utils", () => ({
  extractFileId: vi.fn(),
  extractFileVersion: vi.fn(),
}));
vi.mock("../../src/shared/utils/notification-message", () => ({
  getNotificationMessage: vi.fn(),
  toNotificationText: vi.fn(),
}));

import { extractFileId, extractFileVersion } from "../../src/shared/utils/file-utils";
import { getNotificationMessage, toNotificationText } from "../../src/shared/utils/notification-message";
import { createOverlayDispatch } from "../../src/stores/notification/overlay-dispatch";
import type { NotyEntry } from "../../src/stores/notification/types";

type OverlayNoty = NotyEntry & {
  thumbnailImageUrl?: string;
  imageUrl?: string;
};

type Noty = OverlayNoty;

function makeNoty(overrides: Partial<OverlayNoty> = {}): OverlayNoty {
  return { type: "", created_at: "", ...overrides };
}

type UserJson = {
  iconUrl?: string;
  profilePicOverride?: string;
  currentAvatarThumbnailImageUrl?: string;
} | null;

const appApi = {
  GetImage: vi.fn<(imageUrl: string, fileId: string, fileVersion: string) => Promise<string>>(),
  DesktopNotification: vi.fn<(title: string, body: string, image: string) => void>(),
  XSNotification: vi.fn<(source: string, text: string, timeout: number, opacity: number, image: string) => void>(),
};

function makeDeps() {
  return {
    getUserIdFromNoty: vi.fn<(noty: Noty) => string>(() => ""),
    queryRequest: {
      fetch: vi.fn<(endpoint: string, params: { userId: string }) => Promise<{ json: UserJson }>>().mockResolvedValue({ json: null }),
    },
    notificationsSettingsStore: {
      notificationTimeout: 5000,
    },
    advancedSettingsStore: {
      notificationOpacity: 80,
    },
    appearanceSettingsStore: {
      displayVRCPlusIconsAsAvatar: false,
    },
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("notyGetImage", () => {
  let deps: ReturnType<typeof makeDeps>;
  let dispatch: ReturnType<typeof createOverlayDispatch>;

  beforeEach(() => {
    vi.clearAllMocks();
    deps = makeDeps();
    dispatch = createOverlayDispatch(deps);
  });

  test("returns thumbnailImageUrl when present", async () => {
    const noty = makeNoty({ thumbnailImageUrl: "https://thumb.jpg" });
    const result: unknown = await dispatch.notyGetImage(noty);
    expect(result).toBe("https://thumb.jpg");
  });

  test("returns details.imageUrl when thumbnailImageUrl absent", async () => {
    const noty = makeNoty({ details: { imageUrl: "https://detail.jpg" } });
    const result: unknown = await dispatch.notyGetImage(noty);
    expect(result).toBe("https://detail.jpg");
  });

  test("returns imageUrl when thumbnailImageUrl and details absent", async () => {
    const noty = makeNoty({ imageUrl: "https://img.jpg" });
    const result: unknown = await dispatch.notyGetImage(noty);
    expect(result).toBe("https://img.jpg");
  });

  test("looks up user currentAvatarThumbnailImageUrl when no image URLs", async () => {
    deps.getUserIdFromNoty.mockReturnValue("usr_abc");
    deps.queryRequest.fetch.mockResolvedValue({
      json: {
        currentAvatarThumbnailImageUrl: "https://avatar.jpg",
      },
    });
    dispatch = createOverlayDispatch(deps);

    const noty = makeNoty();
    const result: unknown = await dispatch.notyGetImage(noty);
    expect(result).toBe("https://avatar.jpg");
  });

  test("returns profilePicOverride when available", async () => {
    deps.getUserIdFromNoty.mockReturnValue("usr_abc");
    deps.queryRequest.fetch.mockResolvedValue({
      json: {
        profilePicOverride: "https://profile.jpg",
        currentAvatarThumbnailImageUrl: "https://avatar.jpg",
      },
    });
    dispatch = createOverlayDispatch(deps);

    const result: unknown = await dispatch.notyGetImage(makeNoty());
    expect(result).toBe("https://profile.jpg");
  });

  test("returns empty string for grp_ userId", async () => {
    deps.getUserIdFromNoty.mockReturnValue("grp_abc");
    dispatch = createOverlayDispatch(deps);

    const result: unknown = await dispatch.notyGetImage(makeNoty());
    expect(result).toBe("");
    expect(deps.queryRequest.fetch).not.toHaveBeenCalled();
  });

  test("returns empty string when user lookup fails", async () => {
    deps.getUserIdFromNoty.mockReturnValue("usr_abc");
    deps.queryRequest.fetch.mockRejectedValue(new Error("Network error"));
    dispatch = createOverlayDispatch(deps);

    const result: unknown = await dispatch.notyGetImage(makeNoty());
    expect(result).toBe("");
  });

  test("returns empty string when user has no json", async () => {
    deps.getUserIdFromNoty.mockReturnValue("usr_abc");
    deps.queryRequest.fetch.mockResolvedValue({ json: null });
    dispatch = createOverlayDispatch(deps);

    const result: unknown = await dispatch.notyGetImage(makeNoty());
    expect(result).toBe("");
  });
});

describe("displayDesktopToast", () => {
  let deps: ReturnType<typeof makeDeps>;
  let dispatch: ReturnType<typeof createOverlayDispatch>;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("isHostWindows", true);
    vi.stubGlobal("AppApi", appApi);
    deps = makeDeps();
    dispatch = createOverlayDispatch(deps);
  });

  test("calls desktopNotification with message from getNotificationMessage", () => {
    vi.mocked(getNotificationMessage).mockReturnValue({
      title: "Friend Online",
      body: "Alice is online",
    });

    dispatch.displayDesktopToast(makeNoty(), "some message", "img.jpg");

    expect(getNotificationMessage).toHaveBeenCalled();
    expect(appApi.DesktopNotification).toHaveBeenCalledWith("Friend Online", "Alice is online", "img.jpg");
  });

  test("does nothing when getNotificationMessage returns null", () => {
    vi.mocked(getNotificationMessage).mockReturnValue(null);

    dispatch.displayDesktopToast(makeNoty(), "some message", "img.jpg");

    expect(appApi.DesktopNotification).not.toHaveBeenCalled();
  });
});

describe("notySaveImage", () => {
  let deps: ReturnType<typeof makeDeps>;
  let dispatch: ReturnType<typeof createOverlayDispatch>;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("AppApi", appApi);
    appApi.GetImage.mockResolvedValue("/local/path.jpg");
    deps = makeDeps();
    dispatch = createOverlayDispatch(deps);
  });

  test("returns saved image path from fileId/fileVersion extraction", async () => {
    vi.mocked(extractFileId).mockReturnValue("file_123");
    vi.mocked(extractFileVersion).mockReturnValue("v1");

    const noty = makeNoty({
      thumbnailImageUrl: "https://api.vrchat.cloud/file_123/v1",
    });
    const result: unknown = await dispatch.notySaveImage(noty);

    expect(appApi.GetImage).toHaveBeenCalledWith("https://api.vrchat.cloud/file_123/v1", "file_123", "v1");
    expect(result).toBe("/local/path.jpg");
  });

  test("falls back to URL-derived fileId for http URLs without fileId", async () => {
    vi.mocked(extractFileId).mockReturnValue("");
    vi.mocked(extractFileVersion).mockReturnValue("");

    const noty = makeNoty({
      thumbnailImageUrl: "https://cdn.example.com/1416226261.thumbnail-500.png",
    });
    const result: unknown = await dispatch.notySaveImage(noty);

    expect(appApi.GetImage).toHaveBeenCalledWith("https://cdn.example.com/1416226261.thumbnail-500.png", "1416226261", "1416226261.thumbnail-500.png");
    expect(result).toBe("/local/path.jpg");
  });

  test("returns empty string when no image URL is found", async () => {
    vi.mocked(extractFileId).mockReturnValue("");
    vi.mocked(extractFileVersion).mockReturnValue("");
    deps.getUserIdFromNoty.mockReturnValue("");
    dispatch = createOverlayDispatch(deps);

    const noty = makeNoty();
    const result: unknown = await dispatch.notySaveImage(noty);

    expect(result).toBe("");
  });
});

describe("displayXSNotification", () => {
  let deps: ReturnType<typeof makeDeps>;
  let dispatch: ReturnType<typeof createOverlayDispatch>;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("AppApi", appApi);
    deps = makeDeps();
    dispatch = createOverlayDispatch(deps);
  });

  test("calls XSNotification with formatted text", () => {
    vi.mocked(getNotificationMessage).mockReturnValue({
      title: "Title",
      body: "Body",
    });
    vi.mocked(toNotificationText).mockReturnValue("Title: Body");

    dispatch.displayXSNotification(makeNoty({ type: "friendOnline" }), "msg", "img");

    expect(toNotificationText).toHaveBeenCalledWith("Title", "Body", "friendOnline");
    expect(appApi.XSNotification).toHaveBeenCalledWith("VRCX", "Title: Body", 5, 0.8, "img");
  });

  test("does nothing when getNotificationMessage returns null", () => {
    vi.mocked(getNotificationMessage).mockReturnValue(null);

    dispatch.displayXSNotification(makeNoty(), "msg", "img");

    expect(appApi.XSNotification).not.toHaveBeenCalled();
  });
});
