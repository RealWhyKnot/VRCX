import { beforeEach, describe, expect, test, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { flushPromises, mount } from "@vue/test-utils";

const mocks = vi.hoisted(() => ({
  savePictureOwner: vi.fn<(...args: string[]) => Promise<void>>(() => Promise.resolve()),
  discoverInstances: vi.fn<(query: string) => Promise<unknown>>(),
  getActiveInstances: vi.fn<(params: { n: number; offset: number }) => Promise<unknown>>(),
  selfInvite: vi.fn<(params: { worldId: string; instanceId: string; shortName?: string }) => Promise<unknown>>(),
  showLaunchDialog: vi.fn<(location: string, shortName: string | null) => Promise<void>>(),
  showWorldDialog: vi.fn<(worldId: string) => void>(),
  routerPush: vi.fn<(to: { name: string }) => Promise<void>>(),
  toastSuccess: vi.fn<(message: string) => void>(),
  logError: vi.fn<(err: unknown) => void>(),
  toastInfo: vi.fn<(message: string) => void>(),
  showUserDialog: vi.fn<(userId: string) => void>(),
  getAvatarImages: vi.fn<(params: { fileId: string }) => Promise<{ json: unknown }>>(),
  getUser: vi.fn<(params: { userId: string }) => Promise<{ json?: { iconUrl?: string }; ref: { displayName: string } }>>(),
  friends: new Map<string, { id: string; ref: Record<string, unknown> }>(),
  cachedUsers: new Map<string, Record<string, unknown>>(),
}));

vi.mock("vue-i18n", () => ({ useI18n: () => ({ t: (key: string) => key }) }));
vi.mock("vue-router", () => ({ useRouter: () => ({ push: mocks.routerPush }) }));
vi.mock("vue-sonner", () => ({ toast: { success: mocks.toastSuccess, info: mocks.toastInfo } }));
vi.mock("../../../src/api/image", () => ({ imageRequest: { getAvatarImages: mocks.getAvatarImages } }));
vi.mock("../../../src/api/user", () => ({ userRequest: { getUser: mocks.getUser } }));
vi.mock("../../../src/coordinators/user-coordinator", () => ({ showUserDialog: mocks.showUserDialog }));
vi.mock("../../../src/shared/utils/user", () => ({ userImage: (user: { userIcon?: string }) => user.userIcon ?? "" }));
vi.mock("../../../src/stores/friend", () => ({ useFriendStore: () => ({ friends: mocks.friends }) }));
vi.mock("../../../src/stores/user", () => ({ useUserStore: () => ({ cachedUsers: mocks.cachedUsers }) }));
vi.mock("../../../src/api/instance", () => ({
  instanceRequest: { discoverInstances: mocks.discoverInstances, getActiveInstances: mocks.getActiveInstances, selfInvite: mocks.selfInvite },
}));
vi.mock("../../../src/coordinators/world-coordinator", () => ({ showWorldDialog: mocks.showWorldDialog }));
vi.mock("../../../src/stores/vrcx-messages", () => ({ logError: mocks.logError }));
vi.mock("../../../src/coordinators/instance-sighting-coordinator", () => ({ recordDiscoveredSightings: vi.fn<() => void>() }));
vi.mock("../../../src/services/database", () => ({ database: { savePictureOwner: mocks.savePictureOwner } }));
vi.mock("../../../src/stores/launch", () => ({ useLaunchStore: () => ({ showLaunchDialog: mocks.showLaunchDialog }) }));
vi.mock("../../../src/stores/instance", async () => {
  const { defineStore } = await import("pinia");
  const { ref } = await import("vue");
  return {
    useInstanceStore: defineStore("instance", () => ({
      instanceCategories: ref([{ id: "cat_1", name: "Hangout" }]),
      instanceVibes: ref([{ id: "vibe_1", title: "Chill" }]),
      loadInstanceCategoriesAndVibes: () => Promise.resolve(),
    })),
  };
});

import InstanceBrowser from "../../../src/views/Tools/InstanceBrowser.vue";

const LONG = "W".repeat(5000);
const mountOptions = { global: { stubs: { TooltipWrapper: { template: "<div><slot /></div>" } } } };

function row(id: string, overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    worldId: "wrld_1",
    instanceId: `${id}~region(eu)`,
    location: `wrld_1:${id}~region(eu)`,
    shortName: "abcd",
    userCount: 12,
    capacity: 40,
    region: "eu",
    type: "public",
    categoryId: "cat_1",
    vibeIds: ["vibe_1"],
    ownerName: "Night Owls",
    world: { id: "wrld_1", name: "Rooftop", authorName: "Mika", thumbnailImageUrl: "https://example.test/t.png" },
    ...overrides,
  };
}

