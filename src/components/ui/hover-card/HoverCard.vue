<script setup lang="ts">
import { HoverCardRoot, useForwardPropsEmits } from "reka-ui";
import type { HoverCardRootEmits, HoverCardRootProps } from "reka-ui";

const props = defineProps<HoverCardRootProps>();
const delegatedProps: Record<string, unknown> = props;
const emits = defineEmits<HoverCardRootEmits>();

const forwarded = useForwardPropsEmits(delegatedProps, emits);
</script>

<template>
  <HoverCardRoot v-slot="slotProps" data-slot="hover-card" v-bind="forwarded">
    <slot v-bind="slotProps" />
  </HoverCardRoot>
</template>
