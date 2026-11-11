<script setup lang="ts">
import type { HoverCardTriggerProps } from "reka-ui";
import { HoverCardTrigger } from "reka-ui";

const props = defineProps<HoverCardTriggerProps>();
const delegatedProps: Record<string, unknown> = props;
</script>

<template>
  <HoverCardTrigger data-slot="hover-card-trigger" v-bind="delegatedProps">
    <slot />
  </HoverCardTrigger>
</template>
