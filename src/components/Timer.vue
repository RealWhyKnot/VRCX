<template>
  <span>{{ text }}</span>
</template>
<script setup lang="ts">
import { useIntervalFn, useNow } from "@vueuse/core";
import { computed } from "vue";

import { timeToText } from "../shared/utils/base/format";

defineOptions({ name: "TimerText" });

const props = withDefaults(defineProps<{ epoch?: number | undefined }>(), { epoch: undefined });

const now = useNow({ scheduler: (cb) => useIntervalFn(cb, 15000) });
const text = computed(() => {
  return props.epoch ? timeToText(now.value.getTime() - props.epoch) : "-";
});
</script>
