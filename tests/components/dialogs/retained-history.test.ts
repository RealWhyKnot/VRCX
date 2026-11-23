import { flushPromises, mount } from "@vue/test-utils";
import { beforeEach, expect, test, vi } from "vitest";
import { ref } from "vue";
import { i18n } from "@/plugins/i18n";
import { queryClient } from "@/queries/client";
import AvatarImage from "@/components/ui/avatar/AvatarImage.vue";
import UserDialogHistoryTab from "@/components/dialogs/UserDialog/UserDialogHistoryTab.vue";
import RetainedHistoryTable from "@/components/history/RetainedHistoryTable.vue";
import BadgeEventLabel from "@/components/history/BadgeEventLabel.vue";
import FavoritesToolbar from "@/views/Favorites/components/FavoritesToolbar.vue";
import type { HistoryRow } from "@/services/database/retained-events";

const db = vi.hoisted(() => ({
  getPlayerAvatarHistory: vi.fn<() => Promise<HistoryRow[]>>(),
  getProfileHistory: vi.fn<() => Promise<HistoryRow[]>>(),
  getFriendPlatformHistory: vi.fn<() => Promise<HistoryRow[]>>(),
  getFavoriteHistory: vi.fn<() => Promise<HistoryRow[]>>(),
  getLatestBadgeById: vi.fn<() => Promise<HistoryRow | null>>(),
  getBadgeHistoryAt: vi.fn<() => Promise<HistoryRow[]>>(),
}));
vi.mock("@/services/database/retained-events", () => ({ retainedEvents: db }));
vi.mock("@/stores/settings/general", () => ({ useGeneralSettingsStore: () => ({ disableGpuAcceleration: ref(false) }) }));
vi.mock("@/stores/world", () => ({ useWorldStore: () => ({ cachedWorlds: new Map([["wrld_one", { name: "Sky Garden" }]]) }) }));
vi.mock("@/stores/user", () => ({
  useUserStore: () => ({
    currentUser: { id: "usr_me", badges: [] },
    applyUserLanguage: (snapshot: { tags: string[]; $languages: { key: string; value: string }[] }) => {
      snapshot.$languages = [
        { key: "eng", value: "English" },
        { key: "jpn", value: "Japanese" },
      ].filter(({ key }) => snapshot.tags.includes("language_" + key));
    },
  }),
}));
vi.mock("@/coordinators/date-coordinator", () => ({ formatDateFilter: (value: string) => value }));
const locationActions = vi.hoisted(() => ({ show: vi.fn(), worldName: vi.fn(), groupName: vi.fn() }));
vi.mock("@/coordinators/world-coordinator", () => ({ showWorldDialog: locationActions.show }));
vi.mock("@/shared/utils/world", () => ({ getWorldName: locationActions.worldName }));
vi.mock("@/shared/utils/group", () => ({ getGroupName: locationActions.groupName }));
vi.mock("@/stores/group", () => ({ useGroupStore: () => ({ cachedGroups: new Map() }) }));
vi.mock("@/stores/instance", () => ({ useInstanceStore: () => ({ cachedInstances: new Map(), lastInstanceApplied: ref(null) }) }));
vi.mock("@/stores/search", () => ({ useSearchStore: () => ({}) }));
vi.mock("@/stores/invite", () => ({ useInviteStore: () => ({}) }));
vi.mock("@/stores/settings/appearance", () => ({
  useAppearanceSettingsStore: () => ({ showInstanceIdInLocation: ref(true), isAgeGatedInstancesVisible: ref(true) }),
}));
const at = "2025-04-06T10:00:00Z";
const global = { plugins: [i18n], stubs: { TooltipWrapper: { template: "<div><slot /></div>" } } };
const row = (id: number, detail: string, data: unknown): HistoryRow => ({ id, detail, subject: "usr_a", data, createdAt: at });
beforeEach(() => {
  vi.resetAllMocks();
  queryClient.clear();
  const { getLatestBadgeById, ...lists } = db;
  for (const read of Object.values(lists)) read.mockResolvedValue([]);
  getLatestBadgeById.mockResolvedValue(null);
});

