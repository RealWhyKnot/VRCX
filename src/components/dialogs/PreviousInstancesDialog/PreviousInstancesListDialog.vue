<template>
  <div>
    <DialogHeader>
      <DialogTitle>{{ t("dialog.previous_instances.header") }}</DialogTitle>
    </DialogHeader>

    <DataTableLayout
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
          <span class="text-sm" v-text="headerText"></span>
          <InputGroupField v-model="search" :placeholder="t('dialog.previous_instances.search_placeholder')" clearable class="w-1/3 block" />
        </div>
      </template>
    </DataTableLayout>
  </div>
</template>

<script setup lang="ts">
defineOptions({ name: "PreviousInstancesListDialog" });

import { computed, ref, watch } from "vue";
import DialogHeader from "@/components/ui/dialog/DialogHeader.vue";
import DialogTitle from "@/components/ui/dialog/DialogTitle.vue";
import InputGroupField from "@/components/ui/input-group/InputGroupField.vue";
import { storeToRefs } from "pinia";
import { useI18n } from "vue-i18n";

import { useInstanceStore } from "../../../stores/instance";
import { useLaunchStore } from "../../../stores/launch";
import { useModalStore } from "../../../stores/modal";
import { useSearchStore } from "../../../stores/search";
import { useUiStore } from "../../../stores/ui";
import { useUserStore } from "../../../stores/user";
import { compareByCreatedAt } from "../../../shared/utils/compare";
import { localeIncludes } from "../../../shared/utils/base/string";
import { parseLocation } from "../../../shared/utils/location-parser";
import { removeFromArray } from "../../../shared/utils/base/array";
import { timeToText } from "../../../shared/utils/base/format";
import DataTableLayout from "../../ui/data-table/DataTableLayout.vue";
import type { PreviousInstancesTableState, PreviousInstancesVariant } from "../../../stores/instance-types";
import { createPreviousInstancesColumns, type PreviousInstanceRow } from "./previous-instances-columns.tsx";
import { database } from "../../../services/database";
import { useVrcxVueTable } from "../../../lib/table/use-vrcx-vue-table";
import { logError } from "../../../stores/vrcx-messages";

const props = defineProps<{
  variant: PreviousInstancesVariant;
}>();

const instanceStore = useInstanceStore();
const { showPreviousInstancesInfoDialog } = instanceStore;
const { previousInstancesListState, previousInstancesListDialog } = storeToRefs(instanceStore);
const { shiftHeld } = storeToRefs(useUiStore());
const { stringComparer } = storeToRefs(useSearchStore());
const { currentUser } = storeToRefs(useUserStore());
const { showLaunchDialog } = useLaunchStore();
const modalStore = useModalStore();
const { t } = useI18n();

const dialogState = computed(() => {
  return previousInstancesListDialog.value;
});

const getListState = () => previousInstancesListState.value[props.variant];

const loading = ref(false);
const rawRows = ref<PreviousInstanceRow[]>([]);
const pageSizes = [10, 25, 50, 100];
const pageSize = computed({
  get: () => getListState().pageSize,
  set: (value) => {
    getListState().pageSize = value;
  },
});
const tableStyle = { maxHeight: "100%" };
const search = computed({
  get: () => getListState().search,
  set: (value) => {
    getListState().search = value;
  },
});
const sortBy = computed({
  get: () => getListState().sortBy,
  set: (value) => {
    getListState().sortBy = value;
  },
});

const headerText = computed(() => {
  const state = dialogState.value;
  if (props.variant === "user") return state.userRef.displayName;
  if (props.variant === "world") return state.worldRef.name;
  return state.groupRef.name;
});

const currentId = computed(() => {
  if (props.variant === "user") return dialogState.value.userRef.id;
  if (props.variant === "world") return dialogState.value.worldRef.id;
  return dialogState.value.groupRef.id;
});

