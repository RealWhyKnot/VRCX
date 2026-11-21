<template>
  <div class="flex min-w-0 flex-col gap-2" :class="kind === 'charts' ? 'h-full min-h-80' : undefined">
    <ToggleGroup class="max-w-full flex-wrap" type="single" variant="outline" size="sm" :model-value="kind" @update:model-value="selectKind">
      <ToggleGroupItem value="charts">{{ t("nav_tooltip.charts") }}</ToggleGroupItem>
      <ToggleGroupItem value="avatar">{{ t("dialog.user.avatars.header") }}</ToggleGroupItem>
      <ToggleGroupItem value="profile">{{ t("dialog.retained_history.profile") }}</ToggleGroupItem>
      <ToggleGroupItem v-if="isFriend" value="platform">{{ t("dialog.avatar.info.platform") }}</ToggleGroupItem>
    </ToggleGroup>
    <div v-show="kind === 'charts'" class="min-h-0 flex-1"><slot /></div>
    <RetainedHistoryTable v-if="isActive && userId && kind !== 'charts'" :kind="kind" :user-id="userId" />
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import ToggleGroup from "@/components/ui/toggle-group/ToggleGroup.vue";
import ToggleGroupItem from "@/components/ui/toggle-group/ToggleGroupItem.vue";
import RetainedHistoryTable from "@/components/history/RetainedHistoryTable.vue";

const props = defineProps<{ userId: string; isFriend: boolean; isActive: boolean }>();
const { t } = useI18n();
const kind = ref<"charts" | "avatar" | "profile" | "platform">("charts");
watch(
  () => [props.userId, props.isActive],
  () => {
    kind.value = "charts";
  },
  { flush: "sync" }
);
function selectKind(value: unknown) {
  if (value === "charts" || value === "avatar" || value === "profile" || (value === "platform" && props.isFriend)) kind.value = value;
}
watch(
  () => props.isFriend,
  (isFriend) => {
    if (!isFriend && kind.value === "platform") kind.value = "charts";
  },
  { flush: "sync" }
);
</script>
