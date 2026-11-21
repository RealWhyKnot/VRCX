import { computed, ref, shallowRef, watch } from "vue";
import { defineStore } from "pinia";
import { useRouter } from "vue-router";
import { useDashboardStore } from "./dashboard";

import { database } from "../services/database";
import type { FeedRow } from "../services/database/feed";
import { logFailure } from "./log-failure";
import { useFriendStore } from "./friend";
import { useVrcxStore } from "./vrcx";
import { watchState } from "../services/watch-state";
import { prefetchAfterFriendsLoaded } from "../services/friends-idle";

import { configRepository } from "../services/config";

type FeedTableState = {
  search: string;
  dateFrom: string;
  dateTo: string;
  vip: boolean;
  loading: boolean;
  filter: string[];
  pageSize: number;
  pageSizeLinked: boolean;
};

function toFilterList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const items: unknown[] = value;
  return items.filter((item): item is string => typeof item === "string");
}

function containsFeedSearchValue(text: string | null | undefined, value: string): boolean {
  return String(text).toUpperCase().includes(value);
}

function feedSearch(row: FeedRow, search: string): boolean {
  const value = search.trim().toUpperCase();
  if (!value) {
    return true;
  }
  if (value.startsWith("wrld_") || value.startsWith("grp_")) {
    if ("location" in row && containsFeedSearchValue(row.location, value)) {
      return true;
    }
  }
  switch (row.type) {
    case "GPS":
    case "Online":
    case "Offline":
      return containsFeedSearchValue(row.displayName, value) || containsFeedSearchValue(row.worldName, value);
    case "Status":
      return (
        containsFeedSearchValue(row.displayName, value) || containsFeedSearchValue(row.status, value) || containsFeedSearchValue(row.statusDescription, value)
      );
    case "Avatar":
      return containsFeedSearchValue(row.displayName, value) || containsFeedSearchValue(row.avatarName, value);
    case "Bio":
      return (
        containsFeedSearchValue(row.displayName, value) ||
        containsFeedSearchValue(row.bio, value) ||
        containsFeedSearchValue(row.previousBio, value) ||
        row.bioLinks.some((link) => String(link).toUpperCase().includes(value))
      );
  }
}

