<script setup lang="ts">
import { cn } from "@/lib/utils";

const props = defineProps<{ class?: unknown }>();
</script>

<template>
  <div data-slot="card-content" :class="cn('px-6', props.class)">
    <slot />
  </div>
</template>
