import { beforeEach, describe, expect, test, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { flushPromises, mount } from "@vue/test-utils";

const mocks = vi.hoisted(() => ({
  getAvatarImages: vi.fn<(params: { fileId: string }) => Promise<{ json: unknown }>>(),
  showUserDialog: vi.fn<(userId: string) => void>(),
  toastInfo: vi.fn<(message: string) => void>(),
  logError: vi.fn<(err: unknown) => void>(),
  dialog: { value: { visible: true, imageUrl: "", fileName: "" } },
}));

vi.mock("vue-i18n", () => ({ useI18n: () => ({ t: (key: string) => key }) }));
vi.mock("vue-sonner", () => ({ toast: { info: mocks.toastInfo, success: vi.fn(), error: vi.fn(), dismiss: vi.fn() } }));
vi.mock("../../src/api/image", () => ({ imageRequest: { getAvatarImages: mocks.getAvatarImages } }));
vi.mock("../../src/api/user", () => ({ userRequest: { getUser: vi.fn() } }));
vi.mock("../../src/stores/user", () => ({ useUserStore: () => ({ cachedUsers: new Map() }) }));
vi.mock("../../src/coordinators/user-coordinator", () => ({ showUserDialog: mocks.showUserDialog }));
vi.mock("../../src/stores/vrcx-messages", () => ({ logError: mocks.logError }));
vi.mock("../../src/services/webapi", () => ({ webApiService: { execute: vi.fn() } }));
vi.mock("../../src/lib/modal-portal-layers", () => ({ acquireModalPortalLayer: () => ({ element: null, bringToFront: vi.fn(), release: vi.fn() }) }));
vi.mock("../../src/stores/settings/general", async () => {
  const { ref } = await import("vue");
  return { useGeneralSettingsStore: () => ({ disableGpuAcceleration: ref(true) }) };
});
vi.mock("../../src/stores/gallery", async () => {
  const { reactive } = await import("vue");
  const state = reactive(mocks.dialog);
  return { useGalleryStore: () => ({ fullscreenImageDialog: state.value, $id: "gallery" }) };
});
vi.mock("pinia", async (importOriginal) => {
  const actual = await importOriginal<typeof import("pinia")>();
  const { toRefs, reactive } = await import("vue");
  return { ...actual, storeToRefs: (store: object) => toRefs(reactive(store)) };
});

import FullscreenImagePreview from "../../src/components/FullscreenImagePreview.vue";

function imageUrl(id: string): string {
  return `https://api.vrchat.cloud/api/1/file/file_${id}/1/file`;
}

async function show(url: string) {
  mocks.dialog.value.visible = true;
  mocks.dialog.value.imageUrl = url;
  const wrapper = mount(FullscreenImagePreview, { attachTo: document.body });
  await flushPromises();
  const button = document.body.querySelector<HTMLButtonElement>('[data-testid="find-uploader"]');
  if (!button) {
    throw new Error("uploader button missing");
  }
  return { wrapper, button };
}

describe("FullscreenImagePreview.vue uploader lookup", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    document.body.innerHTML = "";
    for (const mock of [mocks.getAvatarImages, mocks.showUserDialog, mocks.toastInfo, mocks.logError]) {
      mock.mockReset();
    }
  });

  test("opens the profile of whoever uploaded the picture and closes the viewer", async () => {
    mocks.getAvatarImages.mockResolvedValue({ json: { ownerId: "usr_up", name: "Avatar - Fox - Image", tags: [] } });
    const { wrapper, button } = await show(imageUrl("up1"));
    expect(button.disabled).toBe(false);
    button.click();
    await flushPromises();
    expect(mocks.getAvatarImages).toHaveBeenCalledWith({ fileId: "file_up1" });
    expect(mocks.showUserDialog).toHaveBeenCalledWith("usr_up");
    expect(mocks.dialog.value.visible).toBe(false);
    wrapper.unmount();
  });

  test("says so when the file has no uploader or the lookup fails", async () => {
    mocks.getAvatarImages.mockResolvedValueOnce({ json: { ownerId: "x".repeat(5000) } }).mockRejectedValueOnce(new Error("404"));
    const first = await show(imageUrl("none1"));
    first.button.click();
    await flushPromises();
    first.wrapper.unmount();
    document.body.innerHTML = "";
    const second = await show(imageUrl("fail1"));
    second.button.click();
    await flushPromises();
    expect(mocks.toastInfo.mock.calls).toEqual([["dialog.fullscreen_image.uploader_not_found"], ["dialog.fullscreen_image.uploader_not_found"]]);
    expect(mocks.showUserDialog).not.toHaveBeenCalled();
    expect(mocks.logError).toHaveBeenCalledTimes(1);
    second.wrapper.unmount();
  });

  test("turns the button off for pictures that are not VRChat files", async () => {
    const { wrapper, button } = await show("https://example.test/picture.png");
    expect(button.disabled).toBe(true);
    wrapper.unmount();
  });
});
