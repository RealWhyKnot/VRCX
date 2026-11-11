<template>
  <div v-if="displayVRCProfileCosmetics" v-bind="$attrs" class="absolute right-0 top-[105px] h-[50px] w-full">
    <div class="absolute inset-0 rounded-b-lg" :style="nameplateStyle"></div>
    <img
      v-if="mainUrl"
      v-show="isAnimated && !introActive"
      :src="mainUrl"
      class="absolute right-0 top-0 h-full w-auto object-contain object-right opacity-100 transition-opacity rounded-b-lg"
    />
    <img
      v-if="introUrl && isAnimated"
      v-show="introActive"
      :src="introUrl"
      class="absolute right-0 top-0 h-full w-auto object-contain object-right opacity-100 transition-opacity rounded-b-lg"
      @load="startIntroTimer"
    />
    <img
      v-if="baseUrl"
      v-show="!isAnimated"
      :src="baseUrl"
      class="absolute right-0 top-0 h-full w-auto object-contain object-right opacity-100 transition-opacity rounded-b-lg"
    />
  </div>
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
    nameplateEffect?: string;
  }>(),
  {
    nameplateEffect: "",
  }
);

const { cachedNameplateEffects, currentUserClientConfig } = storeToRefs(useUserStore());
const { displayVRCProfileCosmetics } = storeToRefs(useAppearanceSettingsStore());
const { isBrowserFocused } = storeToRefs(useVrcxStore());

const isAnimated = computed(() => isBrowserFocused.value && !currentUserClientConfig.value.accessReduceDecorAnim);

const baseUrl = ref<string | null>(null);
const mainUrl = ref<string | null>(null);
const introUrl = ref<string | null>(null);
const introActive = ref(false);
const introDuration = ref<number | null>(null);
const nameplateStyle = ref<{ backgroundImage: string } | null>(null);
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
  () => [props.nameplateEffect, cachedNameplateEffects.value.get(props.nameplateEffect)] as const,
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

    const gradientStart = effect?.metadata?.gradientStart;
    const gradientEnd = effect?.metadata?.gradientEnd;
    nameplateStyle.value = gradientStart && gradientEnd ? { backgroundImage: `linear-gradient(90deg, #${gradientStart}, #${gradientEnd})` } : null;
  },
  { immediate: true }
);

onBeforeUnmount(clearIntroTimer);
</script>
