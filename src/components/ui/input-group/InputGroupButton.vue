<script setup lang="ts">
import type { VariantProps } from "class-variance-authority";
import type { ClassValue } from "clsx";
import type { buttonVariants } from "@/components/ui/button";
import Button from "@/components/ui/button/Button.vue";
import { cn } from "@/lib/utils";

import { inputGroupButtonVariants } from ".";

const props = withDefaults(
  defineProps<{
    size?: VariantProps<typeof inputGroupButtonVariants>["size"] | undefined;
    variant?: VariantProps<typeof buttonVariants>["variant"] | undefined;
    class?: ClassValue | undefined;
  }>(),
  {
    size: "xs",
    variant: "ghost",
    class: undefined,
  }
);
</script>

<template>
  <Button type="button" :data-size="props.size" :variant="props.variant" :class="cn(inputGroupButtonVariants({ size: props.size }), props.class)">
    <slot />
  </Button>
</template>
