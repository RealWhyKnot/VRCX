<script setup lang="ts">
import { TooltipProvider } from "reka-ui";
import { computed } from "vue";

const props = withDefaults(
  defineProps<{
    delayDuration?: number;
    skipDelayDuration?: number | undefined;
    disableHoverableContent?: boolean;
    disableClosingTrigger?: boolean;
    disabled?: boolean;
    ignoreNonKeyboardFocus?: boolean;
  }>(),
  {
    delayDuration: 0,
    skipDelayDuration: undefined,
    ignoreNonKeyboardFocus: true,
  }
);

const delegatedProps = computed(() => ({
  delayDuration: props.delayDuration,
  ...(props.skipDelayDuration === undefined ? {} : { skipDelayDuration: props.skipDelayDuration }),
  disableHoverableContent: props.disableHoverableContent,
  disableClosingTrigger: props.disableClosingTrigger,
  disabled: props.disabled,
  ignoreNonKeyboardFocus: props.ignoreNonKeyboardFocus,
}));
</script>

<template>
  <TooltipProvider v-bind="delegatedProps">
    <slot />
  </TooltipProvider>
</template>
