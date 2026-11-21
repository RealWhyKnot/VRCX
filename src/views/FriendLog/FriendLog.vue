<template>
  <div class="x-container x-container-auto-height">
    <DataTableLayout
      :table="table"
      :loading="friendLogTable.loading"
      auto-height
      :page-sizes="pageSizes"
      :total-items="totalItems"
      :on-page-size-change="handlePageSizeChange"
    >
      <template #toolbar>
        <div class="mt-0 mx-0 mb-2 flex items-center">
          <Select multiple :model-value="friendLogTypeFilter" @update:model-value="handleFriendLogFilterChange">
            <SelectTrigger class="w-full flex-1">
              <SelectValue :placeholder="t('view.friend_log.filter_placeholder')" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem
                  v-for="type in ['Friend', 'Unfriend', 'FriendRequest', 'CancelFriendRequest', 'DisplayName', 'TrustLevel']"
                  :key="type"
                  :value="type"
                >
                  {{ t("view.friend_log.filters." + type) }}
                </SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
          <InputGroupField v-model="friendLogSearch" class="ml-2 flex-[0.4]" :placeholder="t('view.friend_log.search_placeholder')" />
        </div>
      </template>
    </DataTableLayout>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, watch } from "vue";
import { storeToRefs } from "pinia";
import { useI18n } from "vue-i18n";

import Select from "../../components/ui/select/Select.vue";
import SelectContent from "../../components/ui/select/SelectContent.vue";
import SelectGroup from "../../components/ui/select/SelectGroup.vue";
import SelectItem from "../../components/ui/select/SelectItem.vue";
import SelectTrigger from "../../components/ui/select/SelectTrigger.vue";
import SelectValue from "../../components/ui/select/SelectValue.vue";
import { useAppearanceSettingsStore } from "../../stores/settings/appearance";
import { useFriendStore } from "../../stores/friend";
import { useModalStore } from "../../stores/modal";
import type { FriendLogHistoryRow } from "../../stores/friend-types";
import DataTableLayout from "../../components/ui/data-table/DataTableLayout.vue";
import InputGroupField from "../../components/ui/input-group/InputGroupField.vue";
import { createColumns } from "./columns.tsx";
import { database } from "../../services/database";
import { removeFromArray } from "../../shared/utils/base/array";
import { useVrcxVueTable } from "../../lib/table/use-vrcx-vue-table";

import { configRepository } from "../../services/config";
import { watchState } from "../../services/watch-state";

const appearanceSettingsStore = useAppearanceSettingsStore();
const modalStore = useModalStore();
const { hideUnfriends } = storeToRefs(appearanceSettingsStore);
let isViewMounted = true;
onBeforeUnmount(() => {
  isViewMounted = false;
});
const friendStore = useFriendStore();
const { friendLogTable, friendLogHistoryTotal } = storeToRefs(friendStore);

function toStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

const friendLogTypeFilter = computed(() => toStringArray(friendLogTable.value.filters[0]?.value));

const friendLogSearch = computed({
  get: () => {
    const value = friendLogTable.value.filters[1]?.value;
    return typeof value === "string" ? value : "";
  },
  set: (value: string) => {
    const filter = friendLogTable.value.filters[1];
    if (filter) filter.value = value;
  },
});

watch(
  () => hideUnfriends.value,
  (isHidden) => {
    const filter = friendLogTable.value.filters[2];
    if (filter) filter.value = isHidden;
  },
  { immediate: true }
);

const { t } = useI18n();
function saveTableFilters() {
  configRepository.setString("VRCX_friendLogTableFilters", JSON.stringify(toStringArray(friendLogTable.value.filters[0]?.value))).catch(logFriendLogError);
}

function handleFriendLogFilterChange(value: unknown) {
  const filter = friendLogTable.value.filters[0];
  if (filter) {
    filter.value = toStringArray(value);
  }
  saveTableFilters();
}

function logFriendLogError(error: unknown) {
  console.error(error);
}

function isDeletableFriendLogRow(row: FriendLogHistoryRow): row is FriendLogHistoryRow & { created_at: string; type: string; userId: string } {
  return row.created_at !== null && row.type !== null && row.userId !== null;
}

function deleteFriendLogPrompt(row: FriendLogHistoryRow) {
  modalStore
    .confirm({
      description: t("confirm.delete_log"),
      title: "Confirm",
    })
    .then(({ ok }) => (ok ? deleteFriendLog(row) : undefined))
    .catch(logFriendLogError);
}

function deleteFriendLog(row: FriendLogHistoryRow) {
  removeFromArray(friendLogTable.value.data, row);
  if (isDeletableFriendLogRow(row)) {
    void database
      .deleteFriendLogHistory(row)
      .then(() => loadPage(true))
      .catch(logFriendLogError);
  }
}

const columns = createColumns({
  onDelete: deleteFriendLog,
  onDeletePrompt: deleteFriendLogPrompt,
});

const pageSizes = computed(() => appearanceSettingsStore.tablePageSizes);

const { table, pagination, sorting } = useVrcxVueTable({
  persistKey: "friendLog",
  get data() {
    return friendLogTable.value.data;
  },
  columns,
  getRowId: (row) => `${row.type ?? ""}:${row.rowId ?? row.userId ?? row.created_at ?? ""}`,
  initialSorting: [],
  initialPagination: {
    pageIndex: 0,
    pageSize: appearanceSettingsStore.tablePageSize,
  },
  tableOptions: {
    autoResetPageIndex: false,
    manualPagination: true,
    manualSorting: true,
    manualFiltering: true,
    get rowCount() {
      return friendLogHistoryTotal.value;
    },
  },
});

const totalItems = computed(() => {
  return friendLogHistoryTotal.value;
});

function canLoadPage() {
  return isViewMounted && watchState.isLoggedIn;
}

async function loadPage(shouldRefresh = false) {
  if (!canLoadPage()) {
    return;
  }
  await database.waitForFriendLogHistoryWrites();
  if (!canLoadPage()) {
    return;
  }
  await friendStore.loadFriendLogHistoryPage(
    pagination.value.pageIndex,
    pagination.value.pageSize,
    sorting.value.some((entry) => entry.id === "created_at" && !entry.desc),
    shouldRefresh
  );
}

watch(
  [() => watchState.isLoggedIn, friendLogTypeFilter, friendLogSearch, () => hideUnfriends.value, sorting, () => pagination.value.pageSize],
  () => {
    pagination.value = { ...pagination.value, pageIndex: 0 };
    if (watchState.isLoggedIn) {
      void loadPage(true).catch(logFriendLogError);
    }
  },
  { deep: true, immediate: true }
);

watch(
  () => pagination.value.pageIndex,
  () => void loadPage().catch(logFriendLogError)
);

watch(
  () => friendLogTable.value.data.some((row) => row.rowId == null),
  (hasLiveRows) => {
    if (hasLiveRows) {
      void loadPage(true).catch(logFriendLogError);
    }
  }
);

const handlePageSizeChange = (size: number) => {
  pagination.value = {
    ...pagination.value,
    pageIndex: 0,
    pageSize: size,
  };
};
</script>
