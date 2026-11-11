<template>
  <div :class="['flex flex-col min-w-0 data-table', autoHeight && 'flex-1 min-h-0 overflow-hidden']">
    <div v-if="$slots['toolbar']" class="mb-2">
      <slot name="toolbar"></slot>
    </div>

    <div :class="['rounded-md border', autoHeight && 'flex-1 min-h-0 flex flex-col overflow-hidden']">
      <div ref="tableScrollRef" :class="['max-w-full overflow-auto relative', autoHeight && 'flex-1 min-h-0']" :style="tableStyle">
        <Table :class="tableClassValue" :style="tableElementStyle">
          <colgroup>
            <col v-for="col in table.getVisibleLeafColumns()" :key="col.id" :style="getColStyle(col)" />
          </colgroup>
          <ContextMenu v-if="showHeaderContextMenu">
            <ContextMenuTrigger as-child>
              <TableHeader>
                <TableRow v-for="headerGroup in table.getHeaderGroups()" :key="headerGroup.id">
                  <template v-if="effectiveColumnReorder">
                    <DragDropProvider :key="dndContextKey" @drag-end="onHeaderDragEnd">
                      <template v-for="(header, hIdx) in headerGroup.headers" :key="header.id">
                        <SortableTableHead
                          v-if="isReorderable(header)"
                          :header="header"
                          :index="reorderableIndex(headerGroup.headers, hIdx)"
                          :header-class="getHeaderClass(header)"
                          :pinned-style="getPinnedStyle(header.column)"
                        />
                        <TableHead v-else :class="getHeaderClass(header)" :style="getPinnedStyle(header.column)">
                          <template v-if="!header.isPlaceholder">
                            <FlexRender :render="header.column.columnDef.header" :props="header.getContext()" />
                            <div
                              v-if="header.column.getCanResize?.()"
                              class="absolute right-0 top-0 h-full w-2 cursor-col-resize touch-none select-none opacity-0 transition-opacity group-hover:opacity-100"
                              @mousedown.stop="header.getResizeHandler?.()($event)"
                              @touchstart.stop="header.getResizeHandler?.()($event)"
                            >
                              <div class="absolute right-0 top-0 h-full w-px bg-border dark:bg-border dark:brightness-[2]" />
                            </div>
                          </template>
                        </TableHead>
                      </template>
                    </DragDropProvider>
                  </template>
                  <template v-else>
                    <TableHead v-for="header in headerGroup.headers" :key="header.id" :class="getHeaderClass(header)" :style="getPinnedStyle(header.column)">
                      <template v-if="!header.isPlaceholder">
                        <FlexRender :render="header.column.columnDef.header" :props="header.getContext()" />
                        <div
                          v-if="header.column.getCanResize?.()"
                          class="absolute right-0 top-0 h-full w-2 cursor-col-resize touch-none select-none opacity-0 transition-opacity group-hover:opacity-100"
                          @mousedown.stop="header.getResizeHandler?.()($event)"
                          @touchstart.stop="header.getResizeHandler?.()($event)"
                        >
                          <div class="absolute right-0 top-0 h-full w-px bg-border dark:bg-border dark:brightness-[2]" />
                        </div>
                      </template>
                    </TableHead>
                  </template>
                </TableRow>
              </TableHeader>
            </ContextMenuTrigger>
            <ContextMenuContent class="w-48">
              <ContextMenuCheckboxItem
                v-for="col in toggleableColumns"
                :key="col.id"
                :model-value="col.getIsVisible()"
                @select.prevent
                @update:model-value="col.toggleVisibility(!!$event)"
              >
                {{ resolveHeaderLabel(col) }}
              </ContextMenuCheckboxItem>
              <template v-if="tcColumnOrderLocked != null">
                <ContextMenuSeparator />
                <ContextMenuCheckboxItem :model-value="tcColumnOrderLocked" @select.prevent @update:model-value="setColumnOrderLocked">
                  {{ t("table.header_menu.lock_column_order") }}
                </ContextMenuCheckboxItem>
              </template>
              <template v-if="tcResetAll">
                <ContextMenuSeparator />
                <ContextMenuItem inset @select="tcResetAll">
                  {{ t("table.header_menu.reset_all") }}
                </ContextMenuItem>
              </template>
            </ContextMenuContent>
          </ContextMenu>
          <ContextMenu v-else-if="showHeaderContextMenuNoVisibility">
            <ContextMenuTrigger as-child>
              <TableHeader>
                <TableRow v-for="headerGroup in table.getHeaderGroups()" :key="headerGroup.id">
                  <template v-if="effectiveColumnReorder">
                    <DragDropProvider :key="dndContextKey" @drag-end="onHeaderDragEnd">
                      <template v-for="(header, hIdx) in headerGroup.headers" :key="header.id">
                        <SortableTableHead
                          v-if="isReorderable(header)"
                          :header="header"
                          :index="reorderableIndex(headerGroup.headers, hIdx)"
                          :header-class="getHeaderClass(header)"
                          :pinned-style="getPinnedStyle(header.column)"
                        />
                        <TableHead v-else :class="getHeaderClass(header)" :style="getPinnedStyle(header.column)">
                          <template v-if="!header.isPlaceholder">
                            <FlexRender :render="header.column.columnDef.header" :props="header.getContext()" />
                            <div
                              v-if="header.column.getCanResize?.()"
                              class="absolute right-0 top-0 h-full w-2 cursor-col-resize touch-none select-none opacity-0 transition-opacity group-hover:opacity-100"
                              @mousedown.stop="header.getResizeHandler?.()($event)"
                              @touchstart.stop="header.getResizeHandler?.()($event)"
                            >
                              <div class="absolute right-0 top-0 h-full w-px bg-border dark:bg-border dark:brightness-[2]" />
                            </div>
                          </template>
                        </TableHead>
                      </template>
                    </DragDropProvider>
                  </template>
                  <template v-else>
                    <TableHead v-for="header in headerGroup.headers" :key="header.id" :class="getHeaderClass(header)" :style="getPinnedStyle(header.column)">
                      <template v-if="!header.isPlaceholder">
                        <FlexRender :render="header.column.columnDef.header" :props="header.getContext()" />
                        <div
                          v-if="header.column.getCanResize?.()"
                          class="absolute right-0 top-0 h-full w-2 cursor-col-resize touch-none select-none opacity-0 transition-opacity group-hover:opacity-100"
                          @mousedown.stop="header.getResizeHandler?.()($event)"
                          @touchstart.stop="header.getResizeHandler?.()($event)"
                        >
                          <div class="absolute right-0 top-0 h-full w-px bg-border dark:bg-border dark:brightness-[2]" />
                        </div>
                      </template>
                    </TableHead>
                  </template>
                </TableRow>
              </TableHeader>
            </ContextMenuTrigger>
            <ContextMenuContent class="w-48">
              <template v-if="tcColumnOrderLocked != null">
                <ContextMenuCheckboxItem :model-value="tcColumnOrderLocked" @select.prevent @update:model-value="setColumnOrderLocked">
                  {{ t("table.header_menu.lock_column_order") }}
                </ContextMenuCheckboxItem>
              </template>
              <template v-if="tcResetAll">
                <ContextMenuSeparator v-if="tcColumnOrderLocked != null" />
                <ContextMenuItem inset @select="tcResetAll">
                  {{ t("table.header_menu.reset_all") }}
                </ContextMenuItem>
              </template>
            </ContextMenuContent>
          </ContextMenu>
          <TableHeader v-else>
            <TableRow v-for="headerGroup in table.getHeaderGroups()" :key="headerGroup.id">
              <TableHead v-for="header in headerGroup.headers" :key="header.id" :class="getHeaderClass(header)" :style="getPinnedStyle(header.column)">
                <template v-if="!header.isPlaceholder">
                  <FlexRender :render="header.column.columnDef.header" :props="header.getContext()" />
                  <div
                    v-if="header.column.getCanResize?.()"
                    class="absolute right-0 top-0 h-full w-2 cursor-col-resize touch-none select-none opacity-0 transition-opacity group-hover:opacity-100"
                    @mousedown.stop="header.getResizeHandler?.()($event)"
                    @touchstart.stop="header.getResizeHandler?.()($event)"
                  >
                    <div class="absolute right-0 top-0 h-full w-px bg-border dark:bg-border dark:brightness-[2]" />
                  </div>
                </template>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <template v-if="table.getRowModel().rows?.length">
              <template v-for="row in table.getRowModel().rows" :key="row.id">
                <ContextMenu v-if="$slots['row-context-menu']">
                  <ContextMenuTrigger as-child>
                    <TableRow :class="['group/row', isDataTableStriped ? 'even:bg-muted/20' : '', rowClass?.(row) ?? '']" @click="handleRowClick(row)">
                      <TableCell v-for="cell in row.getVisibleCells()" :key="cell.id" :class="getCellClass(cell)" :style="getPinnedStyle(cell.column)">
                        <FlexRender :render="cell.column.columnDef.cell" :props="cell.getContext()" />
                      </TableCell>
                    </TableRow>
                  </ContextMenuTrigger>
                  <slot name="row-context-menu" :row="row" />
                </ContextMenu>
                <TableRow v-else :class="['group/row', isDataTableStriped ? 'even:bg-muted/20' : '', rowClass?.(row) ?? '']" @click="handleRowClick(row)">
                  <TableCell v-for="cell in row.getVisibleCells()" :key="cell.id" :class="getCellClass(cell)" :style="getPinnedStyle(cell.column)">
                    <FlexRender :render="cell.column.columnDef.cell" :props="cell.getContext()" />
                  </TableCell>
                </TableRow>
                <TableRow v-if="row.getIsExpanded() && (expandedRenderer || $slots['expanded'])">
                  <TableCell :colspan="row.getVisibleCells().length">
                    <template v-if="$slots['expanded']">
                      <slot name="expanded" :row="row"></slot>
                    </template>
                    <template v-else>
                      <FlexRender :render="expandedRenderer" :props="{ row }" />
                    </template>
                  </TableCell>
                </TableRow>
              </template>
            </template>

            <TableRow v-else>
              <TableCell class="h-24 text-center" :colspan="table.getVisibleLeafColumns().length">
                <slot name="empty">
                  <DataTableEmpty v-if="!loading" :type="emptyType" />
                </slot>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
        <div v-if="loading" class="absolute inset-0 z-20 flex items-center justify-center bg-background/60">
          <Spinner class="text-2xl" />
        </div>
      </div>
    </div>

    <div v-if="showPagination" class="dt-pagination mt-4 flex w-full items-center gap-3 mb-1">
      <div v-if="pageSizes.length" class="dt-pagination-sizes inline-flex items-center flex-1 justify-end gap-2">
        <span class="text-xs text-muted-foreground truncate">{{ t("table.pagination.rows_per_page") }}</span>
        <Select v-model="pageSizeValue">
          <SelectTrigger size="sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem v-for="size in pageSizes" :key="String(size)" :value="String(size)">
              {{ size }}
            </SelectItem>
          </SelectContent>
        </Select>
      </div>
      <Pagination v-model:page="currentPage" :total="totalItems" :items-per-page="pageSizeProxy" :sibling-count="1" show-edges class="flex-none">
        <PaginationContent v-slot="{ items }">
          <PaginationPrevious />
          <template v-for="(item, index) in items" :key="item.type === 'page' ? `page-${item.value}` : `ellipsis-${index}`">
            <PaginationItem v-if="item.type === 'page'" :value="item.value" :is-active="item.value === currentPage">
              {{ item.value }}
            </PaginationItem>
            <PaginationEllipsis v-else />
          </template>
          <PaginationNext />
        </PaginationContent>
      </Pagination>
      <div class="dt-pagination-spacer flex-1"></div>
    </div>
  </div>
