<script setup lang="ts">
import type { ClassValue } from "clsx";
import { cn } from "@/lib/utils";

const props = defineProps<{ class?: ClassValue }>();
</script>

<template>
  <div data-slot="item-header" :class="cn('flex basis-full items-center justify-between gap-2', props.class)">
    <slot />
  </div>
</template>
