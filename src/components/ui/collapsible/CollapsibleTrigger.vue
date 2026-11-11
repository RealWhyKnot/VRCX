<script setup lang="ts">
import type { CollapsibleTriggerProps } from "reka-ui";
import { CollapsibleTrigger } from "reka-ui";

const props = defineProps<CollapsibleTriggerProps>();
const delegatedProps: Record<string, unknown> = props;
</script>

<template>
  <CollapsibleTrigger data-slot="collapsible-trigger" v-bind="delegatedProps">
    <slot />
  </CollapsibleTrigger>
</template>
