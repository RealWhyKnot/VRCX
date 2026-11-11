<script setup lang="ts">
import type { PrimitiveProps } from "reka-ui";
import type { ClassValue } from "clsx";
import { DialogOverlay } from "reka-ui";
import { cn } from "@/lib/utils";
import { computed } from "vue";

const props = withDefaults(
  defineProps<{
    forceMount?: boolean;
    asChild?: boolean;
    as?: PrimitiveProps["as"] | undefined;
    class?: ClassValue | undefined;
  }>(),
  {
    as: undefined,
    class: undefined,
  }
);

const delegatedProps = computed(() => ({
  forceMount: props.forceMount,
  asChild: props.asChild,
  ...(props.as === undefined ? {} : { as: props.as }),
}));
</script>

<template>
  <DialogOverlay
    data-slot="sheet-overlay"
    :class="
      cn(
        'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-black/80',
        props.class
      )
    "
    v-bind="delegatedProps"
  >
    <slot />
  </DialogOverlay>
</template>
