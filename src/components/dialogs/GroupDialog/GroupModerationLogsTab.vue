<template>
  <div class="flex h-full min-h-0 flex-col gap-2">
    <div class="flex items-center gap-2">
      <Button class="rounded-full" variant="outline" size="icon-sm" :disabled="loading" @click="emit('refresh')">
        <Spinner v-if="loading" />
        <RefreshCw v-else />
      </Button>
      <span class="text-sm tabular-nums shrink-0">{{ tableData.data.length }}</span>
      <Select v-model="selectedAuditLogTypes" multiple>
        <SelectTrigger size="sm" class="w-64 shrink-0">
          <SelectValue :placeholder="t('dialog.group_member_moderation.filter_type')" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem v-for="type in auditLogTypes" :key="type" :value="type">
            {{ getAuditLogTypeName(type) }}
          </SelectItem>
        </SelectContent>
      </Select>
      <InputGroupField v-model="searchText" clearable size="sm" class="flex-1" :placeholder="t('dialog.group.members.search')" />
      <Button size="sm" variant="outline" @click="emit('export')">{{ t("dialog.group_member_moderation.export_logs") }}</Button>
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
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import Button from "@/components/ui/button/Button.vue";
import Spinner from "@/components/ui/spinner/Spinner.vue";
import InputGroupField from "@/components/ui/input-group/InputGroupField.vue";
import Select from "@/components/ui/select/Select.vue";
import SelectContent from "@/components/ui/select/SelectContent.vue";
import SelectItem from "@/components/ui/select/SelectItem.vue";
import SelectTrigger from "@/components/ui/select/SelectTrigger.vue";
import SelectValue from "@/components/ui/select/SelectValue.vue";
import DataTableLayout from "@/components/ui/data-table/DataTableLayout.vue";
import type { GroupMemberModerationTable } from "../../../stores/group-types";
import { getAuditLogTypeName } from "./group-moderation-utils";
import { createColumns, type GroupLogsColumnContext } from "./group-member-moderation-logs-columns.tsx";
import type { ModerationLogRow } from "./group-moderation-types";
import { useGroupTableSearch } from "./use-group-table-search";
import { useVrcxVueTable } from "@/lib/table/use-vrcx-vue-table";

const props = withDefaults(
  defineProps<{
    loading?: boolean;
    tableData: GroupMemberModerationTable<ModerationLogRow>;
    auditLogTypes?: string[];
    pageSizes: number[];
    columnContext: GroupLogsColumnContext;
    handlePageChange: (page: number) => void;
  }>(),
  {
    loading: false,
    auditLogTypes: () => [],
  }
);

const emit = defineEmits<{
  refresh: [];
  export: [];
}>();

const { t } = useI18n();

const selectedAuditLogTypes = ref<string[]>([]);

defineExpose({ selectedAuditLogTypes });

const { searchText, searchQuery } = useGroupTableSearch(() => props.tableData.filters);

const filteredRows = computed(() => {
  const rows = props.tableData.data;
  const q = searchQuery.value;
  if (!q) {
    return rows;
  }
  return rows.filter((r) => (r.description ?? "").toLowerCase().includes(q));
});

const columns = computed(() => createColumns(props.columnContext));

const { table: tanstackTable } = useVrcxVueTable({
  persistKey: "group-moderation:logs",
  get data() {
    return filteredRows.value;
  },
  columns,
  getRowId: (row) => row.id,
  initialPagination: { pageIndex: props.tableData.pageIndex, pageSize: props.tableData.pageSize },
  tableOptions: {
    autoResetPageIndex: false,
  },
});

const totalItems = computed(() => tanstackTable.getFilteredRowModel().rows.length);
</script>
