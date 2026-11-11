<script setup lang="ts">
import type { ClassValue } from "clsx";
import { cn } from "@/lib/utils";

const props = defineProps<{ class?: ClassValue }>();
</script>

<template>
  <div role="list" data-slot="item-group" :class="cn('group/item-group flex flex-col', props.class)">
    <slot />
  </div>
</template>
