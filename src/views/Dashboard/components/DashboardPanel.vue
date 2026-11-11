<template>
  <div class="relative flex min-h-0 flex-1 overflow-hidden rounded-md border bg-card">
    <template v-if="isEditing">
      <Button v-if="showRemove" variant="ghost" size="icon-sm" class="absolute right-1 top-1 z-20" @click="emit('remove')">
        <X class="size-4" />
      </Button>
      <div class="flex w-full min-h-0 flex-col items-center justify-center gap-2 p-3">
        <template v-if="panelKey">
          <div class="flex items-center gap-2 text-base text-muted-foreground">
            <i v-if="panelIcon" :class="panelIcon" class="text-base" />
            <span>{{ panelLabel }}</span>
            <Button variant="ghost" size="icon-sm" :aria-label="t('common.actions.delete')" @click="clearPanel">
              <Trash2 class="size-3.5" />
            </Button>
          </div>
        </template>
        <template v-else>
          <span class="text-base text-muted-foreground">{{ t("dashboard.panel.not_selected") }}</span>
          <Button variant="outline" @click="openSelector">
            {{ t("dashboard.panel.select") }}
          </Button>
        </template>
      </div>
    </template>

    <template v-else-if="panelKey && panelComponent">
      <div class="dashboard-panel h-full w-full overflow-y-auto">
        <component :is="panelComponent" v-bind="widgetProps" />
      </div>
    </template>

    <div v-else class="flex w-full items-center justify-center text-sm text-muted-foreground">
      {{ t("dashboard.panel.not_configured") }}
    </div>

    <PanelSelector :open="selectorOpen" :current-key="panelData" @select="handleSelect" @close="selectorOpen = false" />
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { Trash2, X } from "lucide-vue-next";
import { useI18n } from "vue-i18n";

import Button from "@/components/ui/button/Button.vue";
import { navDefinitions } from "@/shared/constants/ui";

import PanelSelector from "./PanelSelector.vue";
import { panelComponentMap } from "./panel-registry";
import type { DashboardPanelValue } from "../types";

const props = withDefaults(
  defineProps<{
    panelData?: DashboardPanelValue | null;
    isEditing?: boolean;
    showRemove?: boolean;
  }>(),
  {
    panelData: null,
    isEditing: false,
    showRemove: false,
  }
);

const emit = defineEmits<{
  select: [value: DashboardPanelValue | null];
  remove: [];
}>();
const { t } = useI18n();
const selectorOpen = ref(false);

const panelKey = computed<string | null>(() => {
  const panel = props.panelData;
  if (!panel) return null;
  if (typeof panel === "string") return panel;
  if (!panel.key) return null;
  return panel.key;
});

const panelConfig = computed<unknown>(() => {
  const panel = props.panelData;
  if (!panel || typeof panel === "string") return {};
  return panel.config ?? {};
});

const isWidget = computed(() => {
  return panelKey.value?.startsWith("widget:");
});

function isPanelComponentKey(key: string): key is keyof typeof panelComponentMap {
  return key in panelComponentMap;
}

const panelComponent = computed(() => {
  const key = panelKey.value;
  if (!key || !isPanelComponentKey(key)) return null;
  return panelComponentMap[key];
});

const widgetProps = computed(() => {
  if (!isWidget.value) return {};
  return {
    config: panelConfig.value,
    configUpdater: (newConfig: unknown) => emitConfigUpdate(newConfig),
  };
});

const widgetDefs = new Map<string, { icon: string; labelKey: string }>([
  ["widget:feed", { icon: "ri-rss-line", labelKey: "dashboard.widget.feed" }],
  ["widget:game-log", { icon: "ri-history-line", labelKey: "dashboard.widget.game_log" }],
  ["widget:instance", { icon: "ri-group-3-line", labelKey: "dashboard.widget.instance" }],
]);

const panelOption = computed(() => {
  if (!panelKey.value) return null;
  const widgetDef = widgetDefs.get(panelKey.value);
  if (widgetDef) return widgetDef;
  return navDefinitions.find((def) => def.key === panelKey.value) ?? null;
});

const panelLabel = computed(() => {
  if (!panelOption.value?.labelKey) return panelKey.value ?? "";
  return t(panelOption.value.labelKey);
});

const panelIcon = computed(() => panelOption.value?.icon ?? "");

function emitConfigUpdate(newConfig: unknown) {
  const key = panelKey.value;
  if (!key) return;
  emit("select", { key, config: newConfig });
}

const openSelector = () => {
  selectorOpen.value = true;
};

const clearPanel = () => {
  emit("select", null);
};

const handleSelect = (value: DashboardPanelValue | null) => {
  emit("select", value);
  selectorOpen.value = false;
};
</script>

<style scoped>
.dashboard-panel :deep(.x-container) {
  height: 100%;
  margin: 0;
  border: none;
  border-radius: 0;
  background: transparent;
}

.dashboard-panel :deep(.dt-pagination) {
  margin-top: 0.25rem;
  margin-bottom: 0;
  gap: 0.25rem;
  justify-content: center;
}

.dashboard-panel :deep(.dt-pagination-sizes),
.dashboard-panel :deep(.dt-pagination-spacer) {
  display: none;
}

.dashboard-panel :deep([data-slot="pagination-previous"] span),
.dashboard-panel :deep([data-slot="pagination-next"] span) {
  display: none;
}

.dashboard-panel :deep([data-slot="pagination-previous"]),
.dashboard-panel :deep([data-slot="pagination-next"]) {
  padding-inline: 0.25rem;
  min-width: 1.75rem;
  height: 1.75rem;
}

.dashboard-panel :deep([data-slot="pagination-item"]) {
  min-width: 1.75rem;
  height: 1.75rem;
  font-size: 0.75rem;
}

.dashboard-panel :deep([data-slot="pagination-ellipsis"]) {
  width: 1.75rem;
  height: 1.75rem;
}
</style>
