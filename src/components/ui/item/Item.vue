<script setup lang="ts">
import type { PrimitiveProps } from "reka-ui";
import type { ClassValue } from "clsx";
import type { VariantProps } from "class-variance-authority";
import { Primitive } from "reka-ui";
import { cn } from "@/lib/utils";
import { itemVariants } from ".";

defineOptions({ name: "UiItem" });

const props = withDefaults(
  defineProps<{
    asChild?: boolean;
    as?: PrimitiveProps["as"] | undefined;
    class?: ClassValue | undefined;
    variant?: VariantProps<typeof itemVariants>["variant"] | undefined;
    size?: VariantProps<typeof itemVariants>["size"] | undefined;
  }>(),
  {
    as: "div",
    class: undefined,
    variant: undefined,
    size: undefined,
  }
);
</script>

<template>
  <Primitive data-slot="item" :as="as" :as-child="asChild" :class="cn(itemVariants({ variant, size }), props.class)">
    <slot />
  </Primitive>
</template>
