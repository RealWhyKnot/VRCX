<script setup lang="ts">
import type { DialogCloseProps } from "reka-ui";
import { DialogClose } from "reka-ui";

const props = defineProps<DialogCloseProps>();
const delegatedProps: Record<string, unknown> = props;
</script>

<template>
  <DialogClose data-slot="dialog-close" v-bind="delegatedProps">
    <slot />
  </DialogClose>
</template>
