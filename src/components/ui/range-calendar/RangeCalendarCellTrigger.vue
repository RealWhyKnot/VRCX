<script setup lang="ts">
import type { PrimitiveProps, RangeCalendarCellTriggerProps } from "reka-ui";
import { RangeCalendarCellTrigger, useForwardProps } from "reka-ui";
import type { ClassValue } from "clsx";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { computed } from "vue";

const props = withDefaults(
  defineProps<{
    day: RangeCalendarCellTriggerProps["day"];
    month: RangeCalendarCellTriggerProps["month"];
    asChild?: boolean;
    as?: PrimitiveProps["as"] | undefined;
    class?: ClassValue | undefined;
  }>(),
  {
    as: "button",
    class: undefined,
  }
);

const delegatedProps = computed(() => ({
  day: props.day,
  month: props.month,
  asChild: props.asChild,
  as: props.as,
}));

const forwardedProps = useForwardProps(delegatedProps);
</script>

<template>
  <RangeCalendarCellTrigger
    data-slot="range-calendar-trigger"
    :class="
      cn(
        buttonVariants({ variant: 'ghost' }),
        'h-8 w-8 p-0 font-normal data-[selected]:opacity-100',
        '[&[data-today]:not([data-selected])]:bg-accent [&[data-today]:not([data-selected])]:text-accent-foreground',

        'data-[selection-start]:bg-primary data-[selection-start]:text-primary-foreground data-[selection-start]:hover:bg-primary data-[selection-start]:hover:text-primary-foreground data-[selection-start]:focus:bg-primary data-[selection-start]:focus:text-primary-foreground',

        'data-[selection-end]:bg-primary data-[selection-end]:text-primary-foreground data-[selection-end]:hover:bg-primary data-[selection-end]:hover:text-primary-foreground data-[selection-end]:focus:bg-primary data-[selection-end]:focus:text-primary-foreground',

        'data-[outside-view]:text-muted-foreground',

        'data-[disabled]:text-muted-foreground data-[disabled]:opacity-50',

        'data-[unavailable]:text-destructive-foreground data-[unavailable]:line-through',
        props.class
      )
    "
    v-bind="forwardedProps"
    :day="props.day"
    :month="props.month"
  >
    <slot />
  </RangeCalendarCellTrigger>
</template>
