import { flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { ref } from "vue";
import { i18n } from "@/plugins/i18n";
import { queryClient } from "@/queries/client";
import AvatarAnalysisCard from "@/components/dialogs/AvatarDialog/AvatarAnalysisCard.vue";
import AvatarDialogBadges from "@/components/dialogs/AvatarDialog/AvatarDialogBadges.vue";
import GroupNextEvent from "@/components/dialogs/GroupDialog/GroupNextEvent.vue";
import UserSubscriptionStatus from "@/components/dialogs/UserDialog/UserSubscriptionStatus.vue";

const mocks = vi.hoisted(() => ({ request: vi.fn<(path: string, options: unknown) => Promise<unknown>>() }));
const avatarDialog = ref({ ref: { tags: [], unityPackages: [{ platform: "standalonewindows", scanStatus: "passed" }] }, hasImposter: true });
vi.mock("@/stores/avatar", () => ({ useAvatarStore: () => ({ avatarDialog }) }));
vi.mock("@/shared/utils/app-actions", () => ({ openFolderGeneric: vi.fn() }));
vi.mock("@/services/request", () => ({ request: mocks.request }));
vi.mock("@/stores/user", () => ({ useUserStore: vi.fn() }));
vi.mock("@/coordinators/date-coordinator", () => ({ formatDateFilter: (value: string) => value }));
vi.mock("@/views/Tools/components/GroupCalendarEventCard.vue", () => ({
  default: { props: ["event"], template: "<div>{{ event.title }}</div>" },
}));

const global = { plugins: [i18n] };

beforeEach(() => {
  queryClient.clear();
  mocks.request.mockReset();
});

afterEach(() => vi.useRealTimers());

test("reports valid analysis, including zero, and contains oversized numbers", () => {
  const wrapper = mount(AvatarAnalysisCard, {
    props: { platform: "standalonewindows", analysis: { avatarStats: { totalPolygons: 1e80, meshCount: 0, boneCount: "unknown", totalTextureUsage: 1024 } } },
    global,
  });
  expect(wrapper.text()).toContain("PC Stats");
  expect(wrapper.findAll("dd")).toHaveLength(3);
  expect(wrapper.get("dd").classes()).toContain("truncate");
  expect(wrapper.text()).toContain("1.00 KB");
  expect(wrapper.text()).toContain("Meshes");
  expect(wrapper.text()).not.toContain("Bones");
  wrapper.unmount();
});

test("shows scan warnings once and only for failed and unscanned packages", async () => {
  const wrapper = mount(AvatarDialogBadges, { global });
  expect(wrapper.text()).not.toContain("Scan Failed");
  expect(wrapper.text()).not.toContain("Unscanned");
  avatarDialog.value.ref.unityPackages = [
    { platform: "android", scanStatus: "unscanned" },
    { platform: "standalonewindows", scanStatus: "unscanned" },
    { platform: "standalonewindows", scanStatus: "failed" },
    { platform: "ios", scanStatus: "passed" },
  ];
  await wrapper.vm.$nextTick();
  expect(wrapper.text().match(/Scan Failed/g)).toHaveLength(1);
  expect(wrapper.text().match(/Unscanned/g)).toHaveLength(1);
  expect(wrapper.get('[title="PC · Scan Failed"]').find("svg").exists()).toBe(true);
  expect(wrapper.get('[title="Android · Unscanned"]').find("svg").exists()).toBe(true);
  expect(wrapper.find('[title^="iOS ·"]').exists()).toBe(false);
  wrapper.unmount();
});

test("loads the next event per open group and caches a group with no event", async () => {
  mocks.request.mockResolvedValueOnce({ id: "event", startsAt: "2099-12-31", title: "Next dance" }).mockResolvedValueOnce(null);
  const wrapper = mount(GroupNextEvent, { props: { groupId: "grp_first" }, global });
  await flushPromises();
  expect(wrapper.text()).toContain("Next dance");
  await wrapper.setProps({ groupId: "grp_empty" });
  await flushPromises();
  expect(wrapper.text()).toBe("");
  expect(mocks.request).toHaveBeenLastCalledWith("calendar/grp_empty/next", { method: "GET", isNotFoundEmpty: true });
  await wrapper.setProps({ groupId: "grp_first" });
  await flushPromises();
  expect(wrapper.text()).toContain("Next dance");
  await wrapper.setProps({ groupId: "grp_empty" });
  await flushPromises();
  expect(wrapper.text()).toBe("");
  expect(mocks.request).toHaveBeenCalledTimes(2);
  wrapper.unmount();
});

test("refreshes a cached event at its start only when the group is opened again", async () => {
  vi.useFakeTimers({ toFake: ["Date", "setTimeout", "clearTimeout"] });
  vi.setSystemTime(new Date("2026-11-20T10:00:00Z"));
  const props = { groupId: "grp_timed" };
  const first = { id: "first", title: "First dance", startsAt: "2026-11-20T10:01:00Z" };
  const second = { id: "second", title: "Second dance", startsAt: "2026-11-20T11:00:00Z" };
  mocks.request.mockResolvedValueOnce(first).mockResolvedValueOnce(second);
  const initial = mount(GroupNextEvent, { props, global });
  await flushPromises();
  expect(initial.text()).toContain(first.title);
  initial.unmount();
  vi.advanceTimersByTime(59_999);
  const early = mount(GroupNextEvent, { props, global });
  await flushPromises();
  expect(early.text()).toContain(first.title);
  vi.advanceTimersByTime(1);
  expect(mocks.request).toHaveBeenCalledTimes(1);
  early.unmount();
  const reopened = mount(GroupNextEvent, { props, global });
  await flushPromises();
  expect(reopened.text()).toContain(second.title);
  expect(mocks.request).toHaveBeenCalledTimes(2);
  reopened.unmount();
});

test("rechecks an empty group on open after ten minutes and never retries a started result in the same open", async () => {
  vi.useFakeTimers({ toFake: ["Date", "setTimeout", "clearTimeout"] });
  const props = { groupId: "grp_empty" };
  mocks.request.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: "old", startsAt: "2000-01-01" });
  const initial = mount(GroupNextEvent, { props, global });
  await flushPromises();
  vi.advanceTimersByTime(10 * 60_000);
  expect(mocks.request).toHaveBeenCalledTimes(1);
  initial.unmount();
  const reopened = mount(GroupNextEvent, { props, global });
  await flushPromises();
  expect(reopened.text()).toBe("");
  expect(mocks.request).toHaveBeenCalledTimes(2);
  reopened.unmount();
});

