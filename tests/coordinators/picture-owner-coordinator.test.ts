import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

type UserJson = { currentAvatarImageUrl?: string; currentAvatarThumbnailImageUrl?: string; iconUrl?: string };

const mocks = vi.hoisted(() => ({
  getAvatarImages: vi.fn<(params: { fileId: string }) => Promise<{ json: unknown }>>(),
  getUser: vi.fn<(params: { userId: string }) => Promise<{ json: UserJson; ref: { displayName: string } }>>(),
  cachedUsers: new Map<string, { displayName: string }>(),
}));

vi.mock("../../src/api/image", () => ({ imageRequest: { getAvatarImages: mocks.getAvatarImages } }));
vi.mock("../../src/api/user", () => ({ userRequest: { getUser: mocks.getUser } }));
vi.mock("../../src/stores/user", () => ({ useUserStore: () => ({ cachedUsers: mocks.cachedUsers }) }));

function icon(fileId: string): string {
  return `https://api.vrchat.cloud/api/1/file/${fileId}/1/file`;
}

function avatarFile(ownerId: string) {
  return { json: { ownerId, name: "Avatar - Fox - Image - 2022", tags: [] } };
}

function wearing(json: UserJson) {
  return { json, ref: { displayName: "Uploader" } };
}

async function load() {
  vi.resetModules();
  return import("../../src/coordinators/picture-owner-coordinator");
}

describe("lookUpPictureOwner", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    mocks.cachedUsers.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test("returns the uploader of an icon without fetching their profile", async () => {
    mocks.getAvatarImages.mockResolvedValue({ json: { ownerId: "usr_a", name: "icon", tags: ["icon"] } });
    const { lookUpPictureOwner } = await load();
    expect(await lookUpPictureOwner("file_icon")).toEqual({ owner: { kind: "user", userId: "usr_a" }, isAvatarWearer: false });
    expect(mocks.getUser).not.toHaveBeenCalled();
  });

  test("names the uploader when they are wearing that avatar now", async () => {
    mocks.getAvatarImages.mockResolvedValue(avatarFile("usr_w"));
    mocks.getUser.mockResolvedValue(wearing({ currentAvatarImageUrl: icon("file_big"), currentAvatarThumbnailImageUrl: icon("file_worn") }));
    const { lookUpPictureOwner } = await load();
    expect(await lookUpPictureOwner("file_worn")).toEqual({ owner: { kind: "user", userId: "usr_w" }, isAvatarWearer: true });
    expect(mocks.getUser).toHaveBeenCalledWith({ userId: "usr_w" });
  });

  test("matches the full size avatar image as well", async () => {
    mocks.getAvatarImages.mockResolvedValue(avatarFile("usr_w"));
    mocks.getUser.mockResolvedValue(wearing({ currentAvatarImageUrl: icon("file_worn"), currentAvatarThumbnailImageUrl: "" }));
    const { lookUpPictureOwner } = await load();
    expect(await lookUpPictureOwner("file_worn")).toEqual({ owner: { kind: "user", userId: "usr_w" }, isAvatarWearer: true });
  });

  test("names a stranger whose profile picture is that avatar", async () => {
    mocks.getAvatarImages.mockResolvedValue(avatarFile("usr_s"));
    mocks.getUser.mockResolvedValue(wearing({ iconUrl: "https://api.vrchat.cloud/api/1/image/file_worn/1/256" }));
    const { lookUpPictureOwner } = await load();
    expect(await lookUpPictureOwner("file_worn")).toEqual({ owner: { kind: "user", userId: "usr_s" }, isAvatarWearer: true });
  });

  test("leaves the face unnamed when the uploader wears something else", async () => {
    mocks.getAvatarImages.mockResolvedValue(avatarFile("usr_w"));
    mocks.getUser.mockResolvedValue(
      wearing({ currentAvatarImageUrl: icon("file_other"), currentAvatarThumbnailImageUrl: icon("file_other2"), iconUrl: icon("file_other3") })
    );
    const { lookUpPictureOwner } = await load();
    expect(await lookUpPictureOwner("file_worn")).toEqual({ owner: { kind: "avatar" }, isAvatarWearer: false });
  });

  test("leaves the face unnamed when the uploader's profile has no avatar images", async () => {
    mocks.getAvatarImages.mockResolvedValue(avatarFile("usr_w"));
    mocks.getUser.mockResolvedValue(wearing({}));
    const { lookUpPictureOwner } = await load();
    expect(await lookUpPictureOwner("file_worn")).toEqual({ owner: { kind: "avatar" }, isAvatarWearer: false });
  });

  test("leaves an avatar picture alone when the file names no uploader", async () => {
    mocks.getAvatarImages.mockResolvedValue({ json: { name: "Avatar - Fox - Image", tags: [] } });
    const { lookUpPictureOwner } = await load();
    expect(await lookUpPictureOwner("file_x")).toEqual({ owner: { kind: "avatar" }, isAvatarWearer: false });
    expect(mocks.getUser).not.toHaveBeenCalled();
  });

  test("fails when the profile cannot be read and checks it again next time", async () => {
    mocks.getAvatarImages.mockResolvedValue(avatarFile("usr_w"));
    mocks.getUser.mockRejectedValueOnce(new Error("429")).mockResolvedValue(wearing({ currentAvatarThumbnailImageUrl: icon("file_worn") }));
    const { lookUpPictureOwner } = await load();
    await expect(lookUpPictureOwner("file_worn")).rejects.toThrow("429");
    expect(await lookUpPictureOwner("file_worn")).toEqual({ owner: { kind: "user", userId: "usr_w" }, isAvatarWearer: true });
    expect(mocks.getAvatarImages).toHaveBeenCalledTimes(1);
    expect(mocks.getUser).toHaveBeenCalledTimes(2);
  });
});
