<script setup lang="ts">
import type { ClassValue } from "clsx";
import { cn } from "@/lib/utils";

const props = defineProps<{ class?: ClassValue }>();
</script>

<template>
  <span data-slot="command-shortcut" :class="cn('text-muted-foreground ml-auto text-xs tracking-widest', props.class)">
    <slot />
  </span>
</template>
