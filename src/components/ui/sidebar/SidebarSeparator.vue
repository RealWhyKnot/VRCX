<script setup lang="ts">
import type { ClassValue } from "clsx";
import Separator from "@/components/ui/separator/Separator.vue";
import { cn } from "@/lib/utils";

const props = withDefaults(
  defineProps<{
    class?: ClassValue | undefined;
  }>(),
  {
    class: undefined,
  }
);
</script>

<template>
  <Separator data-slot="sidebar-separator" data-sidebar="separator" :class="cn('bg-sidebar-border mx-2 w-auto', props.class)">
    <slot />
  </Separator>
</template>
