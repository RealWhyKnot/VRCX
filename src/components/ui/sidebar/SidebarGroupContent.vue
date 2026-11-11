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
  <div data-slot="sidebar-group-content" data-sidebar="group-content" :class="cn('w-full text-sm', props.class)">
    <slot />
  </div>
</template>
