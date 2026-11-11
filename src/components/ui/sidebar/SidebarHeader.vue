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
  <div data-slot="sidebar-header" data-sidebar="header" :class="cn('flex flex-col gap-2 p-2', props.class)">
    <slot />
  </div>
</template>
