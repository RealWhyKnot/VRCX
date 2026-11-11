<template>
  <div ref="feedRef" class="x-container feed x-container--auto-height">
    <DataTableLayout
      :table="table"
      :loading="feedTable.loading"
      auto-height
      :page-sizes="pageSizes"
      :total-items="totalItems"
      :on-page-size-change="handlePageSizeChange"
    >
      <template #toolbar>
        <div class="mt-0 mx-0 mb-2" style="display: flex; align-items: center">
          <div style="flex: none; display: flex; align-items: center" class="mr-2">
            <Popover v-model:open="popoverOpen">
              <PopoverTrigger as-child>
                <Button variant="outline" size="sm" class="mx-2 h-8 gap-1.5">
                  <ListFilter class="size-4" />
                  {{ t("view.my_avatars.filter") }}
                  <Badge v-if="activeFilterCount" variant="secondary" class="ml-0.5 h-4.5 min-w-4.5 rounded-full px-1 text-xs">
                    {{ activeFilterCount }}
                  </Badge>
                </Button>
              </PopoverTrigger>
              <PopoverContent class="w-auto" side="bottom" align="end">
                <RangeCalendar v-model="dateRange" :locale="locale" :max-value="todayDate" :number-of-months="2" :week-starts-on="weekStartsOn" />
                <div class="flex justify-end gap-2 mt-3">
                  <Button variant="outline" size="sm" @click="clearDateFilter">
                    {{ t("common.actions.clear") }}
                  </Button>
                  <Button size="sm" @click="applyDateFilter">
                    {{ t("common.actions.confirm") }}
                  </Button>
                </div>
              </PopoverContent>
            </Popover>
            <TooltipWrapper side="bottom" :content="t('view.feed.favorites_only_tooltip')">
              <div>
                <Toggle
                  variant="outline"
                  size="sm"
                  :model-value="feedTable.vip"
                  :aria-label="t('view.feed.favorites_only_tooltip')"
                  @update:model-value="
                    (v) => {
                      feedTable.vip = v;
                      feedTableLookup();
                    }
                  "
                >
                  <Star v-if="feedTable.vip" fill="currentColor" />
                  <Star v-else />
                </Toggle>
              </div>
            </TooltipWrapper>
          </div>
          <ToggleGroup
            type="multiple"
            variant="outline"
            size="sm"
            :model-value="activeFilterSelection"
            class="w-full justify-start"
            style="flex: 1"
            @update:model-value="handleFeedFilterChange"
          >
            <ToggleGroupItem value="All">
              {{ t("view.search.avatar.all") }}
            </ToggleGroupItem>
            <ToggleGroupItem v-for="type in feedFilterTypes" :key="type" :value="type">
              {{ t("view.feed.filters." + type) }}
            </ToggleGroupItem>
          </ToggleGroup>
          <InputGroupField
            v-model="feedTable.search"
            class="ml-2"
            :placeholder="t('view.feed.search_placeholder')"
            clearable
            style="flex: 0.4"
            @keyup.enter="feedTableLookup"
            @change="feedTableLookup"
          />
        </div>
      </template>
    </DataTableLayout>
  </div>
</template>

<script setup>
import { computed, ref } from "vue";
import { ListFilter, Star } from "lucide-vue-next";
import { getLocalTimeZone, today } from "@internationalized/date";
import { storeToRefs } from "pinia";
import { useI18n } from "vue-i18n";

import dayjs from "dayjs";

import Popover from "../../components/ui/popover/Popover.vue";
import PopoverContent from "../../components/ui/popover/PopoverContent.vue";
import PopoverTrigger from "../../components/ui/popover/PopoverTrigger.vue";
import { useAppearanceSettingsStore } from "../../stores/settings/appearance";
import { useFeedStore } from "../../stores/feed";
import { useVrcxStore } from "../../stores/vrcx";
import ToggleGroup from "../../components/ui/toggle-group/ToggleGroup.vue";
import ToggleGroupItem from "../../components/ui/toggle-group/ToggleGroupItem.vue";
import Badge from "../../components/ui/badge/Badge.vue";
import Button from "../../components/ui/button/Button.vue";
import DataTableLayout from "../../components/ui/data-table/DataTableLayout.vue";
import InputGroupField from "../../components/ui/input-group/InputGroupField.vue";
import RangeCalendar from "../../components/ui/range-calendar/RangeCalendar.vue";
import Toggle from "../../components/ui/toggle/Toggle.vue";
import { columns as baseColumns } from "./columns.jsx";
import { useVrcxVueTable } from "../../lib/table/use-vrcx-vue-table";

