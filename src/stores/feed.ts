import { ref, shallowRef, watch } from "vue";
import { defineStore } from "pinia";

import { database } from "../services/database";
import type { FeedRow } from "../services/database/feed";
import { logFailure } from "./log-failure";
import { useFriendStore } from "./friend";
import { useVrcxStore } from "./vrcx";
import { watchState } from "../services/watch-state";

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
    () => watchState.isLoggedIn,
    (isLoggedIn) => {
      feedTableData.value = [];
      if (isLoggedIn) {
        initFeedTable().catch(logFailure("Failed to load feed table:"));
      }
    },
    { flush: "sync" }
  );

  watch(
    () => watchState.isFavoritesLoaded,
    (isFavoritesLoaded) => {
      if (isFavoritesLoaded && feedTable.value.vip) {
        feedTableLookup().catch(logFailure("Failed to look up feed table:"));
      }
    }
  );

  async function init() {
    const parsedFilters: unknown = JSON.parse(await configRepository.getString("VRCX_feedTableFilters", "[]"));
    feedTable.value.filter = toFilterList(parsedFilters);
    feedTable.value.vip = await configRepository.getBool("VRCX_feedTableVIPFilter", false);
  }

  init().catch(logFailure("Failed to load feed table filters:"));

  async function feedTableLookup() {
    await configRepository.setString("VRCX_feedTableFilters", JSON.stringify(feedTable.value.filter));
    await configRepository.setBool("VRCX_feedTableVIPFilter", feedTable.value.vip);
    feedTable.value.loading = true;
    try {
      let vipList: string[] = [];
      if (feedTable.value.vip) {
        vipList = Array.from(friendStore.localFavoriteFriends.values());
      }
      const search = feedTable.value.search.trim();
      const { dateFrom, dateTo } = feedTable.value;
      const rows =
        search || dateFrom || dateTo
          ? await database.searchFeedDatabase(search, feedTable.value.filter, vipList, vrcxStore.searchLimit, dateFrom, dateTo)
          : await database.lookupFeedDatabase(feedTable.value.filter, vipList);
      feedTableData.value = [];
      feedTableData.value = [...feedTableData.value, ...rows];
    } finally {
      feedTable.value.loading = false;
    }
  }

  function addFeedEntry(feed: FeedRow) {
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
    feedTable.value.loading = true;
    await feedTableLookup();
    feedTable.value.loading = false;
  }

  return {
    feedTable,
    feedTableData,
    initFeedTable,
    feedTableLookup,
    addFeedEntry,
  };
});