test("pages through avatar observations without skipping the lookahead row", async () => {
  const name = "W".repeat(1500);
  db.getPlayerAvatarHistory
    .mockResolvedValueOnce(
      Array.from({ length: 26 }, (_, i) => row(100 - i, "avatar", { avatarName: name, location: "wrld_one:12", thumbnailImageUrl: "thumb" }))
    )
    .mockResolvedValueOnce([row(75, "Last", {})]);
  const wrapper = mount(UserDialogHistoryTab, { props: { userId: "usr_a", isActive: true, isFriend: false }, global });
  await flushPromises();
  expect(wrapper.get('button[value="charts"]').attributes("data-state")).toBe("on");
  expect(db.getPlayerAvatarHistory).not.toHaveBeenCalled();
  await wrapper.get('button[value="avatar"]').trigger("click");
  await flushPromises();
  expect(db.getPlayerAvatarHistory).toHaveBeenCalledWith("usr_a", 26, null);
  expect(wrapper.findAll("tbody tr")).toHaveLength(25);
  expect(wrapper.getComponent(AvatarImage).props("src")).toBe("thumb");
  expect(wrapper.get('[title="' + name + '"]').classes()).toContain("truncate");
  expect(wrapper.text()).toContain("Sky Garden");
  expect(wrapper.get(".text-muted-foreground[title]").attributes("title")).toContain("wrld_one:12");
  expect(wrapper.text()).toContain("Public");
  expect(wrapper.text()).toContain("#12");
  await wrapper.get(".x-location").trigger("click");
  expect(locationActions.show).toHaveBeenCalledWith("wrld_one:12");
  expect(wrapper.text()).not.toContain("Platform");
  await wrapper.get("button:last-child:not([data-slot=toggle-group-item])").trigger("click");
  await flushPromises();
  expect(db.getPlayerAvatarHistory).toHaveBeenLastCalledWith("usr_a", 26, 76);
  expect(wrapper.text()).toContain("Last");
  expect(db.getProfileHistory).not.toHaveBeenCalled();
});

test("switches between observed profile fields and a friend's recorded platform", async () => {
  db.getProfileHistory.mockResolvedValue([
    row(3, "pronouns", "they/them"),
    row(2, "tags", ["language_eng", "language_jpn", "system_trust_known", "system_avatar_access", "language_unknown"]),
    row(1, "bio", ""),
  ]);
  db.getFriendPlatformHistory.mockResolvedValue([row(3, "Online", { platform: "android" }), row(2, "Offline", { platform: "ios" })]);
  const wrapper = mount(UserDialogHistoryTab, { props: { userId: "usr_a", isActive: true, isFriend: true }, global });
  await wrapper.get("button[value=profile]").trigger("click");
  await flushPromises();
  expect(wrapper.text()).toContain("they/them");
  expect(wrapper.text()).toContain("English (eng)");
  expect(wrapper.text()).toContain("Japanese (jpn)");
  expect(wrapper.find(".flags.jp").exists()).toBe(true);
  expect(wrapper.text()).toContain("User");
  expect(wrapper.text()).not.toMatch(/system_|language_/);
  expect(wrapper.text()).toContain("Cleared");
  await wrapper.get("button[value=platform]").trigger("click");
  await flushPromises();
  expect(wrapper.text()).toContain("Android");
  expect(wrapper.text()).toContain("Offline");
  expect(wrapper.text()).toContain("iOS");
  await wrapper.setProps({ isFriend: false });
  await flushPromises();
  expect(wrapper.find("button[value=platform]").exists()).toBe(false);
});

test("keeps the remaining profile tag names in the count tooltip at both badge limits", async () => {
  db.getProfileHistory.mockResolvedValue([row(1, "tags", ["system_trust_known", "admin_moderator", "language_eng", "language_jpn"])]);
  const wrapper = mount(RetainedHistoryTable, { props: { kind: "profile", userId: "usr_a" }, global });
  await flushPromises();
  expect(wrapper.get('[title="English (eng), Japanese (jpn)"]').text()).toBe("+2");
  expect(wrapper.get('[title="Japanese (jpn)"]').text()).toBe("+1");
  wrapper.unmount();
});

test("drops a late result after the user changes and retries a failed read", async () => {
  let finish: ((rows: HistoryRow[]) => void) | undefined;
  db.getPlayerAvatarHistory
    .mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve;
      })
    )
    .mockRejectedValueOnce(new Error("read failed"));
  const wrapper = mount(RetainedHistoryTable, { props: { kind: "avatar", userId: "usr_a" }, global });
  expect(wrapper.get("[aria-busy]").attributes("aria-busy")).toBe("true");
  await wrapper.setProps({ userId: "usr_b" });
  await flushPromises();
  finish?.([row(1, "Wrong person", {})]);
  await flushPromises();
  expect(wrapper.text()).not.toContain("Wrong person");
  expect(wrapper.get("[role=alert]").text()).toContain("Couldn't load this list.");
  await wrapper.get("[role=alert] button").trigger("click");
  await flushPromises();
  expect(wrapper.text()).toContain("No data");
  expect(db.getPlayerAvatarHistory).toHaveBeenLastCalledWith("usr_b", 26, null);
});

