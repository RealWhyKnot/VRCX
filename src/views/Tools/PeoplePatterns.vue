<template>
  <div class="x-container x-container-auto-height">
    <DataTableLayout
      v-if="view === 'repeat'"
      :table="repeatTable.table"
      :loading="isLoading"
      auto-height
      :page-sizes="pageSizes"
      :total-items="repeatRows.length"
      :on-page-size-change="resizeRepeat"
    >
      <template #toolbar>
        <PeoplePatternsToolbar v-model:view="view" v-model:search="searchText" :is-loading="isLoading" @refresh="reload" @back="goBack" />
      </template>
    </DataTableLayout>
    <DataTableLayout
      v-else-if="view === 'gatherings'"
      :table="gatheringTable.table"
      :loading="isLoading"
      auto-height
      :page-sizes="pageSizes"
      :total-items="gatheringRows.length"
      :on-page-size-change="resizeGatherings"
    >
      <template #toolbar>
        <PeoplePatternsToolbar v-model:view="view" v-model:search="searchText" :is-loading="isLoading" @refresh="reload" @back="goBack" />
      </template>
    </DataTableLayout>
    <DataTableLayout
      v-else-if="view === 'votekicks'"
      :table="voteKickTable.table"
      :loading="isLoading"
      auto-height
      :page-sizes="pageSizes"
      :total-items="voteKickRows.length"
      :on-page-size-change="resizeVoteKicks"
    >
      <template #toolbar>
        <PeoplePatternsToolbar v-model:view="view" v-model:search="searchText" :is-loading="isLoading" @refresh="reload" @back="goBack" />
      </template>
    </DataTableLayout>
    <DataTableLayout
      v-else-if="view === 'seen'"
      :table="seenTable.table"
      :loading="isLoading"
      auto-height
      :page-sizes="pageSizes"
      :total-items="seenRows.length"
      :on-page-size-change="resizeSeen"
    >
      <template #toolbar>
        <PeoplePatternsToolbar v-model:view="view" v-model:search="searchText" :is-loading="isLoading" @refresh="reload" @back="goBack" />
      </template>
    </DataTableLayout>
    <DataTableLayout
      v-else
      :table="overlapTable.table"
      :loading="isLoading"
      auto-height
      :page-sizes="pageSizes"
      :total-items="overlapRows.length"
      :on-page-size-change="resizeOverlap"
    >
      <template #toolbar>
        <PeoplePatternsToolbar v-model:view="view" v-model:search="searchText" :is-loading="isLoading" @refresh="reload" @back="goBack" />
      </template>
    </DataTableLayout>
  </div>
</template>

<script setup lang="ts">
import { computed, onActivated, ref, shallowRef, watch } from "vue";
import { toast } from "vue-sonner";
import { useI18n } from "vue-i18n";
import { useRouter } from "vue-router";

import DataTableLayout from "@/components/ui/data-table/DataTableLayout.vue";
import { showGroupDialog } from "@/coordinators/group-dialog-coordinator";
import { lookupUser, showUserDialog } from "@/coordinators/user-coordinator";
import { useVrcxVueTable } from "@/lib/table/use-vrcx-vue-table";
import { database } from "@/services/database";
import {
  buildGatherings,
  buildOnlineOverlap,
  buildVoteKicks,
  filterGatherings,
  filterOnlineOverlap,
  filterRepeatEncounters,
  filterVoteKicks,
  patternWindowStart,
  type Gathering,
  type OnlineOverlap,
  type PeopleView,
  type RepeatEncounter,
  type VoteKick,
} from "@/shared/utils/people-patterns";
import { filterSightings, type SightingRow } from "@/shared/utils/instance-sightings";
import { useAppearanceSettingsStore } from "@/stores/settings/appearance";
import { useUserStore } from "@/stores/user";
import { logError } from "@/stores/vrcx-messages";
import PeoplePatternsToolbar from "./components/PeoplePatternsToolbar.vue";
import { createGatheringColumns, createOverlapColumns, createRepeatColumns, createVoteKickColumns } from "./people-patterns-columns.tsx";
import { createSightingColumns } from "./sighting-columns.tsx";

defineOptions({ name: "PeoplePatternsView" });

const { t } = useI18n();
const router = useRouter();
const userStore = useUserStore();
const appearanceSettingsStore = useAppearanceSettingsStore();

const view = ref<PeopleView>("repeat");
const searchText = ref("");
const isLoading = ref(false);
const loaded = new Set<PeopleView>();
const encounters = shallowRef<RepeatEncounter[]>([]);
const gatherings = shallowRef<Gathering[]>([]);
const overlaps = shallowRef<OnlineOverlap[]>([]);
const voteKicks = shallowRef<VoteKick[]>([]);
const sightings = shallowRef<SightingRow[]>([]);

