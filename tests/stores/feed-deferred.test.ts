import { createPinia, disposePinia, setActivePinia } from "pinia";
import { nextTick, reactive, ref } from "vue";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  lookup: vi.fn<(...args: unknown[]) => Promise<unknown[]>>(),
  search: vi.fn<(...args: unknown[]) => Promise<unknown[]>>(),
}));
const route = ref<{ name: string; params: { id?: string } }>({ name: "friend-list", params: {} });
const login = reactive({ isLoggedIn: false, isFavoritesLoaded: false, isFriendsLoaded: false });
let idleCallbacks: IdleRequestCallback[];
const panels = reactive(new Set<string>());
vi.mock("vue-router", () => ({ useRouter: () => ({ currentRoute: route }) }));
vi.mock("../../src/services/watch-state", () => ({ watchState: login }));
vi.mock("../../src/stores/friend", () => ({ useFriendStore: () => ({ localFavoriteFriends: new Set<string>() }) }));
vi.mock("../../src/stores/vrcx", () => ({ useVrcxStore: () => ({ maxTableSize: 500, searchLimit: 5000 }) }));
vi.mock("../../src/stores/dashboard", () => ({
  useDashboardStore: () => ({ getDashboard: (_id: string, panel: string) => (panels.has(panel) ? { panels: [] } : undefined) }),
}));
vi.mock("../../src/services/database", () => ({ database: { lookupFeedDatabase: mocks.lookup, searchFeedDatabase: mocks.search } }));
vi.mock("../../src/services/config", () => ({
  configRepository: {
    getString: () => Promise.resolve("[]"),
    getBool: () => Promise.resolve(false),
    setString: () => Promise.resolve(),
    setBool: () => Promise.resolve(),
  },
}));

const { useFeedStore } = await import("../../src/stores/feed");
const row = {
  rowId: 1,
  created_at: "2026-11-20T01:00:00Z",
  type: "Online" as const,
  userId: "usr_one",
  displayName: "One",
  location: null,
  worldName: null,
  time: null,
  groupName: null,
};

let pinia: ReturnType<typeof createPinia>;
afterEach(() => {
  disposePinia(pinia);
  vi.unstubAllGlobals();
});

beforeEach(() => {
  login.isLoggedIn = false;
  login.isFriendsLoaded = false;
  login.isFavoritesLoaded = false;
  idleCallbacks = [];
  vi.stubGlobal(
    "requestIdleCallback",
    vi.fn((callback: IdleRequestCallback) => idleCallbacks.push(callback))
  );
  vi.stubGlobal("cancelIdleCallback", vi.fn());
  panels.clear();
  route.value = { name: "friend-list", params: {} };
  pinia = createPinia();
  setActivePinia(pinia);
  mocks.lookup.mockReset().mockResolvedValue([row]);
  mocks.search.mockReset().mockResolvedValue([]);
});

test("loads on the Feed route and feed dashboards, and settings changes stay lazy", async () => {
  const store = useFeedStore();
  login.isLoggedIn = true;
  await nextTick();
  await store.feedTableLookup();
  expect(mocks.lookup).not.toHaveBeenCalled();
  route.value = { name: "feed", params: {} };
  await vi.waitFor(() => expect(store.feedTableData).toEqual([row]));
  expect(mocks.lookup).toHaveBeenCalledTimes(1);

  route.value = { name: "dashboard", params: { id: "board" } };
  await nextTick();
  expect(store.feedTableData).toEqual([row]);
  panels.add("widget:feed");
  await nextTick();
  expect(mocks.lookup).toHaveBeenCalledTimes(1);
});

test("prefetches once after friends and idle, retaining hidden live rows for first open", async () => {
  const store = useFeedStore();
  login.isLoggedIn = true;
  await nextTick();
  expect(idleCallbacks).toHaveLength(0);
  expect(mocks.lookup).not.toHaveBeenCalled();
  login.isFriendsLoaded = true;
  await nextTick();
  expect(mocks.lookup).not.toHaveBeenCalled();
  idleCallbacks[0]?.({ didTimeout: false, timeRemaining: () => 50 });
  await vi.waitFor(() => expect(store.feedTableData).toEqual([row]));
  const live = { ...row, rowId: 2 };
  store.addFeedEntry(live);
  route.value = { name: "feed", params: {} };
  await nextTick();
  await store.initFeedTable();
  expect(store.feedTableData).toEqual([live, row]);
  expect(mocks.lookup).toHaveBeenCalledTimes(1);
});

test("opening during prefetch shares its read and changed filters get fresh rows", async () => {
  const store = useFeedStore();
  const pending = Promise.withResolvers<unknown[]>();
  mocks.lookup.mockReturnValueOnce(pending.promise);
  login.isLoggedIn = true;
  login.isFriendsLoaded = true;
  await nextTick();
  idleCallbacks[0]?.({ didTimeout: false, timeRemaining: () => 50 });
  await vi.waitFor(() => expect(mocks.lookup).toHaveBeenCalledTimes(1));
  route.value = { name: "feed", params: {} };
  const open = store.initFeedTable();
  pending.resolve([row]);
  await open;
  expect(mocks.lookup).toHaveBeenCalledTimes(1);
  expect(store.feedTableData).toEqual([row]);
  store.feedTable.search = "changed";
  await store.initFeedTable();
  expect(mocks.search).toHaveBeenCalledTimes(1);
});

test("a failed prefetch retries on open", async () => {
  const store = useFeedStore();
  login.isLoggedIn = true;
  mocks.lookup.mockRejectedValueOnce(new Error("read failed"));
  await expect(store.initFeedTable()).rejects.toThrow("read failed");
  route.value = { name: "feed", params: {} };
  await vi.waitFor(() => expect(store.feedTableData).toEqual([row]));
  expect(mocks.lookup).toHaveBeenCalledTimes(2);
});

test("keeps live entries during a lookup and discards an old account's result", async () => {
  const store = useFeedStore();
  const { promise, resolve } = Promise.withResolvers<unknown[]>();
  mocks.lookup.mockReturnValueOnce(promise);
  login.isLoggedIn = true;
  route.value = { name: "feed", params: {} };
  await vi.waitFor(() => expect(mocks.lookup).toHaveBeenCalledOnce());
  const live = { ...row, rowId: 2, created_at: "2026-11-20T02:00:00Z" };
  store.addFeedEntry(live);
  resolve([row]);
  await vi.waitFor(() => expect(store.feedTableData).toEqual([live, row]));

  const pending = Promise.withResolvers<unknown[]>();
  mocks.lookup.mockReturnValueOnce(pending.promise);
  const load = store.feedTableLookup();
  await vi.waitFor(() => expect(mocks.lookup).toHaveBeenCalledTimes(2));
  login.isLoggedIn = false;
  pending.resolve([row]);
  await load;
  expect(store.feedTableData).toEqual([]);
  expect(store.feedTable.loading).toBe(false);
});
