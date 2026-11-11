<script setup lang="ts">
import type { ClassValue } from "clsx";
import { cn } from "@/lib/utils";

const props = defineProps<{ class?: ClassValue }>();
</script>

<template>
  <span data-slot="breadcrumb-page" role="link" aria-disabled="true" aria-current="page" :class="cn('text-foreground font-normal', props.class)">
    <slot />
  </span>
</template>
