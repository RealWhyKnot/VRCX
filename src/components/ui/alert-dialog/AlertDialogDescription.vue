<script setup lang="ts">
import type { PrimitiveProps } from "reka-ui";
import type { ClassValue } from "clsx";
import { AlertDialogDescription } from "reka-ui";
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
</script>

<template>
  <AlertDialogDescription data-slot="alert-dialog-description" v-bind="delegatedProps" :class="cn('text-muted-foreground text-sm', props.class)">
    <slot />
  </AlertDialogDescription>
</template>