</template>

<script setup lang="ts" generic="TData extends RowData">
import { computed, nextTick, ref, watch, type CSSProperties } from "vue";
import { DragDropProvider, type DragEndEvent } from "@dnd-kit/vue";
import { FlexRender, type RowData, type SortingState } from "@tanstack/vue-table";
import Spinner from "@/components/ui/spinner/Spinner.vue";
import { isSortable } from "@dnd-kit/vue/sortable";
import { storeToRefs } from "pinia";
import { useAppearanceSettingsStore } from "@/stores/settings/appearance";
import { useI18n } from "vue-i18n";
import type { useVrcxVueTable } from "@/lib/table/use-vrcx-vue-table";

import ContextMenu from "../context-menu/ContextMenu.vue";
import ContextMenuCheckboxItem from "../context-menu/ContextMenuCheckboxItem.vue";
import ContextMenuContent from "../context-menu/ContextMenuContent.vue";
import ContextMenuItem from "../context-menu/ContextMenuItem.vue";
import ContextMenuSeparator from "../context-menu/ContextMenuSeparator.vue";
import ContextMenuTrigger from "../context-menu/ContextMenuTrigger.vue";
import Pagination from "../pagination/Pagination.vue";
import PaginationContent from "../pagination/PaginationContent.vue";
import PaginationEllipsis from "../pagination/PaginationEllipsis.vue";
import PaginationItem from "../pagination/PaginationItem.vue";
import PaginationNext from "../pagination/PaginationNext.vue";
import PaginationPrevious from "../pagination/PaginationPrevious.vue";
import Table from "../table/Table.vue";
import TableBody from "../table/TableBody.vue";
import TableCell from "../table/TableCell.vue";
import TableHead from "../table/TableHead.vue";
import TableHeader from "../table/TableHeader.vue";
import TableRow from "../table/TableRow.vue";
import Select from "../select/Select.vue";
import SelectContent from "../select/SelectContent.vue";
import SelectItem from "../select/SelectItem.vue";
import SelectTrigger from "../select/SelectTrigger.vue";
import SelectValue from "../select/SelectValue.vue";
import { asRecord, getColStyle, getToggleableColumns, isReorderable as isReorderableHelper, isSpacer, resolveHeaderLabel } from "./data-table-helpers.ts";

