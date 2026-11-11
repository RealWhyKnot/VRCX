<script setup lang="ts">
import type { PrimitiveProps } from "reka-ui";
import type { ClassValue } from "clsx";
import { RangeCalendarHeading, useForwardProps } from "reka-ui";
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

defineSlots();

const delegatedProps = computed(() => ({
  asChild: props.asChild,
  ...(props.as === undefined ? {} : { as: props.as }),
}));

const forwardedProps = useForwardProps(delegatedProps);
</script>

<template>
  <RangeCalendarHeading v-slot="{ headingValue }" data-slot="range-calendar-heading" :class="cn('text-sm font-medium', props.class)" v-bind="forwardedProps">
    <slot :heading-value>
      {{ headingValue }}
    </slot>
  </RangeCalendarHeading>
</template>
