<script setup lang="ts">
import type { PopoverTriggerProps } from "reka-ui";

import { PopoverTrigger } from "reka-ui";
import { computed } from "vue";

const props = defineProps<{
  asChild?: PopoverTriggerProps["asChild"];
  as?: PopoverTriggerProps["as"];
}>();

const forwarded = computed(() => ({
  ...props,
  as: props.as ?? (props.asChild ? "span" : "button"),
}));
</script>

<template>
  <PopoverTrigger data-slot="popover-trigger" v-bind="forwarded">
    <slot />
  </PopoverTrigger>
</template>
