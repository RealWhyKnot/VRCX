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
  <li data-slot="sidebar-menu-sub-item" data-sidebar="menu-sub-item" :class="cn('group/menu-sub-item relative', props.class)">
    <slot />
  </li>
</template>
