<script setup lang="ts">
import type { PopoverRootProps } from "reka-ui";
import type { PopoverRootEmits } from "reka-ui";

import { PopoverRoot, useForwardPropsEmits } from "reka-ui";

const props = defineProps<{
  defaultOpen?: PopoverRootProps["defaultOpen"];
  open?: PopoverRootProps["open"];
  modal?: PopoverRootProps["modal"];
}>();
const emits = defineEmits<Pick<PopoverRootEmits, "update:open">>();

const forwarded = useForwardPropsEmits(props, emits);
</script>

<template>
  <PopoverRoot v-slot="slotProps" data-slot="popover" v-bind="forwarded">
    <slot v-bind="slotProps" />
  </PopoverRoot>
</template>
