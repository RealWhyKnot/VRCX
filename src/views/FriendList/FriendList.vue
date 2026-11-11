<template>
  <div class="x-container x-container-auto-height">
    <div class="flex-1 min-h-0 flex flex-col">
      <DataTableLayout
        class="min-w-0 w-full"
        :table="table"
        :loading="friendsListLoading"
        auto-height
        :page-sizes="pageSizes"
        :total-items="totalItems"
        table-class="min-w-max w-max [&_tbody_tr]:cursor-pointer"
        :on-page-size-change="handlePageSizeChange"
        :on-row-click="handleRowClick"
      >
        <template #toolbar>
          <div class="mb-2 flex items-center justify-between">
            <div class="flex flex-none mr-2 items-center">
              <TooltipWrapper side="bottom" :content="t('view.friend_list.favorites_only_tooltip')">
                <div>
                  <Toggle
                    variant="outline"
                    size="sm"
                    :model-value="friendsListSearchFilterVIP"
                    :aria-label="t('view.friend_list.favorites_only_tooltip')"
                    @update:model-value="
                      (v) => {
                        friendsListSearchFilterVIP = v;
                        friendsListSearchChange();
                      }
                    "
                  >
                    <Star v-if="friendsListSearchFilterVIP" fill="currentColor" />
                    <Star v-else />
                  </Toggle>
                </div>
              </TooltipWrapper>
              <Select
                multiple
                :model-value="Array.isArray(friendsListSearchFilters) ? friendsListSearchFilters : []"
                @update:model-value="handleFriendListFilterChange"
              >
                <SelectTrigger class="mx-2 w-37.5">
                  <SelectValue :placeholder="t('view.friend_list.filter_placeholder')" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem v-for="type in ['Display Name', 'User Name', 'Rank', 'Status', 'Bio', 'Note', 'Memo']" :key="type" :value="type">
                      {{ type }}
                    </SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
              <InputGroupField
                v-model="friendsListSearch"
                :placeholder="t('view.friend_list.search_placeholder')"
                clearable
                class="w-[250px]"
                @input="scheduleFriendsListSearchChange"
                @change="friendsListSearchChange"
              />
            </div>
            <div class="flex items-center">
              <div v-if="friendsListBulkUnfriendMode" class="inline-block mr-2">
                <Button variant="outline" @click="showBulkUnfriendSelectionConfirm">
                  {{ t("view.friend_list.bulk_unfriend_selection") }}
                </Button>
              </div>
              <div class="flex items-center mr-2">
                <span class="name mr-2 text-xs">{{ t("view.friend_list.bulk_unfriend") }}</span>
                <Switch
                  v-model="friendsListBulkUnfriendMode"
                  :aria-label="t('view.friend_list.bulk_unfriend')"
                  @update:model-value="toggleFriendsListBulkUnfriendMode"
                />
              </div>
              <div class="flex items-center">
                <TooltipWrapper v-if="isMutualFetching" :content="t('view.friend_list.mutual_loading_hint')">
                  <span>
                    <Button variant="outline" class="mr-2" disabled>
                      <Loader2 class="h-4 w-4 animate-spin" />
                      {{ t("view.friend_list.load_mutual_friends") }}
                    </Button>
                  </span>
                </TooltipWrapper>
                <Button v-else variant="outline" class="mr-2" :disabled="isMutualOptOut" @click="loadMutualFriends">
                  {{ t("view.friend_list.load_mutual_friends") }}
                </Button>

                <Button variant="outline" @click="friendsListLoadUsers">{{ t("view.friend_list.load") }}</Button>
              </div>
            </div>
          </div>
        </template>
      </DataTableLayout>
      <Dialog v-model:open="friendsListLoadDialogVisible">
        <DialogContent :show-close-button="false" class="sm:max-w-[420px]" @interact-outside.prevent @escape-key-down.prevent>
          <DialogHeader>
            <DialogTitle>{{ t("view.friend_list.load_dialog_title") }}</DialogTitle>
          </DialogHeader>
          <div class="mb-2" v-text="t('view.friend_list.load_dialog_message')"></div>
          <div class="flex items-center gap-2">
            <Progress :model-value="friendsListLoadingPercent" class="h-4 w-full" />
            <span class="text-xs w-10 text-right">{{ friendsListLoadingPercent }}%</span>
          </div>
          <div class="mt-2 text-right">
            <span>{{ friendsListLoadingCurrent }} / {{ friendsListLoadingTotal }}</span>
          </div>
          <DialogFooter>
            <Button variant="secondary" @click="cancelFriendsListLoad">
              {{ t("view.friend_list.load_cancel") }}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  </div>