const repeatRows = computed(() => filterRepeatEncounters(encounters.value, searchText.value));
const gatheringRows = computed(() => filterGatherings(gatherings.value, searchText.value));
const overlapRows = computed(() => filterOnlineOverlap(overlaps.value, searchText.value));
const voteKickRows = computed(() => filterVoteKicks(voteKicks.value, searchText.value));
const seenRows = computed(() => filterSightings(sightings.value, searchText.value));

const loaders = {
  repeat: async () => {
    encounters.value = await database.getRepeatEncounters(userStore.currentUser.id);
  },
  gatherings: async () => {
    gatherings.value = buildGatherings(await database.getFriendStays(patternWindowStart(Date.now())));
  },
  overlap: async () => {
    const now = Date.now();
    const since = patternWindowStart(now);
    const [events, ownSpans] = await Promise.all([database.getFriendPresenceSince(since), database.getOwnLocationSpans(since)]);
    overlaps.value = buildOnlineOverlap(events, ownSpans, now);
  },
  votekicks: async () => {
    voteKicks.value = buildVoteKicks(await database.getVoteKickEvents());
  },
  seen: async () => {
    sightings.value = await database.getInstanceSightings();
  },
} as const satisfies Record<PeopleView, () => Promise<void>>;

async function load(target: PeopleView) {
  if (isLoading.value) {
    return;
  }
  isLoading.value = true;
  try {
    await loaders[target]();
    loaded.add(target);
  } catch (error) {
    logError(error);
    toast.error(t("view.tools.people_patterns.load_failed"));
  } finally {
    isLoading.value = false;
  }
  if (view.value !== target && !loaded.has(view.value)) {
    await load(view.value);
  }
}

function reload() {
  void load(view.value).catch(logError);
}

function goBack() {
  void router.push({ name: "tools" }).catch(logError);
}

const columnOptions = { onOpenUser: showUserDialog };
const pageSizes = computed(() => appearanceSettingsStore.tablePageSizes);
const initialPagination = { pageIndex: 0, pageSize: appearanceSettingsStore.tablePageSize };
const tableOptions = { autoResetPageIndex: false };

const repeatTable = useVrcxVueTable({
  persistKey: "peopleRepeat",
  get data() {
    return repeatRows.value;
  },
  columns: createRepeatColumns(columnOptions),
  getRowId: (row) => row.id,
  initialSorting: [{ id: "placeCount", desc: true }],
  initialPagination,
  tableOptions,
});

const gatheringTable = useVrcxVueTable({
  persistKey: "peopleGatherings",
  get data() {
    return gatheringRows.value;
  },
  columns: createGatheringColumns(columnOptions),
  getRowId: (row) => row.id,
  initialSorting: [{ id: "startedAt", desc: true }],
  initialPagination,
  tableOptions,
});

const overlapTable = useVrcxVueTable({
  persistKey: "peopleOverlap",
  get data() {
    return overlapRows.value;
  },
  columns: createOverlapColumns(columnOptions),
  getRowId: (row) => row.id,
  initialSorting: [{ id: "timeTogether", desc: true }],
  initialPagination,
  tableOptions,
});

const voteKickTable = useVrcxVueTable({
  persistKey: "peopleVoteKicks",
  get data() {
    return voteKickRows.value;
  },
  columns: createVoteKickColumns({ onLookUp: lookUpByName }),
  getRowId: (row) => row.id,
  initialSorting: [{ id: "at", desc: true }],
  initialPagination,
  tableOptions,
});

function lookUpByName(displayName: string) {
  void lookupUser({ displayName }).catch(logError);
}

const seenTable = useVrcxVueTable({
  persistKey: "peopleSeen",
  get data() {
    return seenRows.value;
  },
  columns: createSightingColumns({ onOpenUser: showUserDialog, onOpenGroup: showGroupDialog, onLookUp: lookUpByName }),
  getRowId: (row) => row.id,
  initialSorting: [{ id: "at", desc: true }],
  initialPagination,
  tableOptions,
});

function resizeSeen(size: number) {
  seenTable.pagination.value = { ...seenTable.pagination.value, pageIndex: 0, pageSize: size };
}

function resizeVoteKicks(size: number) {
  voteKickTable.pagination.value = { ...voteKickTable.pagination.value, pageIndex: 0, pageSize: size };
}

function resizeRepeat(size: number) {
  repeatTable.pagination.value = { ...repeatTable.pagination.value, pageIndex: 0, pageSize: size };
}

function resizeGatherings(size: number) {
  gatheringTable.pagination.value = { ...gatheringTable.pagination.value, pageIndex: 0, pageSize: size };
}

function resizeOverlap(size: number) {
  overlapTable.pagination.value = { ...overlapTable.pagination.value, pageIndex: 0, pageSize: size };
}

watch(view, (next) => {
  if (!loaded.has(next)) {
    void load(next).catch(logError);
  }
});

onActivated(() => {
  loaded.clear();
  reload();
});
</script>
