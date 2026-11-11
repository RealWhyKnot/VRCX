<script setup lang="ts">
import type { PrimitiveProps } from "reka-ui";
import { DialogTrigger } from "reka-ui";
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
  <DialogTrigger data-slot="sheet-trigger" v-bind="delegatedProps">
    <slot />
  </DialogTrigger>
</template>
