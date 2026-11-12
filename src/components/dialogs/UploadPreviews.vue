<template>
  <div class="mt-3 flex min-w-0 flex-wrap items-end justify-center gap-x-5 gap-y-2" data-testid="upload-previews">
    <div v-for="tile in tiles" :key="tile.id" class="flex min-w-0 flex-col items-center gap-1" :data-testid="`upload-preview-${tile.id}`">
      <div :class="['shrink-0 overflow-hidden bg-muted ring-1 ring-border', tile.frameClass]">
        <img :src="src" alt="" draggable="false" :class="tile.imageClass" />
      </div>
      <span class="max-w-28 truncate text-[11px] text-muted-foreground" :title="t(tile.labelKey)">{{ t(tile.labelKey) }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";

import { UPLOAD_PREVIEW_TILES, type UploadPreviewKind } from "../../shared/utils/upload-previews";

defineOptions({ name: "UploadPreviews" });

const props = defineProps<{ kind: UploadPreviewKind; src: string }>();

const { t } = useI18n();

const tiles = computed(() => UPLOAD_PREVIEW_TILES[props.kind]);
</script>
