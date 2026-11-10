<script setup lang="ts">
import { cn } from "@/lib/utils";

const props = defineProps<{ class?: unknown }>();
</script>

<template>
  <option data-slot="native-select-option" :class="cn('bg-popover text-popover-foreground', props.class)">
    <slot />
  </option>
</template>
