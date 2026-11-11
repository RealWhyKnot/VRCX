<script setup lang="ts">
import type { PrimitiveProps } from "reka-ui";
import type { ClassValue } from "clsx";
import type { VariantProps } from "class-variance-authority";
import { AlertDialogAction } from "reka-ui";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { reactiveOmit } from "@vueuse/core";

const props = withDefaults(
  defineProps<{
    asChild?: boolean;
    as?: PrimitiveProps["as"] | undefined;
    variant?: VariantProps<typeof buttonVariants>["variant"] | undefined;
    class?: ClassValue | undefined;
  }>(),
  {
    as: undefined,
    variant: undefined,
    class: undefined,
  }
);

const delegatedProps: Record<string, unknown> = reactiveOmit(props, "class", "variant");
</script>

<template>
  <AlertDialogAction v-bind="delegatedProps" :class="cn(buttonVariants({ variant: props.variant }), props.class)">
    <slot />
  </AlertDialogAction>
</template>
