import { flushPromises, mount } from "@vue/test-utils";
import { beforeEach, expect, test, vi } from "vitest";
import { defineComponent, h, KeepAlive } from "vue";
import { i18n } from "@/plugins/i18n";
import { queryClient } from "@/queries/client";
import GroupCalendarDiscovery from "@/views/Tools/components/GroupCalendarDiscovery.vue";
import InfoPushDialog from "@/views/Tools/dialogs/InfoPushDialog.vue";
import Jams from "@/views/Tools/Jams.vue";

const mocks = vi.hoisted(() => ({
  request: vi.fn<(path: string, options: unknown) => Promise<unknown>>(),
  showAvatar: vi.fn(),
  showWorld: vi.fn(),
  push: vi.fn(),
}));

vi.mock("@/services/request", () => ({ request: mocks.request }));
vi.mock("@/coordinators/avatar-coordinator", () => ({ showAvatarDialog: mocks.showAvatar }));
vi.mock("@/coordinators/world-coordinator", () => ({ showWorldDialog: mocks.showWorld }));
vi.mock("@/coordinators/group-dialog-coordinator", () => ({ showGroupDialog: vi.fn() }));
vi.mock("@/coordinators/date-coordinator", () => ({ formatDateFilter: (date: string) => date }));
vi.mock("@/stores/user", () => ({ useUserStore: () => ({}) }));
vi.mock("@/stores/gallery", () => ({ useGalleryStore: () => ({ showFullscreenImageDialog: vi.fn() }) }));
vi.mock("@/stores/vrcx-messages", () => ({ logError: vi.fn() }));
vi.mock("@/plugins/router", () => ({ router: {}, initRouter: vi.fn() }));
vi.mock("vue-router", () => ({ useRouter: () => ({ push: mocks.push }) }));
vi.mock("@/views/Tools/components/GroupCalendarEventCard.vue", () => ({
  default: (props: { event: { title: string } }) => h("div", props.event.title),
}));

const longTitle = "W".repeat(5000);
const global = { plugins: [i18n] };
const jam = {
  id: "jam_a",
  title: longTitle,
  state: "submissions_open",
  stateChangeDates: { submissionsOpened: "2026-11-18", submissionsClosed: "2026-11-20" },
};
const JamsHost = defineComponent({ render: () => h(KeepAlive, null, { default: () => h(Jams) }) });

beforeEach(() => {
  queryClient.clear();
  vi.resetAllMocks();
});

test("pages through submissions and opens their existing dialogs without hydrating rows", async () => {
  mocks.request.mockResolvedValueOnce([jam]).mockResolvedValueOnce(
    Array.from({ length: 13 }, (_, i) => ({
      id: `submission_${i}`,
      contentId: i === 12 ? "avtr_entry" : `wrld_entry_${i}`,
      description: i ? "" : longTitle,
      created_at: "2026-11-19",
    }))
  );
  const wrapper = mount(JamsHost, { global });
  await flushPromises();
  expect(mocks.request).toHaveBeenCalledExactlyOnceWith("jams", { method: "GET", params: { type: "world" } });
  expect(wrapper.get("tbody button[title]").attributes("title")).toBe(longTitle);
  expect(wrapper.get("tbody button[title] span").classes()).toContain("truncate");
  expect(wrapper.get("table").classes()).toContain("table-fixed");
  expect(wrapper.text()).toContain("2026-11-20");

  await wrapper.get("tbody button[title]").trigger("click");
  await flushPromises();
  expect(mocks.request).toHaveBeenLastCalledWith("jams/jam_a/submissions", { method: "GET" });
  expect(wrapper.findAll("tbody tr")).toHaveLength(12);
  await wrapper.get("tbody button[title]").trigger("click");
  expect(mocks.showWorld).toHaveBeenCalledExactlyOnceWith("wrld_entry_0");
  await wrapper
    .findAll("button")
    .find((button) => button.text() === "Next")
    ?.trigger("click");
  expect(wrapper.findAll("tbody tr")).toHaveLength(1);
  await wrapper.get('button[title="avtr_entry"]').trigger("click");
  expect(mocks.showAvatar).toHaveBeenCalledExactlyOnceWith("avtr_entry");
  wrapper.unmount();

  const reopened = mount(JamsHost, { global });
  await flushPromises();
  await reopened.get("tbody button[title]").trigger("click");
  await flushPromises();
  expect(mocks.request).toHaveBeenCalledTimes(2);
  reopened.unmount();
});

