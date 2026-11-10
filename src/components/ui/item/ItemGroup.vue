<script setup lang="ts">
import { cn } from "@/lib/utils";

const props = defineProps<{ class?: unknown }>();
</script>

<template>
  <div role="list" data-slot="item-group" :class="cn('group/item-group flex flex-col', props.class)">
    <slot />
  </div>
</template>
