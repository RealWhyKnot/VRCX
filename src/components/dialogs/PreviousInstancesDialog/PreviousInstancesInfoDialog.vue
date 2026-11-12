<template>
  <div>
    <DialogHeader>
      <DialogTitle>{{ t("dialog.previous_instances.info") }}</DialogTitle>
    </DialogHeader>

    <DataTableLayout
      v-if="viewMode === 'table'"
      class="min-w-0 w-full"
      :table="table"
      :loading="loading"
      :table-style="tableStyle"
      :page-sizes="pageSizes"
      :total-items="totalItems"
      :on-page-size-change="handlePageSizeChange"
      :on-page-change="handlePageChange"
      :on-sort-change="handleSortChange"
    >
      <template #toolbar>
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2 px-1 py-2">
            <ToggleGroup type="single" :model-value="viewMode" variant="outline" @update:model-value="handleViewModeChange">
              <TooltipWrapper :content="t('dialog.previous_instances.table_view')" side="bottom" :delay-duration="300">
                <ToggleGroupItem value="table" class="px-2" :class="viewMode === 'table' && 'bg-accent text-accent-foreground'">
                  <List class="size-4" />
                </ToggleGroupItem>
              </TooltipWrapper>
              <TooltipWrapper :content="t('dialog.previous_instances.chart_view')" side="bottom" :delay-duration="300">
                <ToggleGroupItem value="chart" class="px-2">
                  <BarChart3 class="size-4" />
                </ToggleGroupItem>
              </TooltipWrapper>
            </ToggleGroup>
            <Location :location="location.tag" class="text-sm" />
            <TooltipWrapper v-if="seenSummary" side="bottom" :content="formatDateFilter(seen.lastAt, 'long')">
              <span class="shrink-0 text-xs text-muted-foreground tabular-nums" data-testid="instance-seen-summary">{{ seenSummary }}</span>
            </TooltipWrapper>
          </div>
          <InputGroupField v-model="search" :placeholder="t('dialog.previous_instances.search_placeholder')" class="w-[150px]" clearable />
        </div>
      </template>
    </DataTableLayout>

    <div v-else-if="viewMode === 'chart'" class="flex flex-col min-w-0 w-full h-full">
      <div class="flex items-center justify-between px-1 py-2">
        <div class="flex items-center gap-2">
          <ToggleGroup type="single" :model-value="viewMode" variant="outline" @update:model-value="handleViewModeChange">
            <TooltipWrapper :content="t('dialog.previous_instances.table_view')" side="bottom" :delay-duration="300">
              <ToggleGroupItem value="table" class="px-2">
                <List class="size-4" />
              </ToggleGroupItem>
            </TooltipWrapper>
            <TooltipWrapper :content="t('dialog.previous_instances.chart_view')" side="bottom" :delay-duration="300">
              <ToggleGroupItem value="chart" class="px-2" :class="viewMode === 'chart' && 'bg-accent text-accent-foreground'">
                <BarChart3 class="size-4" />
              </ToggleGroupItem>
            </TooltipWrapper>
          </ToggleGroup>
          <Location :location="location.tag" class="text-sm" />
          <TooltipWrapper v-if="seenSummary" side="bottom" :content="formatDateFilter(seen.lastAt, 'long')">
            <span class="shrink-0 text-xs text-muted-foreground tabular-nums">{{ seenSummary }}</span>
          </TooltipWrapper>
        </div>
      </div>
      <div class="flex-1 overflow-auto min-h-0">
        <div v-if="chartLoading" class="flex items-center justify-center min-h-[200px]">
          <span class="text-muted-foreground text-sm">{{ t("view.friends_locations.loading_more") }}</span>
        </div>
        <PreviousInstancesInfoChart v-else :chart-data="chartData" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import Location from "@/components/Location.vue";
defineOptions({ name: "PreviousInstancesInfoDialog" });

