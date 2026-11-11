<script setup lang="ts">
import type { ClassValue } from "clsx";
import { cn } from "@/lib/utils";

const props = defineProps<{ class?: ClassValue }>();
</script>

<template>
  <div data-slot="item-actions" :class="cn('flex items-center gap-2', props.class)">
    <slot />
  </div>
</template>
