<script setup lang="ts">
import type { PrimitiveProps } from "reka-ui";
import { RangeCalendarGridBody } from "reka-ui";
import { computed } from "vue";

const props = withDefaults(
  defineProps<{
    asChild?: boolean;
    as?: PrimitiveProps["as"] | undefined;
  }>(),
  {
    as: undefined,
  }
);

const delegatedProps = computed(() => ({
  asChild: props.asChild,
  ...(props.as === undefined ? {} : { as: props.as }),
}));
</script>

<template>
  <RangeCalendarGridBody data-slot="range-calendar-grid-body" v-bind="delegatedProps">
    <slot />
  </RangeCalendarGridBody>
</template>