const { feedTable, feedTableData } = storeToRefs(useFeedStore());
const { feedTableLookup } = useFeedStore();
const appearanceSettingsStore = useAppearanceSettingsStore();
const { weekStartsOn } = storeToRefs(appearanceSettingsStore);
const vrcxStore = useVrcxStore();

const { t, locale } = useI18n();
const feedFilterTypes = ["GPS", "Online", "Offline", "Status", "Avatar", "Bio"];

const popoverOpen = ref(false);
const todayDate = today(getLocalTimeZone());
const dateRange = ref(undefined);
const hasDateFilter = computed(() => !!(feedTable.value.dateFrom || feedTable.value.dateTo));
const activeFilterCount = computed(() => (hasDateFilter.value ? 1 : 0));

function applyDateFilter() {
  if (dateRange.value?.start) {
    const s = dateRange.value.start;
    feedTable.value.dateFrom = dayjs(`${s.year}-${s.month}-${s.day}`).startOf("day").toISOString();
  } else {
    feedTable.value.dateFrom = "";
  }
  if (dateRange.value?.end) {
    const e = dateRange.value.end;
    feedTable.value.dateTo = dayjs(`${e.year}-${e.month}-${e.day}`).endOf("day").toISOString();
  } else {
    feedTable.value.dateTo = "";
  }
  popoverOpen.value = false;
  feedTableLookup();
}

function clearDateFilter() {
  dateRange.value = undefined;
  feedTable.value.dateFrom = "";
  feedTable.value.dateTo = "";
  popoverOpen.value = false;
  feedTableLookup();
}

const feedRef = ref(null);

const pageSizes = computed(() => appearanceSettingsStore.tablePageSizes);

function getFeedRowId(row) {
  return `row:${row.rowId}:${row?.type ?? ""}`;
}

const { table, pagination } = useVrcxVueTable({
  get data() {
    return feedTableData.value;
  },
  persistKey: "feed",
  columns: baseColumns,
  getRowId: getFeedRowId,
  enableExpanded: true,
  getRowCanExpand: () => true,
  initialSorting: [],
  initialExpanded: {},
  initialPagination: {
    pageIndex: 0,
    pageSize: appearanceSettingsStore.tablePageSize,
  },
  tableOptions: {
    autoResetExpanded: false,
    autoResetPageIndex: false,
  },
});

const totalItems = computed(() => {
  const length = table.getFilteredRowModel().rows.length;
  const max = vrcxStore.maxTableSize;
  return length > max && length < max + 51 ? max : length;
});

const handlePageSizeChange = (size) => {
  pagination.value = {
    ...pagination.value,
    pageIndex: 0,
    pageSize: size,
  };
};

const activeFilterSelection = computed(() => {
  const filter = feedTable.value.filter;
  if (!Array.isArray(filter) || filter.length === 0) {
    return ["All"];
  }
  return filter;
});

function handleFeedFilterChange(value) {
  const selected = Array.isArray(value) ? value : [];
  const wasAll = activeFilterSelection.value.includes("All");
  const hasAll = selected.includes("All");
  const types = selected.filter((v) => v !== "All");

  if (hasAll && !wasAll) {
    feedTable.value.filter = [];
  } else if (wasAll && types.length) {
    feedTable.value.filter = types;
  } else {
    feedTable.value.filter = types.length === feedFilterTypes.length ? [] : types.length ? types : [];
  }
  feedTableLookup();
}
</script>

<style scoped>
.feed :deep(.x-text-removed) {
  text-decoration: line-through;
  color: #f00;
  background-color: rgb(255 0 0 / 20%);
  padding: 2px;
  border-radius: 4px;
}

.feed :deep(.x-text-added) {
  color: rgb(35 188 35);
  background-color: rgb(76 255 80 / 20%);
  padding: 2px;
  border-radius: 4px;
}
</style>
