<script setup lang="ts">
import type { ClassValue } from "clsx";
import { cn } from "@/lib/utils";

defineOptions({ name: "UiSkeleton" });

const props = defineProps<{ class?: ClassValue }>();
</script>

<template>
  <div data-slot="skeleton" :class="cn('animate-pulse rounded-md bg-primary/10', props.class)" />
</template>
