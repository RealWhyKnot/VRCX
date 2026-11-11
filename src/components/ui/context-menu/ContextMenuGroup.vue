<script setup lang="ts">
import type { ContextMenuGroupProps } from "reka-ui";
import { ContextMenuGroup } from "reka-ui";

const props = defineProps<ContextMenuGroupProps>();
const delegatedProps: Record<string, unknown> = props;
</script>

<template>
  <ContextMenuGroup data-slot="context-menu-group" v-bind="delegatedProps">
    <slot />
  </ContextMenuGroup>
</template>
