<script setup lang="ts">
import type { VariantProps } from "class-variance-authority";
import type { ClassValue } from "clsx";
import { cn } from "@/lib/utils";

import { emptyMediaVariants } from ".";

const props = withDefaults(
  defineProps<{
    class?: ClassValue | undefined;
    variant?: VariantProps<typeof emptyMediaVariants>["variant"] | undefined;
  }>(),
  {
    class: undefined,
    variant: undefined,
  }
);
</script>

<template>
  <div data-slot="empty-icon" :data-variant="variant" :class="cn(emptyMediaVariants({ variant }), props.class)">
    <slot />
  </div>
</template>