import { computed, nextTick, ref, watch } from "vue";
import DialogHeader from "@/components/ui/dialog/DialogHeader.vue";
import DialogTitle from "@/components/ui/dialog/DialogTitle.vue";
import { storeToRefs } from "pinia";
import { useI18n } from "vue-i18n";
import { BarChart3, List } from "lucide-vue-next";

import { useGameLogStore } from "../../../stores/gameLog";
import { useInstanceStore } from "../../../stores/instance";
import type { PreviousInstancesTableState } from "../../../stores/instance-types";
import { useSearchStore } from "../../../stores/search";
import { compareByCreatedAt } from "../../../shared/utils/compare";
import { localeIncludes } from "../../../shared/utils/base/string";
import { parseLocation } from "../../../shared/utils/location-parser";
import { timeToText } from "../../../shared/utils/base/format";
import type { ParsedLocation } from "../../../types/vrcx";
import DataTableLayout from "../../ui/data-table/DataTableLayout.vue";
import InputGroupField from "../../ui/input-group/InputGroupField.vue";
import ToggleGroup from "../../ui/toggle-group/ToggleGroup.vue";
import ToggleGroupItem from "../../ui/toggle-group/ToggleGroupItem.vue";
import TooltipWrapper from "../../ui/tooltip/TooltipWrapper.vue";
import { createColumns, type InstancePlayerRow } from "./previous-instances-info-columns.tsx";
import { database } from "../../../services/database";
import { useVrcxVueTable } from "../../../lib/table/use-vrcx-vue-table";
import { lookupUser } from "../../../coordinators/user-coordinator";
import { formatDateFilter } from "../../../coordinators/date-coordinator";
import type { LocationSightingSummary } from "../../../services/database/sightings";
import { logError } from "../../../stores/vrcx-messages";

import PreviousInstancesInfoChart from "./PreviousInstancesInfoChart.vue";

type ChartRow = {
  created_at: string;
  time: number;
  user_id: string;
  display_name: string;
};

const { previousInstancesInfoDialog, previousInstancesInfoState } = storeToRefs(useInstanceStore());
const { gameLogIsFriend, gameLogIsFavorite } = useGameLogStore();
const { t } = useI18n();

const dialogState = computed(() => {
  return previousInstancesInfoState.value;
});

const loading = ref(false);
const rawRows = ref<InstancePlayerRow[]>([]);
const pageSizes = [10, 25, 50, 100];
const pageSize = computed({
  get: () => dialogState.value.pageSize,
  set: (value) => {
    dialogState.value.pageSize = value;
  },
});
const pageIndex = computed({
  get: () => dialogState.value.pageIndex,
  set: (value) => {
    dialogState.value.pageIndex = value;
  },
});
const tableStyle = { maxHeight: "100%" };
const search = computed({
  get: () => dialogState.value.search,
  set: (value) => {
    dialogState.value.search = value;
  },
});
const sortBy = computed({
  get: () => dialogState.value.sortBy,
  set: (value) => {
    dialogState.value.sortBy = value;
  },
});

const location = ref<ParsedLocation>({
  tag: "",
  isOffline: false,
  isPrivate: false,
  isTraveling: false,
  isRealInstance: false,
  worldId: "",
  instanceId: "",
  instanceName: "",
  accessType: "",
  accessTypeName: "",
  region: "",
  shortName: "",
  userId: null,
  hiddenId: null,
  privateId: null,
  friendsId: null,
  groupId: null,
  groupAccessType: null,
  canRequestInvite: false,
  strict: false,
  ageGate: false,
});

const { stringComparer } = storeToRefs(useSearchStore());

const seen = ref<LocationSightingSummary>({ count: 0, peakUsers: 0, capacity: 0, lastAt: "" });
const seenSummary = computed(() => {
  const { count, peakUsers, capacity } = seen.value;
  if (count === 0) {
    return "";
  }
  const peak = capacity > 0 ? `${peakUsers}/${capacity}` : String(peakUsers);
  return t("dialog.previous_instances.seen_summary", { count: count.toLocaleString(), peak });
});

