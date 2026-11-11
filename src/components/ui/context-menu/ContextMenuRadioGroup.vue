<script setup lang="ts">
import type { ContextMenuRadioGroupEmits, ContextMenuRadioGroupProps } from "reka-ui";
import { ContextMenuRadioGroup, useForwardPropsEmits } from "reka-ui";

const props = defineProps<ContextMenuRadioGroupProps>();
const delegatedProps: Record<string, unknown> = props;
const emits = defineEmits<ContextMenuRadioGroupEmits>();

const forwarded = useForwardPropsEmits(delegatedProps, emits);
</script>

<template>
  <ContextMenuRadioGroup data-slot="context-menu-radio-group" v-bind="forwarded">
    <slot />
  </ContextMenuRadioGroup>
</template>
