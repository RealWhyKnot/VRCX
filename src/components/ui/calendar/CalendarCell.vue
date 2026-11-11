<script setup lang="ts">
import type { CalendarCellProps, PrimitiveProps } from "reka-ui";
import type { ClassValue } from "clsx";
import { CalendarCell, useForwardProps } from "reka-ui";
import { cn } from "@/lib/utils";
import { reactiveOmit } from "@vueuse/core";

const props = withDefaults(
  defineProps<{
    date: CalendarCellProps["date"];
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
  <CalendarCell
    data-slot="calendar-cell"
    :class="
      cn(
        'relative p-0 text-center text-sm focus-within:relative focus-within:z-20 [&:has([data-selected])]:rounded-md [&:has([data-selected])]:bg-accent',
        props.class
      )
    "
    v-bind="forwardedProps"
    :date="props.date"
  >
    <slot />
  </CalendarCell>
</template>
