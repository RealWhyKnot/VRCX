<script setup lang="ts" generic="TData extends RowData">
import type { CSSProperties } from "vue";
import { computed, ref } from "vue";
import { FlexRender, type RowData } from "@tanstack/vue-table";
import { GripVertical } from "lucide-vue-next";
import { useSortable } from "@dnd-kit/vue/sortable";
import type { useVrcxVueTable } from "@/lib/table/use-vrcx-vue-table";

import TableHead from "../table/TableHead.vue";

type DataTable = ReturnType<typeof useVrcxVueTable<TData>>["table"];
type HeaderItem = ReturnType<DataTable["getHeaderGroups"]>[number]["headers"][number];

const props = withDefaults(
  defineProps<{
    header: HeaderItem;
    index: number;
    headerClass?: string;
    pinnedStyle?: CSSProperties | null;
    disabled?: boolean;
  }>(),
  {
    headerClass: "",
    pinnedStyle: null,
    disabled: false,
  }
);

const element = ref(null);

const { isDragSource } = useSortable({
  id: computed(() => props.header.id),
  index: computed(() => props.index),
  element,
  disabled: computed(() => props.disabled),
});
</script>

<template>
  <TableHead ref="element" :class="[headerClass, isDragSource && 'opacity-50', !disabled && 'cursor-grab active:cursor-grabbing']" :style="pinnedStyle">
    <template v-if="!header.isPlaceholder">
      <div class="flex items-center">
        <GripVertical v-if="!disabled" class="size-3.5 shrink-0 text-muted-foreground/50 -ml-1 mr-0.5 hidden group-hover:block transition-opacity" />
        <FlexRender :render="header.column.columnDef.header" :props="header.getContext()" />
      </div>
      <div
        v-if="header.column.getCanResize?.()"
        class="absolute right-0 top-0 h-full w-2 cursor-col-resize touch-none select-none opacity-0 transition-opacity group-hover:opacity-100"
        @pointerdown.stop
        @mousedown.stop="header.getResizeHandler?.()($event)"
        @touchstart.stop="header.getResizeHandler?.()($event)"
      >
        <div class="absolute right-0 top-0 h-full w-px bg-border dark:bg-border dark:brightness-[2]" />
      </div>
    </template>
  </TableHead>
</template>
