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
  <ul data-slot="sidebar-menu" data-sidebar="menu" :class="cn('flex w-full min-w-0 flex-col gap-1', props.class)">
    <slot />
  </ul>
</template>