function icon(id: string): string {
  return `https://api.vrchat.cloud/api/1/image/file_${id}/1/256`;
}

async function open() {
  const wrapper = mount(InstanceBrowser, mountOptions);
  await wrapper.get('[data-testid="refresh"]').trigger("click");
  await flushPromises();
  return wrapper;
}

describe("InstanceBrowser.vue", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    mocks.friends.clear();
    mocks.cachedUsers.clear();
    mocks.discoverInstances.mockResolvedValue({ instances: [row("1"), row("2", { world: { id: "wrld_1", name: "Cinema" } })] });
    mocks.getActiveInstances.mockResolvedValue([row("9")]);
    mocks.selfInvite.mockResolvedValue({});
    mocks.showLaunchDialog.mockResolvedValue();
    mocks.routerPush.mockResolvedValue();
  });

  test("lists discovered instances with their details", async () => {
    const wrapper = await open();
    const cards = wrapper.findAll('[data-testid="instance-card"]');
    expect(cards).toHaveLength(2);
    expect(cards[0]?.text()).toContain("Rooftop");
    expect(cards[0]?.text()).toContain("12/40");
    expect(cards[0]?.text()).toContain("Hangout");
    expect(cards[0]?.text()).toContain("Chill");
    expect(cards[0]?.find(".flags.eu").exists()).toBe(true);
  });

  test("opens the launch dialog for a card", async () => {
    const wrapper = await open();
    await wrapper.get('[data-testid="launch"]').trigger("click");
    expect(mocks.showLaunchDialog).toHaveBeenCalledWith("wrld_1:1~region(eu)", "abcd");
  });

  test("sends a self invite and confirms it", async () => {
    const wrapper = await open();
    await wrapper.get('[data-testid="invite"]').trigger("click");
    await flushPromises();
    expect(mocks.selfInvite).toHaveBeenCalledWith({ worldId: "wrld_1", instanceId: "1~region(eu)", shortName: "abcd" });
    expect(mocks.toastSuccess).toHaveBeenCalledWith("message.invite.self_sent");
  });

  test("narrows the cards with the search box, which caps its length", async () => {
    const wrapper = await open();
    const search = wrapper.get('input[maxlength="100"]');
    await search.setValue("cinema");
    expect(wrapper.findAll('[data-testid="instance-card"]')).toHaveLength(1);
    await search.setValue("no such world");
    expect(wrapper.findAll('[data-testid="instance-card"]')).toHaveLength(0);
  });

  test("keeps oversized names inside truncating elements", async () => {
    mocks.discoverInstances.mockResolvedValue({
      instances: [
        row("1", {
          displayName: LONG,
          description: LONG,
          ownerName: LONG,
          userCount: 123456789,
          capacity: 987654321,
          queueSize: 99999999,
          world: { id: "wrld_1", name: LONG, authorName: LONG },
        }),
      ],
    });
    const wrapper = await open();
    const card = wrapper.get('[data-testid="instance-card"]');
    expect(card.classes()).toContain("overflow-hidden");
    const holders = card.findAll("*").filter((node) => node.element.children.length === 0 && node.text().includes(LONG));
    expect(holders.length).toBeGreaterThan(0);
    for (const holder of holders) {
      const classes = [...holder.classes(), ...(holder.element.parentElement?.className.split(" ") ?? [])];
      expect(classes.some((name) => name === "truncate" || name.startsWith("line-clamp-"))).toBe(true);
    }
  });

  test("shows friends by name first and opens their profile", async () => {
    mocks.friends.set("usr_f", {
      id: "usr_f",
      ref: { id: "usr_f", displayName: "Rina", userIcon: icon("f"), profilePicOverride: "", location: "wrld_1:1~region(eu)" },
    });
    mocks.discoverInstances.mockResolvedValue({ instances: [row("1", { userIcons: [icon("x"), null, icon("f")], friendIcons: [icon("f")] })] });
    const wrapper = await open();
    const faces = wrapper.findAll('[data-testid="instance-faces"] button');
    expect(faces.map((face) => face.attributes("data-testid"))).toEqual(["face-known", "face-unknown"]);
    expect(faces[0]?.attributes("aria-label")).toBe("Rina");
    await faces[0]?.trigger("click");
    expect(mocks.showUserDialog).toHaveBeenCalledWith("usr_f");
    expect(wrapper.get('[data-testid="faces-hidden"]').text()).toBe("+10");
  });

  test("looks up an unknown face and opens the owner of a profile icon", async () => {
    mocks.discoverInstances.mockResolvedValue({ instances: [row("1", { userIcons: [icon("click1")] })] });
    mocks.getAvatarImages.mockResolvedValue({ json: { ownerId: "usr_x", name: "icon", tags: ["icon"] } });
    mocks.getUser.mockResolvedValue({ ref: { displayName: "Mika" } });
    const wrapper = await open();
    await wrapper.get('[data-testid="face-unknown"]').trigger("click");
    await flushPromises();
    expect(mocks.getAvatarImages).toHaveBeenCalledWith({ fileId: "file_click1" });
    expect(mocks.getUser).toHaveBeenCalledWith({ userId: "usr_x" });
    expect(mocks.showUserDialog).toHaveBeenCalledWith("usr_x");
    expect(wrapper.get('[data-testid="face-unknown"]').attributes("aria-label")).toBe("Mika");
  });

  test("names a face after hovering it for a moment, without opening anything", async () => {
    vi.useFakeTimers();
    try {
      mocks.discoverInstances.mockResolvedValue({ instances: [row("1", { userIcons: [icon("hover1"), icon("hover2")] })] });
      mocks.getAvatarImages.mockResolvedValue({ json: { ownerId: "usr_h", name: "icon", tags: ["gallery"] } });
      mocks.getUser.mockResolvedValue({ ref: { displayName: "N".repeat(400) } });
      const wrapper = await open();
      const faces = wrapper.findAll('[data-testid="face-unknown"]');
      await faces[1]?.trigger("pointerenter");
      await vi.advanceTimersByTimeAsync(200);
      await faces[1]?.trigger("pointerleave");
      await vi.advanceTimersByTimeAsync(1000);
      expect(mocks.getAvatarImages).not.toHaveBeenCalled();
      await faces[0]?.trigger("pointerenter");
      await vi.advanceTimersByTimeAsync(400);
      await flushPromises();
      expect(mocks.getAvatarImages.mock.calls).toEqual([[{ fileId: "file_hover1" }]]);
      const after = wrapper.findAll('[data-testid="face-unknown"]');
      expect(after[0]?.attributes("aria-label")).toBe("N".repeat(400));
      expect(after[1]?.attributes("aria-label")).toBe("view.tools.instance_browser.face_look_up");
      expect(after[0]?.classes()).toEqual(expect.arrayContaining(["size-6", "shrink-0", "overflow-hidden"]));
      expect(mocks.showUserDialog).not.toHaveBeenCalled();
      await after[0]?.trigger("pointerenter");
      await vi.advanceTimersByTimeAsync(400);
      expect(mocks.getAvatarImages).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  test("says so when a face is only an avatar thumbnail or the lookup fails", async () => {
    mocks.discoverInstances.mockResolvedValue({ instances: [row("1", { userIcons: [icon("avi1"), icon("gone1")] })] });
    mocks.getAvatarImages.mockResolvedValueOnce({ json: { ownerId: "usr_a", name: "Avatar - Fox - Image", tags: [] } }).mockRejectedValueOnce(new Error("404"));
    mocks.getUser.mockResolvedValue({ json: { iconUrl: icon("other1") }, ref: { displayName: "Uploader" } });
    const wrapper = await open();
    const faces = wrapper.findAll('[data-testid="face-unknown"]');
    await faces[0]?.trigger("click");
    await flushPromises();
    await faces[1]?.trigger("click");
    await flushPromises();
    expect(mocks.toastInfo.mock.calls).toEqual([["view.tools.instance_browser.face_is_avatar"], ["view.tools.instance_browser.face_not_found"]]);
    expect(wrapper.findAll('[data-testid="face-unknown"]')[0]?.attributes("aria-label")).toBe("view.tools.instance_browser.face_is_avatar");
    expect(mocks.showUserDialog).not.toHaveBeenCalled();
  });

  test("does not save a name it could not read", async () => {
    mocks.discoverInstances.mockResolvedValue({ instances: [row("1", { userIcons: [icon("noname1")] })] });
    mocks.getAvatarImages.mockResolvedValue({ json: { ownerId: "usr_n", name: "icon", tags: ["icon"] } });
    mocks.getUser.mockRejectedValue(new Error("429"));
    const wrapper = await open();
    await wrapper.get('[data-testid="face-unknown"]').trigger("click");
    await flushPromises();
    expect(mocks.showUserDialog).toHaveBeenCalledWith("usr_n");
    expect(mocks.savePictureOwner).not.toHaveBeenCalled();
  });

  test("opens the uploader when their profile picture is the avatar on the face", async () => {
    mocks.discoverInstances.mockResolvedValue({ instances: [row("1", { userIcons: [icon("private1")] })] });
    mocks.getAvatarImages.mockResolvedValue({ json: { ownerId: "usr_w", name: "Avatar - Fox - Image", tags: [] } });
    mocks.getUser.mockResolvedValue({ json: { iconUrl: icon("private1") }, ref: { displayName: "Wearer" } });
    const wrapper = await open();
    await wrapper.get('[data-testid="face-unknown"]').trigger("click");
    await flushPromises();
    expect(mocks.getUser).toHaveBeenCalledWith({ userId: "usr_w" });
    expect(mocks.showUserDialog).toHaveBeenCalledWith("usr_w");
    expect(mocks.savePictureOwner).toHaveBeenCalledWith("file_private1", "wearer", "usr_w", "Wearer", expect.any(String));
    expect(mocks.toastInfo).not.toHaveBeenCalled();
  });

  test("keeps a crowded instance to a fixed number of faces that cannot grow the card", async () => {
    const crowd = Array.from({ length: 300 }, (_, position) => icon(`n${position}`));
    mocks.discoverInstances.mockResolvedValue({ instances: [row("1", { userCount: 123456789, userIcons: crowd, friendIcons: crowd.slice(0, 50) })] });
    const wrapper = await open();
    const strip = wrapper.get('[data-testid="instance-faces"]');
    expect(strip.findAll("button")).toHaveLength(8);
    expect(strip.classes()).toEqual(expect.arrayContaining(["h-6", "min-w-0", "overflow-hidden"]));
    expect(strip.findAll("button").every((face) => face.classes().includes("shrink-0") && face.classes().includes("size-6"))).toBe(true);
    const rest = wrapper.get('[data-testid="faces-hidden"]');
    expect(rest.text()).toBe("+123456781");
    expect(rest.classes()).toEqual(expect.arrayContaining(["truncate", "min-w-0"]));
  });

  test("shows no face row when the instance lists nobody", async () => {
    const wrapper = await open();
    expect(wrapper.find('[data-testid="instance-faces"]').exists()).toBe(false);
  });

  test("shows the failure message when loading fails", async () => {
    mocks.discoverInstances.mockRejectedValue(new Error("offline"));
    const wrapper = await open();
    expect(wrapper.find('[data-testid="load-failed"]').exists()).toBe(true);
    expect(wrapper.findAll('[data-testid="instance-card"]')).toHaveLength(0);
  });

  test("switches to my open instances and hides the discover filters", async () => {
    vi.useFakeTimers();
    const wrapper = mount(InstanceBrowser, mountOptions);
    await wrapper.get('[data-testid="source-active"]').trigger("mousedown", { button: 0 });
    await vi.advanceTimersByTimeAsync(400);
    vi.useRealTimers();
    await flushPromises();
    expect(mocks.getActiveInstances).toHaveBeenCalledWith({ n: 50, offset: 0 });
    expect(wrapper.findAll('[data-testid="instance-card"]')).toHaveLength(1);
    expect(wrapper.text()).not.toContain("view.tools.instance_browser.group_hosted");
  });

  test("goes back to the tools page", async () => {
    const wrapper = mount(InstanceBrowser, mountOptions);
    await wrapper.get("button").trigger("click");
    expect(mocks.routerPush).toHaveBeenCalledWith({ name: "tools" });
  });
});
