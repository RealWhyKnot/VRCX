<script setup lang="ts">
import { cn } from "@/lib/utils";

const props = defineProps<{ class?: unknown }>();
</script>

<template>
  <div data-slot="skeleton" :class="cn('animate-pulse rounded-md bg-primary/10', props.class)" />
</template>
