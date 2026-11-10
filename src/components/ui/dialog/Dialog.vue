<script setup lang="ts">
import type { DialogRootProps } from "reka-ui";
import type { DialogRootEmits } from "reka-ui";

import { DialogRoot, useForwardPropsEmits } from "reka-ui";

import DialogStateProvider from "./DialogStateProvider.vue";

const props = defineProps<{
  open?: DialogRootProps["open"];
  defaultOpen?: DialogRootProps["defaultOpen"];
  modal?: DialogRootProps["modal"];
}>();
const emits = defineEmits<Pick<DialogRootEmits, "update:open">>();

const forwarded = useForwardPropsEmits(props, emits);
</script>

<template>
  <DialogRoot v-slot="slotProps" data-slot="dialog" v-bind="forwarded">
    <DialogStateProvider :open="slotProps.open">
      <slot v-bind="slotProps" />
    </DialogStateProvider>
  </DialogRoot>
</template>