import DataTableEmpty from "./DataTableEmpty.vue";
import SortableTableHead from "./SortableTableHead.vue";

const appearanceSettingsStore = useAppearanceSettingsStore();
const { isDataTableStriped } = storeToRefs(appearanceSettingsStore);

type DataTable = ReturnType<typeof useVrcxVueTable<TData>>["table"];
type RowItem = ReturnType<DataTable["getRowModel"]>["rows"][number];
type CellItem = ReturnType<RowItem["getVisibleCells"]>[number];
type HeaderItem = ReturnType<DataTable["getHeaderGroups"]>[number]["headers"][number];
type ColumnItem = ReturnType<DataTable["getAllLeafColumns"]>[number];
type ClassInput = string | false | null | undefined;

const props = withDefaults(
  defineProps<{
    table: DataTable;
    tableClass?: string | string[] | null | undefined;
    tableStyle?: CSSProperties | null | undefined;
    loading?: boolean;
    totalItems?: number;
    pageSizes?: number[];
    showPagination?: boolean;
    onPageSizeChange?: ((size: number) => void) | null | undefined;
    onPageChange?: ((page: number) => void) | null | undefined;
    onSortChange?: ((sorting: SortingState) => void) | null | undefined;
    onRowClick?: ((row: RowItem) => void) | null | undefined;
    rowClass?: ((row: RowItem) => string | null | undefined) | null | undefined;
    enableColumnReorder?: boolean;
    enableColumnVisibility?: boolean;
    autoHeight?: boolean;
  }>(),
  {
    tableClass: null,
    tableStyle: null,
    loading: false,
    totalItems: 0,
    pageSizes: () => [],
    showPagination: true,
    onPageSizeChange: null,
    onPageChange: null,
    onSortChange: null,
    onRowClick: null,
    rowClass: null,
    enableColumnReorder: true,
    enableColumnVisibility: true,
    autoHeight: false,
  }
);