</template>

<script setup lang="ts">
import Select from "@/components/ui/select/Select.vue";
import SelectContent from "@/components/ui/select/SelectContent.vue";
import SelectGroup from "@/components/ui/select/SelectGroup.vue";
import SelectItem from "@/components/ui/select/SelectItem.vue";
import SelectTrigger from "@/components/ui/select/SelectTrigger.vue";
import SelectValue from "@/components/ui/select/SelectValue.vue";
import Dialog from "@/components/ui/dialog/Dialog.vue";
import DialogContent from "@/components/ui/dialog/DialogContent.vue";
import DialogFooter from "@/components/ui/dialog/DialogFooter.vue";
import DialogHeader from "@/components/ui/dialog/DialogHeader.vue";
import DialogTitle from "@/components/ui/dialog/DialogTitle.vue";
import { computed, nextTick, onBeforeUnmount, ref, shallowRef, watch } from "vue";
import Button from "@/components/ui/button/Button.vue";
import InputGroupField from "@/components/ui/input-group/InputGroupField.vue";
import Progress from "@/components/ui/progress/Progress.vue";
import { Loader2, Star } from "lucide-vue-next";
import { storeToRefs } from "pinia";
import { toast } from "vue-sonner";
import { useI18n } from "vue-i18n";
import { useRoute } from "vue-router";

import { useAppearanceSettingsStore } from "../../stores/settings/appearance";
import { useChartsStore } from "../../stores/charts";
import { useFriendStore } from "../../stores/friend";
import type { FriendContext } from "../../stores/friend-types";
import { useModalStore } from "../../stores/modal";
import { useSearchStore } from "../../stores/search";
import { useUserStore } from "../../stores/user";
import { friendRequest } from "../../api/friend";
import { userRequest } from "../../api/user";
import DataTableLayout from "../../components/ui/data-table/DataTableLayout.vue";
import Switch from "../../components/ui/switch/Switch.vue";
import Toggle from "../../components/ui/toggle/Toggle.vue";
import TooltipWrapper from "../../components/ui/tooltip/TooltipWrapper.vue";
import { createColumns } from "./columns.tsx";
import { localeIncludes, replaceBioSymbols } from "../../shared/utils/base/string";
import { removeConfusables, removeWhitespace } from "../../services/confusables";
import { useVrcxVueTable } from "../../lib/table/use-vrcx-vue-table";
import { showUserDialog } from "../../coordinators/user-coordinator";
import { confirmDeleteFriend, handleFriendDelete } from "../../coordinators/friend-relationship-coordinator";
import { useUserDisplay } from "../../composables/use-user-display";
import { database } from "../../services/database";
import type { VrcxUser } from "../../types/vrcx";

type FriendProfile = {
  bio: string | null;
  bioLinks: string[];
};

type FriendSearchEntry = {
  signature: string;
  bio: string;
  displayName: string;
  memo: string;
  normalizedDisplayName: string;
  note: string;
  rank: string;
  status: string;
};

const { t } = useI18n();

const emit = defineEmits<{
  "lookup-user": [value: VrcxUser];
}>();

const { friends, allFavoriteFriendIds } = storeToRefs(useFriendStore());
const modalStore = useModalStore();
const { getAllUserStats, getAllUserMutualCount, getAllUserMutualOptedOut } = useFriendStore();
const chartsStore = useChartsStore();
const isMutualFetching = computed(() => chartsStore.mutualGraphStatus.isFetching);
const isMutualOptOut = computed(() => useUserStore().currentUser.hasSharedConnectionsOptOut);
const appearanceSettingsStore = useAppearanceSettingsStore();
const { randomUserColours } = storeToRefs(appearanceSettingsStore);
const { userImage } = useUserDisplay();

const { stringComparer, friendsListSearch } = storeToRefs(useSearchStore());