test("refreshes VRC+ once on each own-profile open", async () => {
  mocks.request.mockResolvedValueOnce([
    { id: "other-product", active: true, expires: "2099-12-31" },
    { id: "vrchatplus-monthly", active: false, expires: "2099-11-12" },
    { id: "vrchatplus-yearly", active: true, expires: "2099-09-01" },
  ]);
  mocks.request.mockResolvedValueOnce([{ id: "vrchatplus-monthly", active: false, expires: "2099-11-12" }]);
  const props = { userId: "usr_self", isSupporter: false };
  const wrapper = mount(UserSubscriptionStatus, { props, global });
  await flushPromises();
  expect(wrapper.text()).toContain("Active");
  expect(wrapper.get("time").attributes("datetime")).toBe("2099-09-01");
  wrapper.unmount();
  const reopened = mount(UserSubscriptionStatus, { props, global });
  await flushPromises();
  expect(reopened.text()).toContain("Expires");
  expect(reopened.text()).toContain("Inactive");
  expect(reopened.get("time").attributes("datetime")).toBe("2099-11-12");
  expect(mocks.request).toHaveBeenCalledTimes(2);
  expect(mocks.request).toHaveBeenLastCalledWith("auth/user/subscription", { method: "GET" });
  reopened.unmount();
});

test.each([
  [{}, "Renews"],
  [{ isGift: true }, "Expires"],
  [{ isBulkGift: true }, "Expires"],
  [{ store: "Admin" }, "Expires"],
  [{ active: false }, "Expires"],
  [{ status: "cancelled" }, "Expires"],
  [{ status: "failed" }, "Expires"],
  [{ period: "once" }, "Expires"],
  [{ active: false, expires: "2000-01-01" }, "Expired"],
])("labels the subscription date for %o", async (change, label) => {
  mocks.request.mockResolvedValueOnce([
    {
      id: "vrchatplus-monthly",
      active: true,
      status: "active",
      period: "month",
      store: "Steam",
      isGift: false,
      isBulkGift: false,
      expires: "2099-09-01",
      ...change,
    },
  ]);
  const wrapper = mount(UserSubscriptionStatus, { props: { userId: "usr_self", isSupporter: true }, global });
  await flushPromises();
  expect(wrapper.get("time").element.parentElement?.textContent).toContain(label);
  wrapper.unmount();
});