const { t } = useI18n();
const tableScrollRef = ref<HTMLElement | null>(null);

const tableMeta = computed(() => props.table.options.meta);

const tcResetAll = computed(() => tableMeta.value?.resetAll ?? null);
const tcColumnOrderLocked = computed(() => tableMeta.value?.columnOrderLocked?.value ?? null);

const setColumnOrderLocked = (isLocked: boolean) => {
  const columnOrderLocked = tableMeta.value?.columnOrderLocked;
  if (columnOrderLocked) columnOrderLocked.value = isLocked;
};

const showHeaderContextMenu = computed(() => props.enableColumnVisibility || tcResetAll.value !== null || tcColumnOrderLocked.value != null);

const showHeaderContextMenuNoVisibility = computed(() => !props.enableColumnVisibility && (tcResetAll.value !== null || tcColumnOrderLocked.value != null));

const effectiveColumnReorder = computed(() => props.enableColumnReorder && tcColumnOrderLocked.value !== true);

const dndContextKey = computed(() =>
  props.table
    .getVisibleLeafColumns()
    .map((c) => c.id)
    .join(",")
);

const emptyType = computed(() => (props.table.getCoreRowModel().rows.length === 0 ? "nodata" : "nomatch"));

const expandedRenderer = computed(() => {
  for (const column of props.table.getAllColumns()) {
    const expandedRow = asRecord(column.columnDef.meta)["expandedRow"];
    if (expandedRow) {
      return expandedRow;
    }
  }
  return null;
});

