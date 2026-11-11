<script setup lang="ts">
import { Download, RefreshCw } from "lucide-vue-next";
import Button from "@/components/ui/button/Button.vue";
import { cn } from "@/lib/utils";
import type { ClassValue } from "clsx";
import { storeToRefs } from "pinia";

import VueJsonPretty from "vue-json-pretty";

import { downloadAndSaveJson } from "../../shared/utils/app-actions";
import { useAppearanceSettingsStore } from "../../stores/settings/appearance";
import { useI18n } from "vue-i18n";

const props = withDefaults(
  defineProps<{
    treeData?: Record<string, unknown>;
    treeDataKey?: string | number | null;
    dialogId: string;
    dialogRef: unknown;
    fileAnalysis?: Record<string, unknown> | null;
    class?: ClassValue | undefined;
  }>(),
  {
    treeData: () => ({}),
    treeDataKey: null,
    fileAnalysis: null,
    class: undefined,
  }
);

const emit = defineEmits<{
  refresh: [];
}>();
const { isDarkMode } = storeToRefs(useAppearanceSettingsStore());
const { t } = useI18n();
</script>

<template>
  <div :class="cn('flex h-full min-h-0 flex-col overflow-hidden', props.class)">
    <div class="shrink-0">
      <Button class="rounded-full mr-2" size="icon-sm" variant="ghost" :aria-label="t('common.actions.refresh')" @click="emit('refresh')">
        <RefreshCw />
      </Button>
      <Button
        class="rounded-full"
        size="icon-sm"
        variant="ghost"
        :aria-label="t('dialog.vrcx_updater.download')"
        @click="downloadAndSaveJson(dialogId, dialogRef)"
      >
        <Download />
      </Button>
    </div>

    <div class="min-h-0 flex-1 overflow-auto">
      <vue-json-pretty :key="treeDataKey ?? ''" :data="treeData" :deep="2" :theme="isDarkMode ? 'dark' : 'light'" show-icon />
      <template v-if="fileAnalysis && Object.keys(fileAnalysis).length">
        <br />
        <vue-json-pretty :data="fileAnalysis" :deep="2" :theme="isDarkMode ? 'dark' : 'light'" show-icon />
      </template>
    </div>
  </div>
</template>