const viewMode = ref("table");
const chartData = ref<ChartRow[]>([]);
const chartLoading = ref(false);

const displayRows = computed(() => {
  const q = search.value.trim().toLowerCase();
  const rows = rawRows.value;
  if (!q) return rows;
  return rows.filter((row) => localeIncludes(row.displayName ?? "", q, stringComparer.value));
});

const columns = computed(() =>
  createColumns({
    onLookupUser: (lookupRef) => {
      void lookupUser(lookupRef).catch(logError);
    },
  })
);

const { table } = useVrcxVueTable({
  persistKey: "previousInstancesInfoDialog",
  get data() {
    return displayRows.value;
  },
  columns: columns.value,
  getRowId: (row) => JSON.stringify(row),
  initialSorting: sortBy.value,
  initialPagination: {
    pageIndex: pageIndex.value,
    pageSize: pageSize.value,
  },
  tableOptions: {
    autoResetPageIndex: false,
  },
});

watch(
  columns,
  (next) => {
    table.setOptions((prev) => ({
      ...prev,
      columns: next,
    }));
  },
  { immediate: true }
);

const totalItems = computed(() => {
  return table.getFilteredRowModel().rows.length;
});

const handlePageSizeChange = (size: number) => {
  pageSize.value = size;
};

const handlePageChange = (page: number) => {
  pageIndex.value = Math.max(0, page - 1);
};

const handleSortChange = (sorting: PreviousInstancesTableState["sortBy"]) => {
  sortBy.value = sorting;
};

function handleViewModeChange(value: unknown) {
  if (value === "table" || value === "chart") {
    viewMode.value = value;
    if (value === "chart" && chartData.value.length === 0) {
      void loadChartData().catch(logError);
    }
  }
}

async function loadChartData() {
  chartLoading.value = true;
  try {
    const data = await database.getPlayerDetailFromInstance(location.value.tag);
    chartData.value = data.map((row) => ({
      created_at: row.created_at ?? "",
      time: row.time,
      user_id: row.user_id ?? "",
      display_name: row.display_name ?? "",
    }));
  } catch (error) {
    console.error("Failed to load chart data:", error);
    chartData.value = [];
  } finally {
    chartLoading.value = false;
  }
}

watch(
  () => previousInstancesInfoDialog.value.visible,
  (isVisible) => {
    if (isVisible) {
      void nextTick(() => {
        init();
        refreshPreviousInstancesInfoTable();
      }).catch(logError);
    } else {
      viewMode.value = "table";
      chartData.value = [];
    }
  },
  { immediate: true }
);

function init() {
  loading.value = true;
  location.value = parseLocation(previousInstancesInfoDialog.value.instanceId);
  if (previousInstancesInfoDialog.value.lastId !== previousInstancesInfoDialog.value.instanceId) {
    table.setPageIndex(0);
    previousInstancesInfoDialog.value.lastId = previousInstancesInfoDialog.value.instanceId;
  }
}

function refreshPreviousInstancesInfoTable() {
  const tag = location.value.tag;
  seen.value = { count: 0, peakUsers: 0, capacity: 0, lastAt: "" };
  void database
    .getLocationSightingSummary(tag)
    .then((summary) => {
      if (location.value.tag === tag) {
        seen.value = summary;
      }
    })
    .catch(logError);
  void database
    .getPlayersFromInstance(location.value.tag)
    .then((data) => {
      const array: InstancePlayerRow[] = [];
      for (const entry of data.values()) {
        array.push({
          ...entry,
          timer: timeToText(entry.time),
          isFriend: gameLogIsFriend(entry),
          isFavorite: gameLogIsFavorite(entry),
        });
      }
      array.sort(compareByCreatedAt);
      rawRows.value = array;
      loading.value = false;
    })
    .catch(logError);
}
</script>
