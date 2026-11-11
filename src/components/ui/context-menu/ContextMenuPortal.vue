<script setup lang="ts">
import type { ContextMenuPortalProps } from "reka-ui";
import { ContextMenuPortal } from "reka-ui";

const props = defineProps<ContextMenuPortalProps>();
const delegatedProps: Record<string, unknown> = props;
</script>

<template>
  <ContextMenuPortal data-slot="context-menu-portal" v-bind="delegatedProps">
    <slot />
  </ContextMenuPortal>
</template>
