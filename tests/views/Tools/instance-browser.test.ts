import { beforeEach, describe, expect, test, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { flushPromises, mount } from "@vue/test-utils";

const mocks = vi.hoisted(() => ({
  discoverInstances: vi.fn<(query: string) => Promise<unknown>>(),
  getActiveInstances: vi.fn<(params: { n: number; offset: number }) => Promise<unknown>>(),
  selfInvite: vi.fn<(params: { worldId: string; instanceId: string; shortName?: string }) => Promise<unknown>>(),
  showLaunchDialog: vi.fn<(location: string, shortName: string | null) => Promise<void>>(),
  showWorldDialog: vi.fn<(worldId: string) => void>(),
  routerPush: vi.fn<(to: { name: string }) => Promise<void>>(),
  toastSuccess: vi.fn<(message: string) => void>(),
  logError: vi.fn<(err: unknown) => void>(),
}));

vi.mock("vue-i18n", () => ({ useI18n: () => ({ t: (key: string) => key }) }));
vi.mock("vue-router", () => ({ useRouter: () => ({ push: mocks.routerPush }) }));
vi.mock("vue-sonner", () => ({ toast: { success: mocks.toastSuccess } }));
vi.mock("../../../src/api/instance", () => ({
  instanceRequest: { discoverInstances: mocks.discoverInstances, getActiveInstances: mocks.getActiveInstances, selfInvite: mocks.selfInvite },
}));
vi.mock("../../../src/coordinators/world-coordinator", () => ({ showWorldDialog: mocks.showWorldDialog }));
vi.mock("../../../src/stores/vrcx-messages", () => ({ logError: mocks.logError }));
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

  test("shows the failure message when loading fails", async () => {
    mocks.discoverInstances.mockRejectedValue(new Error("offline"));
    const wrapper = await open();
    expect(wrapper.find('[data-testid="load-failed"]').exists()).toBe(true);
    expect(wrapper.findAll('[data-testid="instance-card"]')).toHaveLength(0);
  });

  test("switches to my open instances and hides the discover filters", async () => {
    vi.useFakeTimers();
    const wrapper = mount(InstanceBrowser, mountOptions);
    await wrapper.get('[data-testid="source-mine"]').trigger("click");
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
