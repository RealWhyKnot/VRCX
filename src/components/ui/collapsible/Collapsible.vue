<script setup lang="ts">
import type { CollapsibleRootProps } from "reka-ui";
import { CollapsibleRoot, useForwardPropsEmits } from "reka-ui";
import type { CollapsibleRootEmits } from "reka-ui";

defineOptions({ name: "UiCollapsible" });

const props = defineProps<CollapsibleRootProps>();
const delegatedProps: Record<string, unknown> = props;
const emits = defineEmits<CollapsibleRootEmits>();

const forwarded = useForwardPropsEmits(delegatedProps, emits);
</script>

<template>
  <CollapsibleRoot v-slot="slotProps" data-slot="collapsible" v-bind="forwarded">
    <slot v-bind="slotProps" />
  </CollapsibleRoot>
</template>
