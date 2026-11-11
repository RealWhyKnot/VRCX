<template>
  <template v-if="typeof enabled !== 'undefined' ? enabled : displayVRCProfileCosmetics">
    <img
      v-if="mainUrl"
      v-show="isAnimated && !introActive"
      v-bind="$attrs"
      :src="mainUrl"
      class="absolute top-[-15%] left-[-15%] h-[130%] w-[130%] max-w-none pointer-events-none"
    />
    <img
      v-if="introUrl && isAnimated"
      v-show="introActive"
      v-bind="$attrs"
      :src="introUrl"
      class="absolute top-[-15%] left-[-15%] h-[130%] w-[130%] max-w-none pointer-events-none"
      @load="startIntroTimer"
    />
    <img
      v-if="baseUrl"
      v-show="!isAnimated"
      v-bind="$attrs"
      :src="baseUrl"
      class="absolute top-[-15%] left-[-15%] h-[130%] w-[130%] max-w-none pointer-events-none"
    />
  </template>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from "vue";
import { storeToRefs } from "pinia";

import { useUserStore } from "../stores/user";
import { useAppearanceSettingsStore } from "../stores/settings/appearance";
import { useVrcxStore } from "../stores/vrcx";

defineOptions({ inheritAttrs: false });

const props = withDefaults(
  defineProps<{
    iconFrame?: string;
    enabled?: boolean | undefined;
  }>(),
  {
    iconFrame: "",
    enabled: undefined,
  }
);

const { cachedIconFrames, currentUserClientConfig } = storeToRefs(useUserStore());
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
  () => [props.iconFrame, cachedIconFrames.value.get(props.iconFrame)] as const,
  ([, frame]) => {
    clearIntroTimer();
    baseUrl.value = null;
    mainUrl.value = null;
    introUrl.value = null;
    introActive.value = false;
    introDuration.value = null;

    const introAsset = frame?.metadata?.assets?.find((asset) => asset.type === "introAnimation");
    const mainAsset = frame?.metadata?.assets?.find((asset) => asset.type === "mainAnimation");
    const baseAsset = frame?.metadata?.assets?.find((asset) => asset.type === "base");

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
