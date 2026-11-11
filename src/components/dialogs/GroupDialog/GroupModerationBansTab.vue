<template>
  <div class="flex h-full min-h-0 flex-col gap-2">
    <div class="flex justify-between">
      <div class="flex gap-2 items-center">
        <Button class="rounded-full" variant="outline" size="icon-sm" :disabled="loading" @click="$emit('refresh')">
          <Spinner v-if="loading" />
          <RefreshCw v-else />
        </Button>
        <Button size="sm" variant="outline" @click="$emit('select-all', tableData.data)">{{ t("dialog.group_member_moderation.select_all") }}</Button>
        <span class="text-sm mx-1.5">{{ tableData.data.length }}</span>
      </div>

      <div class="flex gap-2 items-center">
        <Button variant="outline" size="sm" :disabled="!tableData.data.length" @click="$emit('export')">{{
          t("dialog.group_member_moderation.export_bans")
        }}</Button>
        <Button variant="outline" size="sm" :disabled="!hasGroupPermission(groupRef, 'group-bans-manage')" @click="$emit('import')">{{
          t("dialog.group_member_moderation.import_bans")
        }}</Button>
        <InputGroupField v-model="searchText" clearable size="sm" class="w-80" :placeholder="t('dialog.group.members.search')" />
      </div>
    </div>

    <DataTableLayout
      auto-height
      :table="tanstackTable"
      :loading="loading"
      :page-sizes="pageSizes"
      :total-items="totalItems"
      :on-page-change="handlePageChange"
    />
  </div>
</template>

<script setup lang="ts">
import { RefreshCw } from "lucide-vue-next";
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import Button from "@/components/ui/button/Button.vue";
import Spinner from "@/components/ui/spinner/Spinner.vue";
import InputGroupField from "@/components/ui/input-group/InputGroupField.vue";
import DataTableLayout from "@/components/ui/data-table/DataTableLayout.vue";
import { hasGroupPermission } from "@/shared/utils/group";
import type { VrcxGroup } from "../../../types/vrcx";
import type { GroupMemberModerationTable } from "../../../stores/group-types";
import { createColumns, type GroupBansColumnContext } from "./group-member-moderation-bans-columns.tsx";
import type { ModerationRow } from "./group-moderation-types";
import { useGroupTableSearch } from "./use-group-table-search";
import { useVrcxVueTable } from "@/lib/table/use-vrcx-vue-table";

const props = withDefaults(
  defineProps<{
    loading?: boolean;
    tableData: GroupMemberModerationTable<ModerationRow>;
    groupRef?: Partial<VrcxGroup>;
    pageSizes: number[];
    columnContext: GroupBansColumnContext;
    handlePageChange: (page: number) => void;
  }>(),
  {
    loading: false,
    groupRef: () => ({}),
  }
);

defineEmits<{
  refresh: [];
  "select-all": [rows: ModerationRow[]];
  export: [];
  import: [];
}>();

const { t } = useI18n();

const { searchText, searchQuery } = useGroupTableSearch(() => props.tableData.filters);

const filteredRows = computed(() => {
  const rows = props.tableData.data;
  const q = searchQuery.value;
  if (!q) {
    return rows;
  }
  return rows.filter((r) => (r.$displayName ?? r.user?.displayName ?? "").toLowerCase().includes(q));
});

const columns = computed(() => createColumns(props.columnContext));

const { table: tanstackTable } = useVrcxVueTable({
  persistKey: "group-moderation:bans",
  get data() {
    return filteredRows.value;
  },
  columns,
  getRowId: (row) => String(row.userId),
  initialPagination: { pageIndex: props.tableData.pageIndex, pageSize: props.tableData.pageSize },
  tableOptions: {
    autoResetPageIndex: false,
  },
});

const totalItems = computed(() => tanstackTable.getFilteredRowModel().rows.length);
</script>
