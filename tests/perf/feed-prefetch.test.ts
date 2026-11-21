import { readFileSync, writeFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { createPinia, disposePinia, setActivePinia } from "pinia";
import { nextTick, reactive, ref } from "vue";
import { expect, test, vi } from "vitest";
import { mainPrefix } from "../../build-scripts/perf-database";

const mocks = vi.hoisted(() => ({ rows: vi.fn<() => Promise<unknown[][]>>() }));
const state = reactive({ isLoggedIn: false, isFriendsLoaded: false, isFavoritesLoaded: false });
const route = ref({ name: "friend-list", params: {} });
vi.mock("vue-router", () => ({ useRouter: () => ({ currentRoute: route }) }));
vi.mock("../../src/services/watch-state", () => ({ watchState: state }));
vi.mock("../../src/stores/friend", () => ({ useFriendStore: () => ({ localFavoriteFriends: new Set<string>() }) }));
vi.mock("../../src/stores/vrcx", () => ({ useVrcxStore: () => ({ maxTableSize: 500, searchLimit: 5000 }) }));
vi.mock("../../src/stores/dashboard", () => ({ useDashboardStore: () => ({ getDashboard: () => undefined }) }));
vi.mock("../../src/services/sqlite.ts", () => ({ sqliteService: { rows: mocks.rows } }));
vi.mock("../../src/services/database", () => ({
  dbVars: { maxTableSize: 500 },
  database: {
    async lookupFeedDatabase(filters: string[], vipList: string[]) {
      return (await import("../../src/services/database/feed")).feed.lookupFeedDatabase(filters, vipList);
    },
  },
}));
vi.mock("../../src/services/config", () => ({
  configRepository: {
    getString: () => Promise.resolve("[]"),
    getBool: () => Promise.resolve(false),
  },
}));
const { useFeedStore } = await import("../../src/stores/feed");
const databasePath = process.env["VRCX_PERF_DATABASE"];

test.runIf(databasePath !== undefined)("measures first Feed open after idle against the database copy", async () => {
  if (!databasePath?.startsWith("/tmp/vrcx-perf/")) throw new Error("Use a scratch database copy");
  using db = new DatabaseSync(databasePath, { readOnly: true });
  const prefix = mainPrefix(db);
  if (!prefix) throw new Error("Missing account tables");
  const source = readFileSync("src/VRCX-Shared/Database/DatabaseApi.Feed.Search.cs", "utf8");
  function columns(name: string): string {
    const value = new RegExp(`const string ${name} = "([^"]+)"`, "u").exec(source)?.[1];
    if (!value) throw new Error("Missing feed columns");
    return value;
  }
  const parts = [
    ["FeedGpsColumns", "feed_gps"],
    ["FeedStatusColumns", "feed_status"],
    ["FeedBioColumns", "feed_bio"],
    ["FeedAvatarColumns", "feed_avatar"],
    ["FeedOnlineOfflineColumns", "feed_online_offline"],
  ].map(([name, suffix]) => {
    if (!name || !suffix) throw new Error("Missing feed source");
    return `SELECT * FROM (SELECT ${columns(name)} FROM ${prefix}_${suffix} WHERE 1=1 ORDER BY id DESC LIMIT 500)`;
  });
  const query = db.prepare(`SELECT ${columns("FeedBaseColumns")} FROM (${parts.join(" UNION ALL ")}) ORDER BY created_at DESC, id DESC LIMIT 500`);
  query.setReturnArrays(true);
  const prefetch: number[] = [];
  const open: number[] = [];
  const rows: number[] = [];
  try {
    vi.stubGlobal("DatabaseApi", { LookupFeed: () => Promise.resolve("[]") });
    vi.stubGlobal("cancelIdleCallback", vi.fn());
    for (let run = 0; run < 12; run += 1) {
      const pinia = createPinia();
      setActivePinia(pinia);
      const callbacks: IdleRequestCallback[] = [];
      vi.stubGlobal(
        "requestIdleCallback",
        vi.fn((callback: IdleRequestCallback) => callbacks.push(callback))
      );
      state.isLoggedIn = false;
      state.isFriendsLoaded = false;
      route.value = { name: "friend-list", params: {} };
      mocks.rows.mockReset().mockImplementation(() =>
        Promise.resolve(
          query.all().map((row: unknown) => {
            if (!Array.isArray(row)) throw new Error("Invalid database row");
            return Array.from<unknown>(row);
          })
        )
      );
      try {
        const store = useFeedStore();
        state.isLoggedIn = true;
        await nextTick();
        expect(mocks.rows).not.toHaveBeenCalled();
        state.isFriendsLoaded = true;
        await nextTick();
        const start = performance.now();
        callbacks[0]?.({ didTimeout: false, timeRemaining: () => 50 });
        await store.initFeedTable();
        prefetch.push(performance.now() - start);
        expect(mocks.rows).toHaveBeenCalledTimes(1);
        const at = performance.now();
        route.value = { name: "feed", params: {} };
        await nextTick();
        await store.initFeedTable();
        open.push(performance.now() - at);
        expect(mocks.rows).toHaveBeenCalledTimes(1);
        expect(store.feedTableData).toHaveLength(500);
        rows.push(store.feedTableData.length);
      } finally {
        disposePinia(pinia);
      }
    }
    const output = process.env["VRCX_PERF_OUTPUT"];
    if (output?.startsWith("/tmp/vrcx-perf/")) {
      writeFileSync(output, JSON.stringify({ prefetch, open, rows, openDatabaseReads: 0 }, null, 2));
    }
  } finally {
    vi.unstubAllGlobals();
  }
});
