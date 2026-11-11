<script setup lang="ts">
import type { CalendarPrevProps, PrimitiveProps } from "reka-ui";
import type { ClassValue } from "clsx";
import { CalendarPrev, useForwardProps } from "reka-ui";
import { ChevronLeft } from "lucide-vue-next";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { reactiveOmit } from "@vueuse/core";

const props = withDefaults(
  defineProps<{
    prevPage?: CalendarPrevProps["prevPage"] | undefined;
    asChild?: boolean;
    as?: PrimitiveProps["as"] | undefined;
    class?: ClassValue | undefined;
  }>(),
  {
    prevPage: undefined,
    as: undefined,
    class: undefined,
  }
);

const delegatedProps: Record<string, unknown> = reactiveOmit(props, "class");

const forwardedProps = useForwardProps(delegatedProps);
</script>

<template>
  <CalendarPrev
    data-slot="calendar-prev-button"
    :class="cn(buttonVariants({ variant: 'outline' }), 'size-7 bg-transparent p-0 opacity-50 hover:opacity-100', props.class)"
    v-bind="forwardedProps"
  >
    <slot>
      <ChevronLeft class="size-4" />
    </slot>
  </CalendarPrev>
</template>
