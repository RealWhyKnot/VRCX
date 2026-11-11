<script setup lang="ts">
import type { ClassValue } from "clsx";
import { cn } from "@/lib/utils";

const props = defineProps<{ class?: ClassValue }>();
</script>

<template>
  <li data-slot="breadcrumb-item" :class="cn('inline-flex items-center gap-1.5', props.class)">
    <slot />
  </li>
</template>
