<script setup lang="ts">
import type { PrimitiveProps } from "reka-ui";
import type { VariantProps } from "class-variance-authority";
import type { ClassValue } from "clsx";
import { Primitive } from "reka-ui";
import { cn } from "@/lib/utils";

import { buttonGroupVariants } from ".";

const props = withDefaults(
  defineProps<{
    class?: ClassValue | undefined;
    orientation?: VariantProps<typeof buttonGroupVariants>["orientation"] | undefined;
    asChild?: boolean;
    as?: PrimitiveProps["as"] | undefined;
  }>(),
  {
    class: undefined,
    orientation: undefined,
    as: "div",
  }
);
</script>

<template>
  <Primitive
    role="group"
    data-slot="button-group"
    :data-orientation="props.orientation"
    :as="as"
    :as-child="asChild"
    :class="
      cn(
        'bg-muted flex items-center gap-2 rounded-md border px-4 text-sm font-medium shadow-xs [&_svg]:pointer-events-none [&_svg:not([class*=\'size-\'])]:size-4',
        props.class
      )
    "
  >
    <slot />
  </Primitive>
</template>