const friendsListSearchFilters = ref<string[]>([]);
const friendsListBulkUnfriendMode = ref(false);
const friendsListLoading = ref(false);
const friendsListLoadingCurrent = ref(0);
const friendsListLoadingTotal = ref(0);
const friendsListLoadDialogVisible = ref(false);
const friendsListSearchFilterVIP = ref(false);
const selectedFriends = ref(new Set<string>());
const friendsListDisplayData = ref<VrcxUser[]>([]);
const pageSizes = computed(() => appearanceSettingsStore.tablePageSizes);
const defaultSorting = [{ id: "friendNumber", desc: true }];

const friendsListLoadingPercent = computed(() => {
  if (!friendsListLoadingTotal.value) return 0;
  return Math.min(100, Math.round((friendsListLoadingCurrent.value / friendsListLoadingTotal.value) * 100));
});

const friendSearchCache = new Map<string, FriendSearchEntry>();
const friendProfiles = shallowRef(new Map<string | null, FriendProfile>());
const FRIEND_LIST_SEARCH_DEBOUNCE_MS = 150;
const FRIEND_STATS_REFRESH_INTERVAL_MS = 30000;
let friendsListSearchTimer: ReturnType<typeof setTimeout> | null = null;
let friendStatsRefreshInFlight: Promise<PromiseSettledResult<void>[]> | null = null;
let lastFriendStatsRefreshAt = 0;
let lastFriendStatsRefreshKey = "";

const friendsListColumns = computed(() =>
  createColumns({
    randomUserColours,
    selectedFriends,
    onToggleFriendSelection: toggleFriendSelection,
    onConfirmDeleteFriend: confirmDeleteFriend,
    userImage,
    friendProfiles,
  })
);

const { table, sorting, pagination } = useVrcxVueTable({
  persistKey: "friendList",
  get data() {
    return friendsListDisplayData.value;
  },
  columns: friendsListColumns.value,
  getRowId: (row) => row.id,
  enablePinning: true,

  initialSorting: defaultSorting,
  initialPagination: {
    pageIndex: 0,
    pageSize: appearanceSettingsStore.tablePageSize,
  },
});

const totalItems = computed(() => {
  return table.getFilteredRowModel().rows.length;
});

const handlePageSizeChange = (size: number) => {
  pagination.value = {
    ...pagination.value,
    pageIndex: 0,
    pageSize: size,
  };
};

const handleRowClick = (row: { original: VrcxUser | null | undefined }) => {
  selectFriendsListRow(row.original);
};

watch(
  friendsListColumns,
  (next) => {
    table.setOptions((prev) => ({
      ...prev,
      columns: next,
    }));
  },
  { immediate: true }
);

watch(
  friendsListBulkUnfriendMode,
  (isEnabled) => {
    const column = table.getColumn("bulkSelect");
    if (!column) {
      return;
    }
    column.toggleVisibility(isEnabled);
  },
  { immediate: true }
);

const route = useRoute();

watch(
  () => route.path,
  () => {
    refreshFriendStats().catch(logFriendListError);
    loadFriendProfiles().catch(logFriendListError);
    nextTick().then(applyFriendsListSearchChange, logFriendListError);
  },
  { immediate: true }
);

watch(
  () => friends.value.size,
  () => {
    friendSearchCache.clear();
    refreshFriendStats({ force: true }).catch(logFriendListError);
    loadFriendProfiles().catch(logFriendListError);
    applyFriendsListSearchChange();
  }
);

onBeforeUnmount(() => {
  if (friendsListSearchTimer) {
    clearTimeout(friendsListSearchTimer);
  }
});

function logFriendListError(error: unknown) {
  console.error(error);
}

async function loadFriendProfiles() {
  const profiles = await database.getAllUserProfiles();
  friendProfiles.value = new Map(profiles.map((profile): [string | null, FriendProfile] => [profile.userId, profile]));
  friendSearchCache.clear();
  if (friendsListSearch.value) {
    applyFriendsListSearchChange();
  }
}

function getFriendStatsRefreshKey() {
  return Array.from(friends.value.keys()).sort().join("\u0000");
}

