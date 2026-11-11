<template>
  <div class="x-container x-container--auto-height">
    <DataTableLayout
      :table="table"
      :loading="friendLogTable.loading"
      auto-height
      :page-sizes="pageSizes"
      :total-items="totalItems"
      :on-page-size-change="handlePageSizeChange"
    >
      <template #toolbar>
        <div class="mt-0 mx-0 mb-2" style="display: flex; align-items: center">
          <Select multiple :model-value="friendLogTypeFilter" @update:model-value="handleFriendLogFilterChange">
            <SelectTrigger class="w-full" style="flex: 1">
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
          <InputGroupField v-model="friendLogSearch" class="ml-2" :placeholder="t('view.friend_log.search_placeholder')" style="flex: 0.4" />
        </div>
      </template>
    </DataTableLayout>
  </div>
</template>

<script setup lang="ts">
import { computed, watch } from "vue";
import { storeToRefs } from "pinia";
import { useI18n } from "vue-i18n";

import dayjs from "dayjs";

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

const appearanceSettingsStore = useAppearanceSettingsStore();
const modalStore = useModalStore();
const { hideUnfriends } = storeToRefs(appearanceSettingsStore);
const { friendLogTable } = storeToRefs(useFriendStore());

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

const friendLogDisplayData = computed(() => {
  const data = friendLogTable.value.data;
  const typeSet = new Set(friendLogTypeFilter.value.map((value) => value.toLowerCase()));
  const isHideUnfriendsFilter = friendLogTable.value.filters[2]?.value === true;
  const searchValue = friendLogSearch.value.trim().toLowerCase();

  const filtered = data.filter((row) => {
    if (isHideUnfriendsFilter && row.type === "Unfriend") {
      return false;
    }
    if (typeSet.size > 0 && !typeSet.has((row.type ?? "").toLowerCase())) {
      return false;
    }
    if (searchValue && !(row.displayName ?? "").toLowerCase().includes(searchValue)) {
      return false;
    }
    return true;
  });

  return filtered.slice().sort((a, b) => {
    const aTs = dayjs(a.created_at ?? "").valueOf();
    const bTs = dayjs(b.created_at ?? "").valueOf();
    if (Number.isFinite(aTs) && Number.isFinite(bTs) && aTs !== bTs) {
      return bTs - aTs;
    }
    return (b.rowId ?? 0) - (a.rowId ?? 0);
  });
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
    database.deleteFriendLogHistory(row);
  }
}

const columns = createColumns({
  onDelete: deleteFriendLog,
  onDeletePrompt: deleteFriendLogPrompt,
});

const pageSizes = computed(() => appearanceSettingsStore.tablePageSizes);

const { table, pagination } = useVrcxVueTable({
  persistKey: "friendLog",
  get data() {
    return friendLogDisplayData.value;
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
</script>
