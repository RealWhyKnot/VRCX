<script setup lang="ts">
import type { PrimitiveProps, TooltipTriggerProps } from "reka-ui";
import { TooltipTrigger } from "reka-ui";
import { computed } from "vue";

const props = withDefaults(
  defineProps<{
    reference?: TooltipTriggerProps["reference"] | undefined;
    asChild?: boolean;
    as?: PrimitiveProps["as"] | undefined;
  }>(),
  {
    reference: undefined,
    as: undefined,
  }
);

const delegatedProps = computed(() => ({
  ...(props.reference === undefined ? {} : { reference: props.reference }),
  asChild: props.asChild,
  ...(props.as === undefined ? {} : { as: props.as }),
}));
</script>

<template>
  <TooltipTrigger data-slot="tooltip-trigger" v-bind="delegatedProps">
    <slot />
  </TooltipTrigger>
</template>
