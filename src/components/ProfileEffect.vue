<template>
  <template v-if="typeof enabled !== 'undefined' ? enabled : displayVRCProfileCosmetics">
    <img
      v-if="mainUrl"
      v-show="isAnimated && !introActive"
      v-bind="$attrs"
      :src="mainUrl"
      class="absolute inset-0 block h-full w-full object-fit object-top pointer-events-none"
    />
    <img
      v-if="introUrl && isAnimated"
      v-show="introActive"
      v-bind="$attrs"
      :src="introUrl"
      class="absolute inset-0 block h-full w-full object-fit object-top pointer-events-none"
      @load="startIntroTimer"
    />
    <img
      v-if="baseUrl"
      v-show="!isAnimated"
      v-bind="$attrs"
      :src="baseUrl"
      class="absolute inset-0 block h-full w-full object-fit object-top pointer-events-none"
    />
  </template>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from "vue";
import { storeToRefs } from "pinia";

import { useAppearanceSettingsStore } from "../stores/settings/appearance";
import { useUserStore } from "../stores/user";
import { useVrcxStore } from "../stores/vrcx";

defineOptions({ inheritAttrs: false });

const props = withDefaults(
  defineProps<{
    profileEffect?: string;
    enabled?: boolean | undefined;
  }>(),
  {
    profileEffect: "",
    enabled: undefined,
  }
);

const { cachedProfileEffects, currentUserClientConfig } = storeToRefs(useUserStore());
const { displayVRCProfileCosmetics } = storeToRefs(useAppearanceSettingsStore());
const { isBrowserFocused } = storeToRefs(useVrcxStore());

const isAnimated = computed(() => isBrowserFocused.value && !currentUserClientConfig.value.accessReduceDecorAnim);

const baseUrl = ref<string | null>(null);
const mainUrl = ref<string | null>(null);
const introUrl = ref<string | null>(null);
const introActive = ref(false);
const introDuration = ref<number | null>(null);
let introTimer: ReturnType<typeof setTimeout> | undefined;

function clearIntroTimer() {
  clearTimeout(introTimer);
  introTimer = undefined;
}

function startIntroTimer() {
  clearIntroTimer();
  introTimer = setTimeout(() => {
    introActive.value = false;
  }, introDuration.value ?? 0);
}

watch(isAnimated, (isNowAnimated) => {
  if (isNowAnimated) {
    return;
  }
  clearIntroTimer();
  introActive.value = false;
});

watch(
  () => [props.profileEffect, cachedProfileEffects.value.get(props.profileEffect)] as const,
  ([, effect]) => {
    clearIntroTimer();
    baseUrl.value = null;
    mainUrl.value = null;
    introUrl.value = null;
    introActive.value = false;
    introDuration.value = null;

    const introAsset = effect?.metadata?.assets?.find((asset) => asset.type === "introAnimation");
    const mainAsset = effect?.metadata?.assets?.find((asset) => asset.type === "mainAnimation");
    const baseAsset = effect?.metadata?.assets?.find((asset) => asset.type === "base");

    baseUrl.value = baseAsset?.url ?? null;
    mainUrl.value = mainAsset?.url ?? null;
    if (introAsset) {
      introUrl.value = introAsset.url;
      introDuration.value = introAsset.totalDurationMs ?? null;
      introActive.value = true;
    }
  },
  { immediate: true }
);

onBeforeUnmount(clearIntroTimer);
</script>
