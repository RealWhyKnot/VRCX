<script setup lang="ts">
import type { ContextMenuTriggerProps } from "reka-ui";
import { ContextMenuTrigger, useForwardProps } from "reka-ui";

const props = defineProps<ContextMenuTriggerProps>();
const delegatedProps: Record<string, unknown> = props;

const forwardedProps = useForwardProps(delegatedProps);
</script>

<template>
  <ContextMenuTrigger data-slot="context-menu-trigger" v-bind="forwardedProps">
    <slot />
  </ContextMenuTrigger>
</template>
