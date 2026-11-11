<script setup lang="ts">
import type { PrimitiveProps, RangeCalendarCellProps } from "reka-ui";
import { RangeCalendarCell, useForwardProps } from "reka-ui";
import type { ClassValue } from "clsx";
import { cn } from "@/lib/utils";
import { computed } from "vue";

const props = withDefaults(
  defineProps<{
    date: RangeCalendarCellProps["date"];
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
  date: props.date,
  asChild: props.asChild,
  ...(props.as === undefined ? {} : { as: props.as }),
}));

const forwardedProps = useForwardProps(delegatedProps);
</script>

<template>
  <RangeCalendarCell
    data-slot="range-calendar-cell"
    :class="
      cn(
        'relative p-0 text-center text-sm focus-within:relative focus-within:z-20 [&:has([data-selected])]:bg-accent first:[&:has([data-selected])]:rounded-l-md last:[&:has([data-selected])]:rounded-r-md [&:has([data-selected][data-selection-end])]:rounded-r-md [&:has([data-selected][data-selection-start])]:rounded-l-md',
        props.class
      )
    "
    v-bind="forwardedProps"
    :date="props.date"
  >
    <slot />
  </RangeCalendarCell>
</template>
