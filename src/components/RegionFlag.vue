<template>
  <TooltipWrapper side="top" :content="label" :delay-duration="300">
    <span :class="['flags', region]" :aria-label="label" data-testid="region-flag" />
  </TooltipWrapper>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";

import TooltipWrapper from "./ui/tooltip/TooltipWrapper.vue";
import { regionName } from "../shared/utils/region";

defineOptions({ name: "RegionFlag" });

const props = defineProps<{ region: string }>();

const { t } = useI18n();

const label = computed(() => regionName(props.region, t));
</script>
