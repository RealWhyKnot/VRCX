<template>
  <span class="inline-flex w-full min-w-0 items-center gap-1.5 align-middle" :title="tooltip">
    <img v-if="image" :src="image" alt="" loading="lazy" class="size-5 shrink-0 rounded-sm object-contain" />
    <span class="min-w-0 truncate">{{ label }}</span>
  </span>
</template>
<script setup lang="ts">
import { computed, onWatcherCleanup, shallowRef, watch } from "vue";
import { useUserStore } from "@/stores/user";
import { historyText } from "./history-text";
import { findBadgeHistory, parseBadgeSentence } from "./badge-history";

const props = defineProps<{ message: string; at?: string | undefined; data?: unknown; imageUrl?: string | null | undefined }>();
const userStore = useUserStore();
const retained = shallowRef<unknown>();
const event = computed(() => parseBadgeSentence(props.message));
const id = computed(() => historyText(props.data, "badgeId"));
const owned = computed(() => (id.value ? userStore.currentUser.badges.find((badge) => badge.badgeId === id.value) : undefined));
const image = computed(
  () => historyText(props.data, "badgeImageUrl") || historyText(retained.value, "imageUrl") || (owned.value?.badgeImageUrl ?? props.imageUrl)
);
const name = computed(() => historyText(props.data, "badgeName") || historyText(retained.value, "name") || owned.value?.badgeName);
const label = computed(() => (name.value ? (event.value?.prefix ?? "") + name.value : props.message));
const description = computed(() => historyText(props.data, "badgeDescription") || historyText(retained.value, "description") || owned.value?.badgeDescription);
const tooltip = computed(() => [label.value, description.value].filter(Boolean).join("\n"));

watch(
  () => [userStore.currentUser.id, props.message, props.at, props.data, props.imageUrl],
  () => {
    retained.value = undefined;
    if (id.value && image.value && name.value) return;
    let isCurrent = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    onWatcherCleanup(() => {
      isCurrent = false;
      clearTimeout(timer);
    });
    const account = userStore.currentUser.id;
    async function load(isRetry = false) {
      const result = await findBadgeHistory(account, id.value, props.message, props.at ?? "", () => isCurrent, isRetry);
      if (!isCurrent) return;
      retained.value = result;
      const age = Date.now() - Date.parse(props.at ?? "");
      if (!result && !isRetry && event.value && age >= 0 && age < 5000) timer = setTimeout(() => void load(true).catch(console.error), 1600);
    }
    void load().catch(console.error);
  },
  { immediate: true }
);
</script>
