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
  <li data-slot="sidebar-menu-item" data-sidebar="menu-item" :class="cn('group/menu-item relative', props.class)">
    <slot />
  </li>
</template>
