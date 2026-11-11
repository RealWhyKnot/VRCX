<script setup lang="ts">
import type { ClassValue } from "clsx";
import { cn } from "@/lib/utils";

const props = defineProps<{ class?: ClassValue }>();
</script>

<template>
  <div data-slot="dialog-footer" :class="cn('flex flex-col-reverse gap-2 sm:flex-row sm:justify-end', props.class)">
    <slot />
  </div>
</template>
