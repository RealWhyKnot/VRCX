<script setup lang="ts">
import type { ClassValue } from "clsx";
import type { VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { itemMediaVariants } from ".";

const props = withDefaults(
  defineProps<{
    class?: ClassValue | undefined;
    variant?: VariantProps<typeof itemMediaVariants>["variant"] | undefined;
  }>(),
  {
    class: undefined,
    variant: undefined,
  }
);
</script>

<template>
  <div data-slot="item-media" :data-variant="props.variant" :class="cn(itemMediaVariants({ variant }), props.class)">
    <slot />
  </div>
</template>
