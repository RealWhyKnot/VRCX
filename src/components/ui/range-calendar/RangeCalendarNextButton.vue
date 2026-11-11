<script setup lang="ts">
import type { PrimitiveProps, RangeCalendarRootProps } from "reka-ui";
import { RangeCalendarNext, useForwardProps } from "reka-ui";
import type { ClassValue } from "clsx";
import { ChevronRight } from "lucide-vue-next";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { computed } from "vue";

const props = defineProps<{
  nextPage?: RangeCalendarRootProps["nextPage"] | undefined;
  asChild?: boolean;
  as?: PrimitiveProps["as"] | undefined;
  class?: ClassValue | undefined;
}>();

const delegatedProps = computed(() => ({
  ...(props.nextPage === undefined ? {} : { nextPage: props.nextPage }),
  asChild: props.asChild,
  ...(props.as === undefined ? {} : { as: props.as }),
}));

const forwardedProps = useForwardProps(delegatedProps);
</script>

<template>
  <RangeCalendarNext
    data-slot="range-calendar-next-button"
    :class="cn(buttonVariants({ variant: 'outline' }), 'absolute right-1', 'size-7 bg-transparent p-0 opacity-50 hover:opacity-100', props.class)"
    v-bind="forwardedProps"
  >
    <slot>
      <ChevronRight class="size-4" />
    </slot>
  </RangeCalendarNext>
</template>