const joinClasses = (...values: (ClassInput | ClassInput[])[]) =>
  values
    .flatMap((value) => (Array.isArray(value) ? value : [value]))
    .filter(Boolean)
    .join(" ");

const tableClassValue = computed(() => joinClasses("table-fixed w-full", props.tableClass));

const tableElementStyle = computed(() => {
  const size = props.table.getTotalSize();
  if (!Number.isFinite(size) || size <= 0) return undefined;
  return { minWidth: `${size}px` };
});

const isClassGetter = (value: unknown): value is (ctx: unknown) => ClassInput => typeof value === "function";

const resolveClassValue = (value: unknown, ctx: unknown): ClassInput => {
  if (isClassGetter(value)) {
    return value(ctx);
  }
  return typeof value === "string" ? value : undefined;
};

const getPinnedState = (col: ColumnItem) => {
  try {
    return col.getIsPinned();
  } catch {
    return false;
  }
};

const getPinnedStyle = (col: ColumnItem) => {
  const pinned = getPinnedState(col);
  if (!pinned) return null;

  if (pinned === "start") {
    const left = col.getStart("start");
    return { left: `${left}px` };
  }

  const right = col.getAfter("end");
  return { right: `${right}px` };
};

const isReorderable = (header: HeaderItem | undefined) => isReorderableHelper(header, getPinnedState);

const reorderableIndex = (headers: HeaderItem[], actualIndex: number) => {
  let sortableIdx = 0;
  for (let i = 0; i < actualIndex; i++) {
    if (isReorderable(headers[i])) {
      sortableIdx++;
    }
  }
  return sortableIdx;
};

const onHeaderDragEnd = (event: DragEndEvent) => {
  if (event.canceled) return;
  const { source } = event.operation;
  if (!isSortable(source)) return;

  const { initialIndex, index } = source;
  if (initialIndex === index) return;

  const allColumns = props.table.getVisibleLeafColumns();
  const reorderableIds = allColumns
    .filter((col) => {
      if (isSpacer(col)) return false;
      const meta = asRecord(col.columnDef.meta);
      if (!meta["label"]) return false;
      if (getPinnedState(col)) return false;
      if (meta["disableReorder"]) return false;
      return true;
    })
    .map((col) => col.id);

  const newOrder = [...reorderableIds];
  const [moved] = newOrder.splice(initialIndex, 1);
  if (moved === undefined) return;
  newOrder.splice(index, 0, moved);

  const fixedBefore: string[] = [];
  const fixedAfter: string[] = [];
  for (const col of allColumns) {
    if (!reorderableIds.includes(col.id)) {
      const colIdx = allColumns.indexOf(col);
      const firstReorderableIdx = allColumns.findIndex((c) => reorderableIds.includes(c.id));
      if (colIdx < firstReorderableIdx || firstReorderableIdx === -1) {
        fixedBefore.push(col.id);
      } else {
        fixedAfter.push(col.id);
      }
    }
  }

  const fullOrder = [...fixedBefore, ...newOrder, ...fixedAfter];
  props.table.setColumnOrder(fullOrder);
};

