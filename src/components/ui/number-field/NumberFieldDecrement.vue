<script setup lang="ts">
import type { PrimitiveProps } from "reka-ui";
import type { ClassValue } from "clsx";
import { NumberFieldDecrement } from "reka-ui";
import { Minus } from "lucide-vue-next";
import { computed } from "vue";
import { cn } from "@/lib/utils";

const props = defineProps<{
  disabled?: boolean;
  asChild?: boolean;
  as?: PrimitiveProps["as"];
  class?: ClassValue;
}>();

const delegatedProps = computed(() => ({
  disabled: props.disabled,
  asChild: props.asChild,
  ...(props.as === undefined ? {} : { as: props.as }),
}));
</script>

<template>
  <NumberFieldDecrement
    data-slot="decrement"
    v-bind="delegatedProps"
    :class="cn('absolute top-1/2 -translate-y-1/2 left-0 p-3 disabled:cursor-not-allowed disabled:opacity-20', props.class)"
  >
    <slot>
      <Minus class="h-4 w-4" />
    </slot>
  </NumberFieldDecrement>
</template>
