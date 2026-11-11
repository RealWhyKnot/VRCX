<script setup lang="ts">
import type { ClassValue } from "clsx";
import { cn } from "@/lib/utils";

const props = withDefaults(
  defineProps<{
    class?: ClassValue | undefined;
    variant?: string | undefined;
  }>(),
  {
    class: undefined,
    variant: undefined,
  }
);
</script>

<template>
  <legend
    data-slot="field-legend"
    :data-variant="variant"
    :class="cn('mb-3 font-medium', 'data-[variant=legend]:text-base', 'data-[variant=label]:text-sm', props.class)"
  >
    <slot />
  </legend>
</template>
