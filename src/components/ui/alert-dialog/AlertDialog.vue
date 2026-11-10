<script setup lang="ts">
import { AlertDialogRoot, useForwardPropsEmits } from "reka-ui";

import AlertDialogStateProvider from "./AlertDialogStateProvider.vue";

const props = defineProps<{ open?: boolean; defaultOpen?: boolean }>();
const emits = defineEmits<{ "update:open": [value: boolean] }>();

const forwarded = useForwardPropsEmits(props, emits);
</script>

<template>
  <AlertDialogRoot v-slot="slotProps" data-slot="alert-dialog" v-bind="forwarded">
    <AlertDialogStateProvider :open="slotProps.open">
      <slot v-bind="slotProps" />
    </AlertDialogStateProvider>
  </AlertDialogRoot>
</template>
