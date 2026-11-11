<script setup lang="ts">
import type { DateValue, PrimitiveProps } from "reka-ui";
import type { ClassValue } from "clsx";
import { CalendarCellTrigger, useForwardProps } from "reka-ui";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { reactiveOmit } from "@vueuse/core";

const props = withDefaults(
  defineProps<{
    day: DateValue;
    month: DateValue;
    asChild?: boolean;
    as?: PrimitiveProps["as"] | undefined;
    class?: ClassValue | undefined;
  }>(),
  {
    as: "button",
    class: undefined,
  }
);

const delegatedProps: Record<string, unknown> = reactiveOmit(props, "class");

const forwardedProps = useForwardProps(delegatedProps);
</script>

<template>
  <CalendarCellTrigger
    data-slot="calendar-cell-trigger"
    :class="
      cn(
        buttonVariants({ variant: 'ghost' }),
        'size-8 p-0 font-normal aria-selected:opacity-100 cursor-default',
        '[&[data-today]:not([data-selected])]:bg-accent [&[data-today]:not([data-selected])]:text-accent-foreground',

        'data-[selected]:bg-primary data-[selected]:text-primary-foreground data-[selected]:opacity-100 data-[selected]:hover:bg-primary data-[selected]:hover:text-primary-foreground data-[selected]:focus:bg-primary data-[selected]:focus:text-primary-foreground',

        'data-[disabled]:text-muted-foreground data-[disabled]:opacity-50',

        'data-[unavailable]:text-destructive-foreground data-[unavailable]:line-through',

        'data-[outside-view]:text-muted-foreground',
        props.class
      )
    "
    v-bind="forwardedProps"
    :day="props.day"
    :month="props.month"
  >
    <slot />
  </CalendarCellTrigger>
</template>