test("opens local and remote favorite changes from the favorites menu", async () => {
  db.getFavoriteHistory.mockResolvedValue([
    row(2, "world", { action: "add", name: "Harbor", group: "Weekend" }),
    row(1, "remote-avatar", { action: "remove", name: "Fox", group: "Group 1" }),
  ]);
  const wrapper = mount(FavoritesToolbar, { attachTo: document.body, props: { toolbarMenuOpen: true }, global });
  await flushPromises();
  expect(db.getFavoriteHistory).not.toHaveBeenCalled();
  const historyItem = Array.from(document.querySelectorAll<HTMLElement>('[role="menuitem"]')).find((item) => item.textContent.trim() === "Favorite History");
  expect(historyItem).toBeDefined();
  historyItem?.click();
  await vi.waitFor(() => expect(document.querySelector('[role="dialog"]')?.textContent).toContain("Added Harbor"));
  expect(db.getFavoriteHistory).toHaveBeenCalledOnce();
  const dialog = document.querySelector('[role="dialog"]');
  expect(dialog?.textContent).toContain("Removed Fox");
  expect(dialog?.textContent).toContain("Weekend");
  expect(dialog?.textContent).toContain("VRChat Favorites");
  wrapper.unmount();
});

test("matches a removed badge by the original event and shares reads across rows", async () => {
  db.getBadgeHistoryAt.mockResolvedValue([row(9, "bdg_1", { action: "remove", name: "Pioneer", description: "First season", imageUrl: "pioneer.png" })]);
  const props = { message: "Badge removed: bdg_1", at };
  const first = mount(BadgeEventLabel, { props, global });
  const other = mount(BadgeEventLabel, { props: { message: "Badge earned: bdg_other", at }, global });
  await vi.waitFor(() => expect(first.find("img").exists()).toBe(true));
  expect(db.getBadgeHistoryAt).toHaveBeenCalledTimes(1);
  expect(db.getBadgeHistoryAt).toHaveBeenCalledWith(at);
  expect(first.text()).toBe("Badge removed: Pioneer");
  expect(first.get("img").attributes("src")).toBe("pioneer.png");
  expect(first.attributes("title")).toContain("First season");
  expect(other.text()).toBe("Badge earned: bdg_other");
  expect(other.find("img").exists()).toBe(false);
});

test("displays badge notifications directly when their data includes the image", async () => {
  const name = "Badge ".repeat(300);
  const wrapper = mount(BadgeEventLabel, {
    props: { message: "Badge earned", data: { badgeId: "bdg_1", badgeName: name, badgeDescription: "Award", badgeImageUrl: "badge.png" } },
    global,
  });
  await flushPromises();
  expect(db.getLatestBadgeById).not.toHaveBeenCalled();
  expect(db.getBadgeHistoryAt).not.toHaveBeenCalled();
  expect(wrapper.get("img").attributes("src")).toBe("badge.png");
  expect(wrapper.get(".truncate").element.textContent).toBe(name);
});

test("looks a badge up by id and keeps the message when none is stored", async () => {
  db.getLatestBadgeById.mockResolvedValueOnce(row(7, "bdg_new", { name: "Veteran", imageUrl: "old.png" })).mockResolvedValueOnce(null);
  const found = mount(BadgeEventLabel, { props: { message: "Badge earned", data: { badgeId: "bdg_new" } }, global });
  await vi.waitFor(() => expect(found.find("img").attributes("src")).toBe("old.png"));
  const missing = mount(BadgeEventLabel, { props: { message: "Badge earned", data: { badgeId: "bdg_none" } }, global });
  await flushPromises();
  expect(db.getLatestBadgeById).toHaveBeenCalledWith("bdg_new");
  expect(db.getLatestBadgeById).toHaveBeenCalledWith("bdg_none");
  expect(missing.text()).toBe("Badge earned");
  expect(missing.find("img").exists()).toBe(false);
  found.unmount();
  missing.unmount();
});