async function refreshFriendStats({ force = false }: { force?: boolean } = {}) {
  const friendStatsRefreshKey = getFriendStatsRefreshKey();
  if (!friendStatsRefreshKey) {
    return;
  }
  const now = Date.now();
  const isStillFresh = friendStatsRefreshKey === lastFriendStatsRefreshKey && now - lastFriendStatsRefreshAt < FRIEND_STATS_REFRESH_INTERVAL_MS;
  if (!force && (friendStatsRefreshInFlight || isStillFresh)) {
    return friendStatsRefreshInFlight;
  }
  friendStatsRefreshInFlight = Promise.allSettled([getAllUserStats(), getAllUserMutualCount(), getAllUserMutualOptedOut()])
    .then((results) => {
      if (results.every((result) => result.status === "fulfilled")) {
        lastFriendStatsRefreshAt = Date.now();
        lastFriendStatsRefreshKey = friendStatsRefreshKey;
      }
      return results;
    })
    .finally(() => {
      friendStatsRefreshInFlight = null;
    });
  return friendStatsRefreshInFlight;
}

function scheduleFriendsListSearchChange() {
  if (friendsListSearchTimer) {
    clearTimeout(friendsListSearchTimer);
  }
  friendsListSearchTimer = setTimeout(() => {
    friendsListSearchTimer = null;
    applyFriendsListSearchChange();
  }, FRIEND_LIST_SEARCH_DEBOUNCE_MS);
}

function friendsListSearchChange() {
  if (friendsListSearchTimer) {
    clearTimeout(friendsListSearchTimer);
    friendsListSearchTimer = null;
  }
  applyFriendsListSearchChange();
}

function getFriendSearchEntry(ctx: FriendContext) {
  if (!ctx.ref?.id) {
    return null;
  }
  const friendRef: Partial<VrcxUser> = ctx.ref;
  const signature = [
    friendRef.$memo ?? "",
    friendRef.displayName ?? "",
    friendRef.note ?? "",
    friendProfiles.value.get(ctx.id)?.bio ?? "",
    friendRef.statusDescription ?? "",
    friendRef.$trustLevel ?? "",
  ].join("\u0000");
  const cached = friendSearchCache.get(ctx.id);
  if (cached?.signature === signature) {
    return cached;
  }
  const entry: FriendSearchEntry = {
    signature,
    bio: replaceBioSymbols(friendProfiles.value.get(ctx.id)?.bio),
    displayName: friendRef.displayName ?? "",
    memo: friendRef.$memo ?? "",
    normalizedDisplayName: removeConfusables(friendRef.displayName ?? ""),
    note: friendRef.note ?? "",
    rank: (friendRef.$trustLevel ?? "").toUpperCase(),
    status: friendRef.statusDescription ?? "",
  };
  friendSearchCache.set(ctx.id, entry);
  return entry;
}

function applyFriendsListSearchChange() {
  friendsListLoading.value = true;
  let query = "";
  let cleanedQuery = "";
  let upperQuery = "";
  friendsListDisplayData.value = [];
  const filters = friendsListSearchFilters.value.length ? [...friendsListSearchFilters.value] : ["Display Name", "Rank", "Status", "Bio", "Note", "Memo"];
  const results: VrcxUser[] = [];
  if (friendsListSearch.value) {
    query = friendsListSearch.value;
    cleanedQuery = removeWhitespace(query);
    upperQuery = query.toUpperCase();
  }
  const isEntryMatchingQuery = (entry: FriendSearchEntry) => {
    if (filters.includes("Display Name") && entry.displayName) {
      if (localeIncludes(entry.displayName, cleanedQuery, stringComparer.value)) return true;
      if (localeIncludes(entry.normalizedDisplayName, cleanedQuery, stringComparer.value)) return true;
    }
    if (filters.includes("Memo") && entry.memo && localeIncludes(entry.memo, query, stringComparer.value)) return true;
    if (filters.includes("Note") && entry.note && localeIncludes(entry.note, query, stringComparer.value)) return true;
    if (filters.includes("Bio") && entry.bio && localeIncludes(entry.bio, query, stringComparer.value)) return true;
    if (filters.includes("Status") && entry.status && localeIncludes(entry.status, query, stringComparer.value)) return true;
    return filters.includes("Rank") && entry.rank.includes(upperQuery);
  };
  for (const ctx of friends.value.values()) {
    if (!ctx.ref) continue;
    if (friendsListSearchFilterVIP.value && !allFavoriteFriendIds.value.has(ctx.id)) continue;
    if (query) {
      const searchEntry = getFriendSearchEntry(ctx);
      if (!searchEntry || !isEntryMatchingQuery(searchEntry)) continue;
    }
    results.push(ctx.ref);
  }
  friendsListDisplayData.value = results;
  table.setPageIndex(0);
  table.setSorting([...defaultSorting]);
  sorting.value = [...defaultSorting];
  nextTick().then(() => {
    friendsListLoading.value = false;
  }, logFriendListError);
}

