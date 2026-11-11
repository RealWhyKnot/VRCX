<script setup lang="ts">
import type { ClassValue } from "clsx";
import { cn } from "@/lib/utils";

const props = withDefaults(
  defineProps<{
    class?: ClassValue | undefined;
  }>(),
  {
    class: undefined,
  }
);
</script>

<template>
  <kbd data-slot="kbd-group" :class="cn('inline-flex items-center gap-1', props.class)">
    <slot />
  </kbd>
</template>
