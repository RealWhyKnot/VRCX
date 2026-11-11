<script setup lang="ts">
import type { PrimitiveProps } from "reka-ui";
import type { ClassValue } from "clsx";
import { DialogDescription, useForwardProps } from "reka-ui";
import { cn } from "@/lib/utils";
import { reactiveOmit } from "@vueuse/core";

const props = withDefaults(
  defineProps<{
    asChild?: boolean;
    as?: PrimitiveProps["as"] | undefined;
    class?: ClassValue | undefined;
  }>(),
  {
    as: undefined,
    class: undefined,
  }
);

const delegatedProps: Record<string, unknown> = reactiveOmit(props, "class");

const forwardedProps = useForwardProps(delegatedProps);
</script>

<template>
  <DialogDescription data-slot="dialog-description" v-bind="forwardedProps" :class="cn('text-muted-foreground text-sm', props.class)">
    <slot />
  </DialogDescription>
</template>