test("ignores a badge lookup that finishes after the row changes", async () => {
  let finish: ((value: HistoryRow | null) => void) | undefined;
  db.getLatestBadgeById.mockImplementationOnce(() => new Promise((resolve) => (finish = resolve)));
  const wrapper = mount(BadgeEventLabel, { props: { message: "Badge earned", data: { badgeId: "bdg_slow" } }, global });
  await flushPromises();
  await wrapper.setProps({ data: { badgeId: "bdg_slow", badgeName: "Direct", badgeImageUrl: "direct.png" } });
  finish?.(row(1, "bdg_slow", { name: "Late", imageUrl: "late.png" }));
  await flushPromises();
  expect(wrapper.text()).toBe("Direct");
  expect(wrapper.get("img").attributes("src")).toBe("direct.png");
  wrapper.unmount();
});

test("keeps an uncached historical group location clickable without looking up names for the rows", async () => {
  const location = "wrld_missing:42~group(grp_missing)~groupAccessType(public)";
  db.getPlayerAvatarHistory.mockResolvedValue([row(1, "Fox", { location })]);
  const wrapper = mount(RetainedHistoryTable, { props: { kind: "avatar", userId: "usr_a" }, global });
  await flushPromises();
  await wrapper.get(".x-location").trigger("click");
  expect(locationActions.show).toHaveBeenCalledWith(location);
  expect(locationActions.worldName).not.toHaveBeenCalled();
  expect(locationActions.groupName).not.toHaveBeenCalled();
  wrapper.unmount();
});

test("remembers the Activity selection on return and resets it for a different user", async () => {
  const wrapper = mount(UserDialogHistoryTab, {
    props: { userId: "usr_a", isFriend: true, isActive: true },
    attachTo: document.body,
    slots: { default: "<div data-chart>Activity charts</div>" },
    global,
  });
  expect(wrapper.get("[data-chart]").isVisible()).toBe(true);
  expect(db.getPlayerAvatarHistory).not.toHaveBeenCalled();
  await wrapper.get('button[value="profile"]').trigger("click");
  expect(wrapper.get("[data-chart]").element.parentElement?.style.display).toBe("none");
  await wrapper.setProps({ isActive: false });
  expect(wrapper.findComponent(RetainedHistoryTable).exists()).toBe(false);
  await wrapper.setProps({ isActive: true });
  expect(wrapper.get('button[value="profile"]').attributes("data-state")).toBe("on");
  expect(db.getProfileHistory).toHaveBeenLastCalledWith("usr_a", 26, null);
  await wrapper.setProps({ userId: "usr_b" });
  expect(wrapper.get("[data-chart]").isVisible()).toBe(true);
  expect(db.getProfileHistory).toHaveBeenCalledTimes(2);
  expect(db.getPlayerAvatarHistory).not.toHaveBeenCalled();
  wrapper.unmount();
});

test("uses the newest matching badge metadata even when its image is missing", async () => {
  db.getLatestBadgeById.mockResolvedValueOnce(row(500, "bdg_one", { name: "Pioneer", description: "Updated description" }));
  const wrapper = mount(BadgeEventLabel, { props: { message: "Badge earned", data: { badgeId: "bdg_one" } }, global });
  await vi.waitFor(() => expect(wrapper.text()).toBe("Pioneer"));
  expect(wrapper.attributes("title")).toContain("Updated description");
  expect(wrapper.find("img").exists()).toBe(false);
  expect(db.getLatestBadgeById).toHaveBeenCalledOnce();
  wrapper.unmount();
});

test("keeps all four Activity choices and the full timestamp with an oversized platform name", async () => {
  const platform = "new-platform".repeat(300);
  db.getFriendPlatformHistory.mockResolvedValue([row(1, "Offline", { platform })]);
  const wrapper = mount(UserDialogHistoryTab, { props: { userId: "usr_a", isFriend: true, isActive: true }, global });
  const group = wrapper.get('[data-slot="toggle-group"]');
  expect(group.classes()).toContain("flex-nowrap");
  const choices = group.findAll("button");
  expect(choices.map((button) => button.text())).toEqual(["Charts", "Avatars", "Profile", "Platform"]);
  await wrapper.get('button[value="platform"]').trigger("click");
  await flushPromises();
  const time = wrapper.get("time");
  expect(time.text()).toBe(at);
  expect(time.attributes("datetime")).toBe(at);
  expect(time.classes()).toContain("whitespace-normal");
  expect(wrapper.get("tbody td:nth-child(2) .truncate").attributes("title")).toBe(platform);
  wrapper.unmount();
});
