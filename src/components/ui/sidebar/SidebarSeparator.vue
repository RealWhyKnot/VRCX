<script setup lang="ts">
import Separator from "@/components/ui/separator/Separator.vue";
import { cn } from "@/lib/utils";

const props = defineProps({
  class: {
    type: [String, Array, Object],
    default: undefined,
  },
});
</script>

<template>
  <Separator data-slot="sidebar-separator" data-sidebar="separator" :class="cn('bg-sidebar-border mx-2 w-auto', props.class)">
    <slot />
  </Separator>
</template>
