<script setup lang="ts">
import type { ClassValue } from "clsx";
import { cn } from "@/lib/utils";

const props = defineProps<{ class?: ClassValue }>();
</script>

<template>
  <div data-slot="item-content" :class="cn('flex flex-1 flex-col gap-1 [&+[data-slot=item-content]]:flex-none', props.class)">
    <slot />
  </div>
</template>