const toggleableColumns = computed(() => getToggleableColumns(props.table.getAllLeafColumns()));

const getHeaderClass = (header: HeaderItem) => {
  const column = header.column;
  const columnDef = asRecord(column.columnDef);
  const meta = asRecord(column.columnDef.meta);
  const pinned = getPinnedState(column);
  return joinClasses(
    "sticky top-0 bg-background dark:bg-sidebar border-b border-border group",
    pinned ? "z-30" : "z-10",
    isSpacer(column) && "p-0",
    resolveClassValue(meta["class"], header.getContext()),
    resolveClassValue(meta["headerClass"], header.getContext()),
    resolveClassValue(meta["thClass"], header.getContext()),
    resolveClassValue(columnDef["class"], header.getContext()),
    resolveClassValue(columnDef["headerClass"], header.getContext())
  );
};

const getCellClass = (cell: CellItem) => {
  const columnDef = asRecord(cell.column.columnDef);
  const meta = asRecord(cell.column.columnDef.meta);
  const pinned = getPinnedState(cell.column);
  return joinClasses(
    pinned && "sticky bg-background z-20",
    isSpacer(cell.column) && "p-0",
    resolveClassValue(meta["class"], cell.getContext()),
    resolveClassValue(meta["cellClass"], cell.getContext()),
    resolveClassValue(meta["tdClass"], cell.getContext()),
    resolveClassValue(columnDef["class"], cell.getContext()),
    resolveClassValue(columnDef["cellClass"], cell.getContext())
  );
};

const handlePageSizeChange = (size: number) => {
  props.onPageSizeChange?.(size);
  props.table.setPageSize(size);
};

const pageSizeProxy = computed({
  get: () => props.table.atoms.pagination.get().pageSize,
  set: (size: number) => handlePageSizeChange(size),
});

watch(
  [pageSizeProxy, () => props.pageSizes],
  ([current, sizes]) => {
    if (!sizes.length || sizes.includes(current)) {
      return;
    }
    const nearest = sizes.reduce((prev, s) => (Math.abs(s - current) < Math.abs(prev - current) ? s : prev));
    handlePageSizeChange(nearest);
  },
  { immediate: true }
);

const pageSizeValue = computed({
  get: () => String(pageSizeProxy.value),
  set: (value: string) => handlePageSizeChange(Number(value)),
});

const currentPage = computed({
  get: () => props.table.atoms.pagination.get().pageIndex + 1,
  set: (page: number) => {
    props.table.setPageIndex(page - 1);
    props.onPageChange?.(page);
  },
});

const sortBy = computed(() => props.table.atoms.sorting.get());

watch(sortBy, (newSorting) => {
  props.onSortChange?.(newSorting);
});

watch(
  () => props.table.getPageCount(),
  (pageCount) => {
    if (pageCount <= 0) return;
    const pageIndex = props.table.atoms.pagination.get().pageIndex;
    if (pageIndex >= pageCount) {
      props.table.setPageIndex(pageCount - 1);
    }
  }
);

watch([currentPage, pageSizeProxy], async () => {
  await nextTick();
  if (tableScrollRef.value) {
    tableScrollRef.value.scrollTop = 0;
  }
});

const handleRowClick = (row: RowItem) => {
  props.onRowClick?.(row);
};
</script>
