<script setup lang="ts">
import type { PrimitiveProps } from "reka-ui";
import { SelectValue } from "reka-ui";
import { computed } from "vue";

const props = withDefaults(
  defineProps<{
    placeholder?: string | undefined;
    asChild?: boolean;
    as?: PrimitiveProps["as"] | undefined;
  }>(),
  {
    placeholder: undefined,
    as: undefined,
  }
);

const delegatedProps = computed(() => ({
  ...(props.placeholder === undefined ? {} : { placeholder: props.placeholder }),
  asChild: props.asChild,
  ...(props.as === undefined ? {} : { as: props.as }),
}));
</script>

<template>
  <SelectValue data-slot="select-value" v-bind="delegatedProps">
    <slot />
  </SelectValue>
</template>
