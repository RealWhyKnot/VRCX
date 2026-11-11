<script setup lang="ts">
import type { ClassValue } from "clsx";
import { cn } from "@/lib/utils";

const props = defineProps<{ class?: ClassValue }>();
</script>

<template>
  <tr data-slot="table-row" :class="cn('hover:bg-muted/50 data-[state=selected]:bg-muted border-b transition-colors', props.class)">
    <slot />
  </tr>
</template>