function toggleFriendSelection(id: string) {
  if (selectedFriends.value.has(id)) {
    selectedFriends.value.delete(id);
  } else {
    selectedFriends.value.add(id);
  }
}

function toggleFriendsListBulkUnfriendMode() {
  if (!friendsListBulkUnfriendMode.value) {
    selectedFriends.value.clear();
  }
}

function showBulkUnfriendSelectionConfirm() {
  const pending = friendsListDisplayData.value.filter((item) => selectedFriends.value.has(item.id)).map((item) => item.displayName);
  if (!pending.length) return;
  const description =
    `Are you sure you want to delete ${pending.length} friends?\n` +
    "This can negatively affect your trust rank,\n" +
    "This action cannot be undone.\n\n" +
    pending.join("\n");

  modalStore
    .confirm({
      description,
      title: `Delete ${pending.length} friends?`,
    })
    .then(({ ok }) => (ok ? bulkUnfriendSelection() : undefined))
    .catch(logFriendListError);
}

async function bulkUnfriendSelection() {
  if (!selectedFriends.value.size) return;
  const selectedFriendsCount = selectedFriends.value.size;
  for (const item of friendsListDisplayData.value) {
    if (selectedFriends.value.has(item.id)) {
      console.log(`Unfriending ${item.displayName} (${item.id})`);
      await friendRequest.deleteFriend({ userId: item.id }).then((args) => handleFriendDelete(args));
      selectedFriends.value.delete(item.id);
    }
  }
  modalStore
    .alert({
      description: `Unfriended ${selectedFriendsCount} friends.`,
      title: "Bulk Unfriend Complete",
    })
    .catch(logFriendListError);
  selectedFriends.value.clear();
}

async function friendsListLoadUsers() {
  await loadFriendProfiles();
  const toFetch = Array.from(friends.value.values())
    .flatMap((ctx) => (ctx.ref ? [{ userId: ctx.id, needsUser: !ctx.ref.date_joined, needsProfile: !friendProfiles.value.has(ctx.id) }] : []))
    .filter((item) => item.needsUser || item.needsProfile);
  const total = toFetch.length;
  friendsListLoadingTotal.value = total;
  friendsListLoadingCurrent.value = 0;
  if (!total) {
    toast.success(t("view.friend_list.load_complete"));
    return;
  }
  friendsListLoading.value = true;
  friendsListLoadDialogVisible.value = true;
  let isCancelled = false;
  for (const { userId, needsUser, needsProfile } of toFetch) {
    if (isFriendsListLoadStopped()) {
      isCancelled = true;
      break;
    }
    friendsListLoadingCurrent.value += 1;
    try {
      if (needsUser) {
        await userRequest.getUser({ userId });
      }
      if (needsProfile) {
        await userRequest.getPublicProfile({ userId });
      }
    } catch (err) {
      console.error(err);
    }
  }
  friendsListLoading.value = false;
  loadFriendProfiles().catch(logFriendListError);
  friendsListLoadDialogVisible.value = false;
  friendsListLoadingCurrent.value = 0;
  friendsListLoadingTotal.value = 0;
  if (!isCancelled) {
    toast.success(t("view.friend_list.load_complete"));
  }
}

function isFriendsListLoadStopped() {
  return !friendsListLoading.value;
}

function cancelFriendsListLoad() {
  friendsListLoading.value = false;
  friendsListLoadDialogVisible.value = false;
}

function selectFriendsListRow(val: VrcxUser | null | undefined) {
  if (!val) return;
  if (!val.id) emit("lookup-user", val);
  else showUserDialog(val.id);
}

async function loadMutualFriends() {
  if (isMutualFetching.value) return;
  await chartsStore.fetchMutualGraph();
  await Promise.allSettled([getAllUserMutualCount(), getAllUserMutualOptedOut()]);
}

function handleFriendListFilterChange(value: unknown) {
  friendsListSearchFilters.value = Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
  friendsListSearchChange();
}
</script>
