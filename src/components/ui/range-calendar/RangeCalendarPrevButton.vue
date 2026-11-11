<script setup lang="ts">
import type { PrimitiveProps, RangeCalendarRootProps } from "reka-ui";
import { RangeCalendarPrev, useForwardProps } from "reka-ui";
import type { ClassValue } from "clsx";
import { ChevronLeft } from "lucide-vue-next";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { computed } from "vue";

const props = defineProps<{
  prevPage?: RangeCalendarRootProps["prevPage"] | undefined;
  asChild?: boolean;
  as?: PrimitiveProps["as"] | undefined;
  class?: ClassValue | undefined;
}>();

const delegatedProps = computed(() => ({
  ...(props.prevPage === undefined ? {} : { prevPage: props.prevPage }),
  asChild: props.asChild,
  ...(props.as === undefined ? {} : { as: props.as }),
}));

const forwardedProps = useForwardProps(delegatedProps);
</script>

<template>
  <RangeCalendarPrev
    data-slot="range-calendar-prev-button"
    :class="cn(buttonVariants({ variant: 'outline' }), 'absolute left-1', 'size-7 bg-transparent p-0 opacity-50 hover:opacity-100', props.class)"
    v-bind="forwardedProps"
  >
    <slot>
      <ChevronLeft class="size-4" />
    </slot>
  </RangeCalendarPrev>
</template>
