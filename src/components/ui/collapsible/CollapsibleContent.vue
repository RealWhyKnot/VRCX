<script setup lang="ts">
import type { CollapsibleContentProps } from "reka-ui";
import { CollapsibleContent } from "reka-ui";

const props = defineProps<CollapsibleContentProps>();
const delegatedProps: Record<string, unknown> = props;
</script>

<template>
  <CollapsibleContent data-slot="collapsible-content" v-bind="delegatedProps">
    <slot />
  </CollapsibleContent>
</template>
