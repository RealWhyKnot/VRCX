import { beforeEach, describe, expect, test, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";

const mocks = vi.hoisted(() => ({
  logError: vi.fn<(err: unknown) => void>(),
  toastInfo: vi.fn<(message: string) => void>(),
  showUserDialog: vi.fn<(userId: string) => void>(),
  getAvatarImages: vi.fn<(params: { fileId: string }) => Promise<{ json: unknown }>>(),
  getUser: vi.fn<(params: { userId: string }) => Promise<{ ref: { displayName: string } }>>(),
  friends: new Map<string, { id: string; ref: Record<string, unknown> }>(),
  cachedUsers: new Map<string, Record<string, unknown>>(),
}));

vi.mock("vue-i18n", () => ({ useI18n: () => ({ t: (key: string) => key }) }));
vi.mock("vue-sonner", () => ({ toast: { info: mocks.toastInfo } }));
vi.mock("../../src/api/image", () => ({ imageRequest: { getAvatarImages: mocks.getAvatarImages } }));
vi.mock("../../src/api/user", () => ({ userRequest: { getUser: mocks.getUser } }));
vi.mock("../../src/coordinators/user-coordinator", () => ({ showUserDialog: mocks.showUserDialog }));
vi.mock("../../src/shared/utils/user", () => ({ userImage: (user: { userIcon?: string }) => user.userIcon ?? "" }));
vi.mock("../../src/stores/friend", () => ({ useFriendStore: () => ({ friends: mocks.friends }) }));
vi.mock("../../src/stores/user", () => ({ useUserStore: () => ({ cachedUsers: mocks.cachedUsers }) }));
vi.mock("../../src/stores/vrcx-messages", () => ({ logError: mocks.logError }));

import InstancePeople from "../../src/components/InstancePeople.vue";

const LOCATION = "wrld_1:1~region(eu)";
const mountOptions = { global: { stubs: { TooltipWrapper: { template: "<div><slot /></div>" } } } };

function icon(id: string): string {
  return `https://api.vrchat.cloud/api/1/image/file_${id}/1/256`;
}

function open(instance: { userCount?: number; userIcons?: string[] } | null) {
  return mount(InstancePeople, { ...mountOptions, props: { location: LOCATION, instance } });
}

describe("InstancePeople.vue", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.friends.clear();
    mocks.cachedUsers.clear();
  });

  test("shows the people VRChat lists for the instance and leaves out friends shown elsewhere", () => {
    mocks.friends.set("usr_f", { id: "usr_f", ref: { id: "usr_f", displayName: "Rina", userIcon: icon("pf"), profilePicOverride: "", location: LOCATION } });
    mocks.cachedUsers.set("usr_k", { id: "usr_k", displayName: "Kai", userIcon: icon("pk"), profilePicOverride: "", location: "" });
    const wrapper = open({ userCount: 5, userIcons: [icon("pf"), icon("pk"), icon("px"), "http://insecure.test/a.png"] });
    const faces = wrapper.findAll("button");
    expect(faces.map((face) => face.attributes("data-testid"))).toEqual(["face-known", "face-unknown"]);
    expect(faces[0]?.attributes("aria-label")).toBe("Kai");
    expect(wrapper.get('[data-testid="faces-hidden"]').text()).toBe("+2");
  });

  test("still shows strangers when many friends are in the instance", () => {
    for (let position = 0; position < 12; position += 1) {
      const id = `usr_f${position}`;
      mocks.friends.set(id, {
        id,
        ref: { id, displayName: `Friend ${position}`, userIcon: icon(`fr${position}`), profilePicOverride: "", location: LOCATION },
      });
    }
    const wrapper = open({ userCount: 15, userIcons: [icon("fr0"), icon("s1"), icon("s2"), icon("s3")] });
    expect(wrapper.findAll("button").map((face) => face.attributes("data-testid"))).toEqual(["face-unknown", "face-unknown", "face-unknown"]);
    expect(wrapper.find('[data-testid="faces-hidden"]').exists()).toBe(false);
  });

  test("does not ask VRChat again right after a picture lookup failed", async () => {
    mocks.getAvatarImages.mockRejectedValue(new Error("429"));
    const wrapper = open({ userCount: 1, userIcons: [icon("failing1")] });
    await wrapper.get('[data-testid="face-unknown"]').trigger("click");
    await flushPromises();
    await wrapper.get('[data-testid="face-unknown"]').trigger("click");
    await flushPromises();
    expect(mocks.getAvatarImages).toHaveBeenCalledTimes(1);
    expect(mocks.toastInfo).toHaveBeenCalledTimes(2);
  });

  test("opens the profile behind a face after looking the picture up", async () => {
    mocks.getAvatarImages.mockResolvedValue({ json: { ownerId: "usr_x", name: "icon", tags: ["icon"] } });
    mocks.getUser.mockResolvedValue({ ref: { displayName: "Mika" } });
    const wrapper = open({ userCount: 1, userIcons: [icon("people1")] });
    await wrapper.get('[data-testid="face-unknown"]').trigger("click");
    await flushPromises();
    expect(mocks.getAvatarImages).toHaveBeenCalledWith({ fileId: "file_people1" });
    expect(mocks.showUserDialog).toHaveBeenCalledWith("usr_x");
  });

  test("renders nothing when the instance has no pictures or has not loaded", () => {
    expect(open(null).find("button").exists()).toBe(false);
    expect(open({ userCount: 30 }).find("button").exists()).toBe(false);
    expect(open({ userCount: 30, userIcons: [] }).find('[data-testid="faces-hidden"]').exists()).toBe(false);
  });

  test("keeps a crowded instance to one fixed row", () => {
    const crowd = Array.from({ length: 300 }, (_, position) => icon(`crowd${position}`));
    const wrapper = open({ userCount: 987654321, userIcons: crowd });
    const strip = wrapper.get('[data-testid="instance-people"]');
    expect(strip.findAll("button")).toHaveLength(8);
    expect(strip.classes()).toEqual(expect.arrayContaining(["h-6", "min-w-0", "overflow-hidden"]));
    expect(wrapper.get('[data-testid="faces-hidden"]').classes()).toEqual(expect.arrayContaining(["truncate", "min-w-0"]));
  });
});
