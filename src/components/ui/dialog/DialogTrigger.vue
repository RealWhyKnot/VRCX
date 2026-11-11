<script setup lang="ts">
import type { DialogTriggerProps } from "reka-ui";
import { DialogTrigger } from "reka-ui";

const props = defineProps<DialogTriggerProps>();
const delegatedProps: Record<string, unknown> = props;
</script>

<template>
  <DialogTrigger data-slot="dialog-trigger" v-bind="delegatedProps">
    <slot />
  </DialogTrigger>
</template>
