<script setup lang="ts">
import type { PrimitiveProps } from "reka-ui";
import type { ClassValue } from "clsx";
import { NumberFieldIncrement } from "reka-ui";
import { Plus } from "lucide-vue-next";
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
  <NumberFieldIncrement
    data-slot="increment"
    v-bind="delegatedProps"
    :class="cn('absolute top-1/2 -translate-y-1/2 right-0 disabled:cursor-not-allowed disabled:opacity-20 p-3', props.class)"
  >
    <slot>
      <Plus class="h-4 w-4" />
    </slot>
  </NumberFieldIncrement>
</template>