const persistKey = computed(() => {
  if (props.variant === "user") return "previousInstancesUserDialog";
  if (props.variant === "world") return "previousInstancesWorldDialog";
  return "previousInstancesGroupDialog";
});

const pageIndex = computed({
  get: () => getListState().pageIndex,
  set: (value) => {
    getListState().pageIndex = value;
  },
});

const displayRows = computed(() => {
  const q = search.value.trim().toLowerCase();
  const rows = Array.isArray(rawRows.value) ? rawRows.value : [];
  if (!q) return rows;
  return rows.filter((row) => {
    return (
      localeIncludes(row.worldName ?? "", q, stringComparer.value) ||
      localeIncludes(row.groupName ?? "", q, stringComparer.value) ||
      localeIncludes(row.location ?? "", q, stringComparer.value)
    );
  });
});

function deleteGameLogInstance(row: PreviousInstanceRow) {
  if (props.variant === "user") {
    database.deleteGameLogInstance({
      id: previousInstancesListDialog.value.userRef.id,
      displayName: previousInstancesListDialog.value.userRef.displayName,
      location: row.location,
      events: row.events ?? [],
    });
  } else {
    database.deleteGameLogInstanceByInstanceId({ location: row.location });
  }
  removeFromArray(rawRows.value, row);
}

function deleteGameLogInstancePrompt(row: PreviousInstanceRow) {
  const description = props.variant === "user" ? "Continue? Delete User From GameLog Instance" : "Continue? Delete GameLog Instance";
  modalStore
    .confirm({
      description,
      title: "Confirm",
    })
    .then(({ ok }) => {
      if (!ok) return;
      deleteGameLogInstance(row);
    })
    .catch(logError);
}

const handleShowInfo = (location: string) => {
  showPreviousInstancesInfoDialog(location);
};

const handleLaunch = (location: string | null) => {
  if (location) {
    void showLaunchDialog(location).catch(logError);
  }
};

const columns = computed(() =>
  createPreviousInstancesColumns(props.variant, {
    shiftHeld,
    currentUserId: currentUser.value.id,
    onLaunch: handleLaunch,
    onShowInfo: handleShowInfo,
    onDelete: deleteGameLogInstance,
    onDeletePrompt: deleteGameLogInstancePrompt,
  })
);

const { table } = useVrcxVueTable({
  persistKey: persistKey.value,
  get data() {
    return displayRows.value;
  },
  columns: columns.value,
  getRowId: (row) => `${row.location ?? ""}:${row.created_at ?? ""}`,
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

function toPreviousInstanceRow(item: Omit<PreviousInstanceRow, "$location" | "timer">): PreviousInstanceRow {
  return {
    ...item,
    $location: parseLocation(item.location),
    timer: item.time > 0 ? timeToText(item.time) : "",
  };
}

const refreshTable = async () => {
  loading.value = true;
  const array: PreviousInstanceRow[] = [];
  try {
    const D = previousInstancesListDialog.value;
    if (currentId.value !== D.lastId) {
      table.setPageIndex(0);
      pageIndex.value = 0;
      D.lastId = currentId.value;
    }
    if (props.variant === "user") {
      const data = await database.getPreviousInstancesByUserId(D.userRef);
      for (const item of data.values()) {
        array.push(toPreviousInstanceRow(item));
      }
    } else if (props.variant === "world") {
      const data = await database.getPreviousInstancesByWorldId(D.worldRef.id);
      for (const item of data.values()) {
        array.push(toPreviousInstanceRow(item));
      }
    } else {
      const data = await database.getPreviousInstancesByGroupId(D.groupRef.id);
      for (const item of data.values()) {
        array.push(toPreviousInstanceRow(item));
      }
    }
    array.sort(compareByCreatedAt);
    rawRows.value = array;
  } finally {
    loading.value = false;
  }
};

watch(
  () => dialogState.value.visible,
  (isVisible) => {
    if (isVisible) {
      void refreshTable().catch(logError);
    }
  },
  { immediate: true }
);
</script>
