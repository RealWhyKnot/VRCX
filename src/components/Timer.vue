<template>
  <span>{{ text }}</span>
</template>
<script setup lang="ts">
import { useIntervalFn, useNow } from "@vueuse/core";
import { computed } from "vue";

import { timeToText } from "../shared/utils";

const props = defineProps<{ epoch: number }>();

const now = useNow({ scheduler: (cb) => useIntervalFn(cb, 15000) });
const text = computed(() => {
  return props.epoch ? timeToText(now.value.getTime() - props.epoch) : "-";
});
</script>
