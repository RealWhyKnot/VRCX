<script setup lang="ts">
import type { PrimitiveProps } from "reka-ui";
import type { ClassValue } from "clsx";
import { RangeCalendarGrid, useForwardProps } from "reka-ui";
import { cn } from "@/lib/utils";
import { computed } from "vue";

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

const delegatedProps = computed(() => ({
  asChild: props.asChild,
  ...(props.as === undefined ? {} : { as: props.as }),
}));

const forwardedProps = useForwardProps(delegatedProps);
</script>

<template>
  <RangeCalendarGrid data-slot="range-calendar-grid" :class="cn('w-full border-collapse space-x-1', props.class)" v-bind="forwardedProps">
    <slot />
  </RangeCalendarGrid>
</template>
