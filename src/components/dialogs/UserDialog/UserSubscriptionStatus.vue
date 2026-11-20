<template>
  <div class="flex items-center justify-between text-xs text-muted-foreground">
    <span>{{ t("dialog.user.subscription.label") }}</span>
    <span>{{ t(isActive ? "dialog.user.subscription.active" : "dialog.user.subscription.inactive") }}</span>
  </div>
  <div v-if="expires" class="flex min-w-0 items-center justify-between gap-2 text-xs text-muted-foreground">
    <span>{{ t(dateLabel) }}</span>
    <time class="min-w-0 truncate" :datetime="expires" :title="formattedExpiry">{{ formattedExpiry }}</time>
  </div>
</template>

<script setup lang="ts">
import { computed, shallowRef, watch } from "vue";
import { useI18n } from "vue-i18n";
import { marketplaceRequest } from "@/api/marketplace";
import { formatDateFilter } from "@/coordinators/date-coordinator";
import type { Json } from "@/types/vrcx";
import type { UserSubscription } from "vrchat";

const props = defineProps<{ userId: string; isSupporter: boolean }>();
const { t } = useI18n();
const subscription = shallowRef<Partial<Json<UserSubscription>>>();

const isActive = computed(() => subscription.value?.active ?? props.isSupporter);
const expires = computed(() => subscription.value?.expires);
const dateLabel = computed(() => {
  const entry = subscription.value;
  if (
    entry?.active &&
    entry.status === "active" &&
    entry.isGift === false &&
    entry.isBulkGift === false &&
    entry.store &&
    entry.store.toLowerCase() !== "admin" &&
    ["hour", "day", "week", "month", "year"].includes(entry.period ?? "")
  ) {
    return "dialog.user.subscription.renews";
  }
  return entry && !entry.active && Date.parse(entry.expires ?? "") <= Date.now() ? "dialog.user.subscription.expired" : "dialog.user.subscription.expires";
});
const formattedExpiry = computed(() => formatDateFilter(expires.value, "short"));

watch(
  () => props.userId,
  async (id, _, onCleanup) => {
    const controller = new AbortController();
    onCleanup(() => controller.abort());
    subscription.value = undefined;
    try {
      const subscriptions = await marketplaceRequest.getCurrentSubscriptions(id);
      if (controller.signal.aborted) return;
      subscription.value = subscriptions
        .filter((entry) => entry.id.startsWith("vrchatplus") && Number.isFinite(Date.parse(entry.expires)))
        .toSorted((a, b) => Number(b.active) - Number(a.active) || Date.parse(b.expires) - Date.parse(a.expires))[0];
    } catch (error) {
      console.error(error);
    }
  },
  { immediate: true }
);
</script>
