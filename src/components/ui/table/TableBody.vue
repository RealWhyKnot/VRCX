<script setup lang="ts">
import type { ClassValue } from "clsx";
import { cn } from "@/lib/utils";

const props = defineProps<{ class?: ClassValue }>();
</script>

<template>
  <tbody data-slot="table-body" :class="cn('[&_tr:last-child]:border-0', props.class)">
    <slot />
  </tbody>
</template>
