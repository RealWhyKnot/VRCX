<script setup lang="ts">
import { cn } from "@/lib/utils";

const props = defineProps<{ class?: unknown }>();
</script>

<template>
  <div data-slot="empty-content" :class="cn('flex w-full min-w-0 max-w-sm flex-col items-center gap-4 text-balance text-sm', props.class)">
    <slot />
  </div>
</template>
