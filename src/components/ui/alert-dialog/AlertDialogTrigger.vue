<script setup lang="ts">
import type { AlertDialogTriggerProps } from "reka-ui";
import { AlertDialogTrigger } from "reka-ui";

const props = defineProps<AlertDialogTriggerProps>();
const delegatedProps: Record<string, unknown> = props;
</script>

<template>
  <AlertDialogTrigger data-slot="alert-dialog-trigger" v-bind="delegatedProps">
    <slot />
  </AlertDialogTrigger>
</template>
