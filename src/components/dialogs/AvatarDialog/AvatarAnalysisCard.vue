<template>
  <div v-if="stats.length" class="my-2 min-w-0 text-xs rounded-xl bg-(--profile-card) p-3">
    <div class="text-[10px] font-bold uppercase tracking-wide text-muted-foreground mb-2 pb-2 border-b border-border truncate" :title="platformLabel">
      {{ t("dialog.avatar.analysis.title", { platform: platformLabel }) }}
    </div>
    <dl class="grid grid-cols-[repeat(auto-fit,minmax(min(100%,9rem),1fr))] gap-x-4 gap-y-2">
      <div v-for="stat in stats" :key="stat.key" class="flex min-w-0 items-baseline justify-between gap-2">
        <dt class="min-w-0 flex-1 truncate text-foreground/65" :title="stat.label">{{ stat.label }}</dt>
        <dd class="max-w-[45%] shrink-0 truncate tabular-nums text-right" :title="stat.value">{{ stat.displayValue }}</dd>
      </div>
    </dl>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { formatFileSize } from "@/shared/utils/base/format";

const props = defineProps<{ platform: string; analysis: unknown }>();
const { t, n } = useI18n();

const platforms = new Set(["standalonewindows", "android", "ios"]);

const fields = [
  ["totalPolygons", "polygons"],
  ["materialCount", "materials"],
  ["boneCount", "bones"],
  ["meshCount", "meshes"],
  ["skinnedMeshCount", "skinned_meshes"],
  ["physBoneComponentCount", "physbones"],
  ["physBoneColliderCount", "physbone_colliders"],
  ["physBoneTransformCount", "physbone_transforms"],
  ["totalTextureUsage", "texture_memory"],
] as const;

const platformLabel = computed(() => (platforms.has(props.platform) ? t(`view.tools.instance_browser.platform_${props.platform}`) : props.platform));
const stats = computed(() => {
  const analysis = props.analysis;
  if (typeof analysis !== "object" || analysis === null || !("avatarStats" in analysis)) return [];
  const values = analysis.avatarStats;
  if (typeof values !== "object" || values === null) return [];

  return fields.flatMap(([field, key]) => {
    const value: unknown = Object.getOwnPropertyDescriptor(values, field)?.value;
    if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return [];
    const formatted = field === "totalTextureUsage" ? formatFileSize(value) : n(value);
    const displayValue =
      value > Number.MAX_SAFE_INTEGER && field !== "totalTextureUsage" ? n(value, { notation: "scientific", maximumFractionDigits: 2 }) : formatted;
    return [{ key, label: t(`dialog.avatar.analysis.${key}`), value: formatted, displayValue }];
  });
});
</script>
