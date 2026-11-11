<script setup lang="ts">
import type { PopoverAnchorProps } from "reka-ui";
import { PopoverAnchor } from "reka-ui";
import { computed } from "vue";

const props = withDefaults(
  defineProps<{
    reference?: PopoverAnchorProps["reference"] | undefined;
    asChild?: boolean;
    as?: PopoverAnchorProps["as"] | undefined;
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
  <PopoverAnchor data-slot="popover-anchor" v-bind="delegatedProps">
    <slot />
  </PopoverAnchor>
</template>
