<script setup lang="ts">
import type { PrimitiveProps } from "reka-ui";
import { SelectItemText } from "reka-ui";
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
  <SelectItemText data-slot="select-item-text" v-bind="delegatedProps">
    <slot />
  </SelectItemText>
</template>
