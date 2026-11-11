<script setup lang="ts">
import type { ClassValue } from "clsx";
import Input from "@/components/ui/input/Input.vue";
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
  <Input data-slot="sidebar-input" data-sidebar="input" :class="cn('bg-background h-8 w-full shadow-none', props.class)">
    <slot />
  </Input>
</template>
