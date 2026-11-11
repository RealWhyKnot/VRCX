<script setup lang="ts">
import type { DialogRootProps } from "reka-ui";
import type { DialogRootEmits } from "reka-ui";

import { DialogRoot, useForwardPropsEmits } from "reka-ui";

defineOptions({ name: "UiSheet" });

const props = defineProps<{
  open?: DialogRootProps["open"];
  defaultOpen?: DialogRootProps["defaultOpen"];
  modal?: DialogRootProps["modal"];
}>();
const emits = defineEmits<Pick<DialogRootEmits, "update:open">>();

const forwarded = useForwardPropsEmits(props, emits);
</script>

<template>
  <DialogRoot v-slot="slotProps" data-slot="sheet" v-bind="forwarded">
    <slot v-bind="slotProps" />
  </DialogRoot>
</template>