test("switches discovery scopes, pages with the returned cursor, and reuses read pages", async () => {
  mocks.request
    .mockResolvedValueOnce({ results: [{ id: "live", title: "Live event" }] })
    .mockResolvedValueOnce({ results: [{ id: "upcoming", title: "Upcoming event" }], nextCursor: "page-2" })
    .mockResolvedValueOnce({ results: [{ id: "next", title: "Next event" }] });
  const wrapper = mount(GroupCalendarDiscovery, { global });
  await flushPromises();
  expect(wrapper.text()).toContain("Live event");
  expect(mocks.request).toHaveBeenLastCalledWith("calendar/discover", { method: "GET", params: { scope: "live", n: 12 } });
  await wrapper
    .findAll("button")
    .find((button) => button.text() === "Upcoming")
    ?.trigger("click");
  await flushPromises();
  expect(wrapper.text()).toContain("Upcoming event");
  await wrapper
    .findAll("button")
    .find((button) => button.text() === "Next")
    ?.trigger("click");
  await flushPromises();
  expect(wrapper.text()).toContain("Next event");
  expect(mocks.request).toHaveBeenLastCalledWith("calendar/discover", { method: "GET", params: { nextCursor: "page-2", n: 12 } });
  await wrapper
    .findAll("button")
    .find((button) => button.text() === "Previous")
    ?.trigger("click");
  await flushPromises();
  expect(wrapper.text()).toContain("Upcoming event");
  expect(mocks.request).toHaveBeenCalledTimes(3);
  wrapper.unmount();
});

test("waits for shelf expansion and reuses the loaded result after collapse", async () => {
  mocks.request.mockResolvedValueOnce([{ id: "ips_a", type: "ContentShelf", data: { title: longTitle }, tags: ["user-all"] }]).mockResolvedValueOnce({
    responseType: "instance",
    results: [{ location: "wrld_a:1", worldId: "wrld_a", displayName: longTitle, userCount: 10, capacity: 20 }],
  });
  const wrapper = mount(InfoPushDialog, {
    props: { isInfoPushDialogVisible: true },
    global: {
      ...global,
      stubs: { Dialog: { template: "<div><slot /></div>" }, DialogContent: { template: "<div><slot /></div>" }, DialogTitle: true, TooltipWrapper: true },
    },
  });
  await flushPromises();
  expect(mocks.request).toHaveBeenCalledTimes(1);
  const disclosure = wrapper.get("button[aria-expanded=false]");
  await disclosure.trigger("click");
  await flushPromises();
  expect(disclosure.attributes("aria-expanded")).toBe("true");
  expect(mocks.request).toHaveBeenLastCalledWith("infoPush/ips_a/content", { method: "GET", params: undefined });
  expect(wrapper.text()).toContain("10/20");
  expect(wrapper.get("li button span").classes()).toContain("truncate");
  await wrapper.get("li button").trigger("click");
  expect(mocks.showWorld).toHaveBeenCalledExactlyOnceWith("wrld_a");
  await disclosure.trigger("click");
  expect(wrapper.find("li").exists()).toBe(false);
  await disclosure.trigger("click");
  await flushPromises();
  expect(wrapper.text()).toContain("10/20");
  expect(mocks.request).toHaveBeenCalledTimes(2);
  wrapper.unmount();
});
