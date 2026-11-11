<script setup lang="ts">
import type { PrimitiveProps } from "reka-ui";
import { DialogClose } from "reka-ui";
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
  <DialogClose data-slot="sheet-close" v-bind="delegatedProps">
    <slot />
  </DialogClose>
</template>
