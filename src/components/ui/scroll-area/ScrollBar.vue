<script setup lang="ts">
import type { PrimitiveProps, ScrollAreaScrollbarProps } from "reka-ui";
import type { ClassValue } from "clsx";
import { computed } from "vue";
import { ScrollAreaScrollbar, ScrollAreaThumb } from "reka-ui";
import { cn } from "@/lib/utils";

const props = withDefaults(
  defineProps<{
    orientation?: ScrollAreaScrollbarProps["orientation"];
    forceMount?: boolean;
    asChild?: boolean;
    as?: PrimitiveProps["as"] | undefined;
    class?: ClassValue | undefined;
  }>(),
  {
    orientation: "vertical",
    as: undefined,
    class: undefined,
  }
);

const delegatedProps = computed(() => ({
  orientation: props.orientation,
  forceMount: props.forceMount,
  asChild: props.asChild,
  ...(props.as === undefined ? {} : { as: props.as }),
}));
</script>

<template>
  <ScrollAreaScrollbar
    data-slot="scroll-area-scrollbar"
    v-bind="delegatedProps"
    :class="
      cn(
        'flex touch-none p-px transition-colors select-none',
        orientation === 'vertical' && 'h-full w-2.5 border-l border-l-transparent',
        orientation === 'horizontal' && 'h-2.5 flex-col border-t border-t-transparent',
        props.class
      )
    "
  >
    <ScrollAreaThumb data-slot="scroll-area-thumb" class="bg-border relative flex-1 rounded-full" />
  </ScrollAreaScrollbar>
</template>
