<script setup lang="ts">
import type { VariantProps } from "class-variance-authority";
import type { ClassValue } from "clsx";
import { cn } from "@/lib/utils";

import { buttonGroupVariants } from ".";

const props = withDefaults(
  defineProps<{
    class?: ClassValue | undefined;
    orientation?: VariantProps<typeof buttonGroupVariants>["orientation"] | undefined;
  }>(),
  {
    class: undefined,
    orientation: undefined,
  }
);
</script>

<template>
  <div
    role="group"
    data-slot="button-group"
    :data-orientation="props.orientation"
    :class="cn(buttonGroupVariants({ orientation: props.orientation }), props.class)"
  >
    <slot />
  </div>
</template>
