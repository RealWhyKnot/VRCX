<template>
  <div class="relative h-full min-h-[180px]">
    <div v-if="isEditing" class="flex h-full gap-2" :class="isVertical ? 'flex-col' : 'flex-row'">
      <DashboardPanel
        v-for="(panelItem, panelIndex) in row.panels"
        :key="panelIndex"
        :panel-data="panelItem"
        :is-editing="true"
        :show-remove="true"
        :class="panelEditClass"
        @select="(value) => emit('update-panel', rowIndex, panelIndex, value)"
        @remove="emit('remove-panel', rowIndex, panelIndex)"
      />
    </div>

    <ResizablePanelGroup
      v-else-if="row.panels.length === 2"
      :direction="isVertical ? 'vertical' : 'horizontal'"
      :auto-save-id="`dashboard-${dashboardId}-row-${rowIndex}`"
      class="h-full min-h-[180px]"
    >
      <ResizablePanel :default-size="50" :min-size="20">
        <DashboardPanel :panel-data="row.panels[0] ?? null" class="h-full" @select="(value) => emit('update-panel', rowIndex, 0, value)" />
      </ResizablePanel>
      <ResizableHandle />
      <ResizablePanel :default-size="50" :min-size="20">
        <DashboardPanel :panel-data="row.panels[1] ?? null" class="h-full" @select="(value) => emit('update-panel', rowIndex, 1, value)" />
      </ResizablePanel>
    </ResizablePanelGroup>

    <div v-else class="h-full">
      <DashboardPanel :panel-data="row.panels[0] ?? null" class="h-full" @select="(value) => emit('update-panel', rowIndex, 0, value)" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";

import ResizableHandle from "@/components/ui/resizable/ResizableHandle.vue";
import ResizablePanel from "@/components/ui/resizable/ResizablePanel.vue";
import ResizablePanelGroup from "@/components/ui/resizable/ResizablePanelGroup.vue";

import DashboardPanel from "./DashboardPanel.vue";
import type { DashboardPanelValue, DashboardRowValue } from "../types";

const props = withDefaults(
  defineProps<{
    row: DashboardRowValue;
    rowIndex: number;
    dashboardId: string;
    isEditing?: boolean;
  }>(),
  {
    isEditing: false,
  }
);

const emit = defineEmits<{
  "update-panel": [rowIndex: number, panelIndex: number, value: DashboardPanelValue | null];
  "remove-panel": [rowIndex: number, panelIndex: number];
}>();

const isVertical = computed(() => props.row.direction === "vertical");

const panelEditClass = computed(() => {
  if (props.row.panels.length === 1) {
    return "w-full";
  }
  return isVertical.value ? "h-1/2" : "w-1/2";
});
</script>
