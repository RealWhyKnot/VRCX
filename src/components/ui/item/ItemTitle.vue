<script setup lang="ts">
import type { ClassValue } from "clsx";
import { cn } from "@/lib/utils";

const props = defineProps<{ class?: ClassValue }>();
</script>

<template>
  <div data-slot="item-title" :class="cn('flex w-fit items-center gap-2 text-sm leading-snug font-medium', props.class)">
    <slot />
  </div>
</template>
