<script setup lang="ts">
import { TooltipRoot, useForwardPropsEmits } from "reka-ui";
import type { TooltipRootEmits } from "reka-ui";
import { computed } from "vue";

defineOptions({ name: "UiTooltip" });

const props = withDefaults(
  defineProps<{
    defaultOpen?: boolean;
    open?: boolean;
    delayDuration?: number | undefined;
    disableHoverableContent?: boolean;
    disableClosingTrigger?: boolean;
    disabled?: boolean;
    ignoreNonKeyboardFocus?: boolean;
  }>(),
  {
    delayDuration: undefined,
  }
);
const emits = defineEmits<TooltipRootEmits>();

const delegatedProps = computed(() => ({
  defaultOpen: props.defaultOpen,
  open: props.open,
  ...(props.delayDuration === undefined ? {} : { delayDuration: props.delayDuration }),
  disableHoverableContent: props.disableHoverableContent,
  disableClosingTrigger: props.disableClosingTrigger,
  disabled: props.disabled,
  ignoreNonKeyboardFocus: props.ignoreNonKeyboardFocus,
}));

const forwarded = useForwardPropsEmits(delegatedProps, emits);
</script>

<template>
  <TooltipRoot v-slot="slotProps" data-slot="tooltip" v-bind="forwarded">
    <slot v-bind="slotProps" />
  </TooltipRoot>
</template>
