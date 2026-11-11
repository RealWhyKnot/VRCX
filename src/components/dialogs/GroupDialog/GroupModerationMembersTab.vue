<template>
  <div class="flex h-full min-h-0 flex-col gap-2">
    <div class="flex items-center gap-2">
      <Button class="rounded-full" variant="outline" size="icon-sm" :disabled="loading" @click="$emit('refresh')">
        <Spinner v-if="loading" />
        <RefreshCw v-else />
      </Button>
      <span class="text-sm tabular-nums shrink-0">{{ tableData.data.length }}/{{ groupRef.memberCount }}</span>
      <InputGroupField
        :model-value="memberSearch"
        :disabled="!hasGroupPermission(groupRef, 'group-bans-manage')"
        clearable
        size="sm"
        class="flex-1"
        :placeholder="t('dialog.group.members.search')"
        @update:model-value="$emit('update:memberSearch', $event)"
        @input="$emit('search')"
      />
      <DropdownMenu>
        <DropdownMenuTrigger as-child :disabled="sortFilterDisabled">
          <Button size="sm" variant="outline" :disabled="sortFilterDisabled" @click.stop>
            <span class="text-muted-foreground">{{ t("dialog.group.members.sort_by") }}</span>
            {{ t(memberSortOrder.name) }}
            <ArrowDown />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem v-for="item in sortingOptions" :key="item.name" @click="$emit('sort-change', item)">
            {{ t(item.name) }}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <DropdownMenu>
        <DropdownMenuTrigger as-child :disabled="sortFilterDisabled">
          <Button size="sm" variant="outline" :disabled="sortFilterDisabled" @click.stop>
            <span class="text-muted-foreground">{{ t("dialog.group.members.filter") }}</span>
            {{ t(memberFilter.name) }}
            <ArrowDown />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem v-for="item in filterOptions" :key="item.name" @click="$emit('filter-change', item)">
            {{ t(item.name) }}
          </DropdownMenuItem>
          <template v-for="role in roleFilterOptions" :key="role.name">
            <DropdownMenuItem @click="$emit('filter-change', role)">
              {{ t(role.name) }}
            </DropdownMenuItem>
          </template>
        </DropdownMenuContent>
      </DropdownMenu>
      <Button size="sm" variant="outline" @click="$emit('select-all', tableData.data)">{{ t("dialog.group_member_moderation.select_all") }}</Button>
    </div>
    <DataTableLayout
      v-if="tableData.data.length"
      auto-height
      :on-page-change="handlePageChange"
      :table="tanstackTable"
      :loading="loading"
      :page-sizes="pageSizes"
      :total-items="totalItems"
    />
  </div>
</template>

<script setup lang="ts">
import { ArrowDown, RefreshCw } from "lucide-vue-next";
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import Button from "@/components/ui/button/Button.vue";
import Spinner from "@/components/ui/spinner/Spinner.vue";
import InputGroupField from "@/components/ui/input-group/InputGroupField.vue";
import DropdownMenu from "@/components/ui/dropdown-menu/DropdownMenu.vue";
import DropdownMenuContent from "@/components/ui/dropdown-menu/DropdownMenuContent.vue";
import DropdownMenuItem from "@/components/ui/dropdown-menu/DropdownMenuItem.vue";
import DropdownMenuTrigger from "@/components/ui/dropdown-menu/DropdownMenuTrigger.vue";
import DataTableLayout from "@/components/ui/data-table/DataTableLayout.vue";
import { hasGroupPermission } from "@/shared/utils/group";
import { createColumns, type GroupMembersColumnContext } from "./group-member-moderation-members-columns.tsx";
import type { GroupFilterOption, GroupSortOption, ModerationRow } from "./group-moderation-types";
import type { GroupMemberModerationTable } from "../../../stores/group-types";
import type { VrcxGroup } from "../../../types/vrcx";
import { useVrcxVueTable } from "@/lib/table/use-vrcx-vue-table";

const props = withDefaults(
  defineProps<{
    loading?: boolean;
    tableData: GroupMemberModerationTable<ModerationRow>;
    groupRef?: Partial<VrcxGroup>;
    memberSortOrder: GroupSortOption;
    memberFilter: GroupFilterOption;
    memberSearch?: string;
    sortingOptions: GroupSortOption[];
    filterOptions: GroupFilterOption[];
    pageSizes: number[];
    columnContext: GroupMembersColumnContext;
    handlePageChange: (page: number) => void;
  }>(),
  {
    loading: false,
    groupRef: () => ({}),
    memberSearch: "",
  }
);

defineEmits<{
  refresh: [];
  "update:memberSearch": [value: string];
  search: [];
  "sort-change": [item: GroupSortOption];
  "filter-change": [item: GroupFilterOption];
  "select-all": [rows: ModerationRow[]];
}>();

const { t } = useI18n();

const sortFilterDisabled = computed(() => Boolean(props.loading || props.memberSearch.length || !hasGroupPermission(props.groupRef, "group-bans-manage")));

const roleFilterOptions = computed<GroupFilterOption[]>(() =>
  (props.groupRef.roles ?? []).flatMap((role) =>
    !role.defaultRole && typeof role.name === "string" && typeof role.id === "string" ? [{ name: role.name, id: role.id }] : []
  )
);

const columns = computed(() => createColumns(props.columnContext));

const { table: tanstackTable } = useVrcxVueTable({
  persistKey: "group-moderation:members",
  get data() {
    return computed(() => props.tableData.data).value;
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
