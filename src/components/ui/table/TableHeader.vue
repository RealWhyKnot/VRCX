<script setup lang="ts">
import { cn } from "@/lib/utils";

const props = defineProps<{ class?: unknown }>();
</script>

<template>
  <thead data-slot="table-header" :class="cn('[&_tr]:border-b', props.class)">
    <slot />
  </thead>
</template>
