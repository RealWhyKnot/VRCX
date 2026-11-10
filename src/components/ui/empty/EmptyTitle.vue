<script setup lang="ts">
import { cn } from "@/lib/utils";

const props = defineProps<{ class?: unknown }>();
</script>

<template>
  <div data-slot="empty-title" :class="cn('text-lg font-medium tracking-tight', props.class)">
    <slot />
  </div>
</template>
