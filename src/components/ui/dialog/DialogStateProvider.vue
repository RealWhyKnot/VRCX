<script setup lang="ts">
import { provide, toRef } from "vue";

import { DIALOG_OPEN_INJECTION_KEY } from "./context";

const props = defineProps<{
  open: boolean;
}>();

provide(DIALOG_OPEN_INJECTION_KEY, toRef(props, "open"));
</script>

<template>
  <slot />
</template>