export const useFeedStore = defineStore("Feed", () => {
  const friendStore = useFriendStore();
  const vrcxStore = useVrcxStore();
  const dashboardStore = useDashboardStore();
  const router = useRouter();
  let lookupVersion = 0;
  let liveVersion = 0;
  let loadedQuery: string | null = null;
  let pendingLookup: { key: string; promise: Promise<void> } | null = null;
  const isFeedVisible = computed(() => {
    const route = router.currentRoute.value;
    const id = route.params["id"];
    return (
      route.name === "feed" ||
      (route.name === "dashboard" && typeof id === "string" && !!(dashboardStore.getDashboard(id, "feed") ?? dashboardStore.getDashboard(id, "widget:feed")))
    );
  });

  const feedTableData = shallowRef<FeedRow[]>([]);
  const feedTable = ref<FeedTableState>({
    search: "",
    dateFrom: "",
    dateTo: "",
    vip: false,
    loading: false,
    filter: [],
    pageSize: 20,
    pageSizeLinked: true,
  });

  watch(
    () => watchState.isFavoritesLoaded,
    (isFavoritesLoaded) => {
      if (isFavoritesLoaded && feedTable.value.vip && (isFeedVisible.value || loadedQuery !== null)) {
        initFeedTable().catch(logFailure("Failed to look up feed table:"));
      }
    }
  );

  async function init() {
    const parsedFilters: unknown = JSON.parse(await configRepository.getString("VRCX_feedTableFilters", "[]"));
    feedTable.value.filter = toFilterList(parsedFilters);
    feedTable.value.vip = await configRepository.getBool("VRCX_feedTableVIPFilter", false);
  }

  const filtersReady = init().catch(logFailure("Failed to load feed table filters:"));

  watch(
    () => watchState.isLoggedIn,
    () => {
      lookupVersion += 1;
      loadedQuery = null;
      pendingLookup = null;
      feedTableData.value = [];
      feedTable.value.loading = false;
    },
    { flush: "sync", immediate: true }
  );

  watch(
    [() => watchState.isLoggedIn, isFeedVisible],
    ([isLoggedIn, isVisible]) => {
      if (isLoggedIn && isVisible) {
        initFeedTable().catch(logFailure("Failed to load feed table:"));
      }
    },
    { immediate: true }
  );

  prefetchAfterFriendsLoaded(initFeedTable, logFailure("Failed to load feed table:"));

  async function feedTableLookup() {
    await configRepository.setString("VRCX_feedTableFilters", JSON.stringify(feedTable.value.filter));
    await configRepository.setBool("VRCX_feedTableVIPFilter", feedTable.value.vip);
    if (!isFeedVisible.value || !watchState.isLoggedIn) {
      return;
    }
    await readFeedTable(true);
  }

  async function readFeedTable(shouldRefresh: boolean) {
    await filtersReady;
    if (!watchState.isLoggedIn) return;
    const filters = [...feedTable.value.filter];
    const vipList = feedTable.value.vip ? Array.from(friendStore.localFavoriteFriends.values()) : [];
    const search = feedTable.value.search.trim();
    const { dateFrom, dateTo } = feedTable.value;
    const key = JSON.stringify([filters, feedTable.value.vip, vipList, search, dateFrom, dateTo, vrcxStore.searchLimit]);
    if (pendingLookup?.key === key) return pendingLookup.promise;
    if (!shouldRefresh && loadedQuery === key) return;
    const version = ++lookupVersion;
    const beforeLive = liveVersion;
    feedTable.value.loading = true;
    const promise = Promise.resolve()
      .then(async () => {
        if (version !== lookupVersion) return;
        const rows =
          search || dateFrom || dateTo
            ? await database.searchFeedDatabase(search, filters, vipList, vrcxStore.searchLimit, dateFrom, dateTo)
            : await database.lookupFeedDatabase(filters, vipList);
        if (version === lookupVersion) {
          if (liveVersion !== beforeLive) {
            const live = feedTableData.value;
            const keys = new Set(live.map((row) => `${row.type}:${row.rowId}`));
            feedTableData.value = [...live, ...rows.filter((row) => !keys.has(`${row.type}:${row.rowId}`))]
              .sort((left, right) => String(right.created_at).localeCompare(String(left.created_at)) || (right.rowId ?? 0) - (left.rowId ?? 0))
              .slice(0, vrcxStore.maxTableSize);
          } else {
            feedTableData.value = rows;
          }
          loadedQuery = key;
        }
      })
      .finally(() => {
        if (version === lookupVersion) {
          pendingLookup = null;
          feedTable.value.loading = false;
        }
      });
    pendingLookup = { key, promise };
    await promise;
  }

  function addFeedEntry(feed: FeedRow) {
    if (!watchState.isLoggedIn || (!isFeedVisible.value && loadedQuery === null && pendingLookup === null)) {
      return;
    }
    liveVersion += 1;
    if (feedTable.value.filter.length > 0 && !feedTable.value.filter.includes(feed.type)) {
      return;
    }
    if (feedTable.value.vip && (feed.userId === null || !friendStore.localFavoriteFriends.has(feed.userId))) {
      return;
    }
    if (!feedSearch(feed, feedTable.value.search)) {
      return;
    }
    if (feedTable.value.dateFrom && feed.created_at !== null && feed.created_at < feedTable.value.dateFrom) {
      return;
    }
    if (feedTable.value.dateTo && feed.created_at !== null && feed.created_at > feedTable.value.dateTo) {
      return;
    }
    feedTableData.value = [feed, ...feedTableData.value];
    sweepFeed();
  }

  function sweepFeed() {
    const j = feedTableData.value.length;
    if (j > vrcxStore.maxTableSize + 50) {
      feedTableData.value = feedTableData.value.slice(0, -50);
    }
  }

  async function initFeedTable() {
    await readFeedTable(false);
  }

  return {
    feedTable,
    feedTableData,
    initFeedTable,
    feedTableLookup,
    addFeedEntry,
  };
});
