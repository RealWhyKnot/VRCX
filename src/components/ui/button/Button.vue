<script setup lang="ts">
import type { ClassValue } from "clsx";
import type { VariantProps } from "class-variance-authority";
import type { PrimitiveProps } from "reka-ui";
import { Primitive } from "reka-ui";
import { cn } from "@/lib/utils";
import { computed } from "vue";

import { buttonVariants } from ".";

defineOptions({ name: "UiButton" });

const props = withDefaults(
  defineProps<{
    variant?: VariantProps<typeof buttonVariants>["variant"] | undefined;
    size?: VariantProps<typeof buttonVariants>["size"] | undefined;
    class?: ClassValue | undefined;
    disabled?: boolean;
    asChild?: boolean;
    as?: PrimitiveProps["as"] | undefined;
    ariaLabel?: string | undefined;
  }>(),
  {
    variant: undefined,
    size: undefined,
    class: undefined,
    as: "button",
    ariaLabel: undefined,
  }
);

const isNativeButton = computed(() => props.as === "button" && !props.asChild);

const computedAriaLabel = computed(() => {
  return props.ariaLabel;
});
</script>

<template>
  <Primitive
    data-slot="button"
    :as="as"
    :as-child="asChild"
    :disabled="isNativeButton ? props.disabled : undefined"
    :data-disabled="props.disabled ? '' : undefined"
    :aria-disabled="props.disabled || undefined"
    :aria-label="computedAriaLabel"
    v-bind="$attrs"
    :class="cn(buttonVariants({ variant, size }), props.class)"
  >
    <slot />
  </Primitive>
</template>
