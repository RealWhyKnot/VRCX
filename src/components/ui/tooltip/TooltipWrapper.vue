<script setup lang="ts">
import type { TooltipContentProps } from "reka-ui";
import { computed, useAttrs, useSlots } from "vue";

import Tooltip from "./Tooltip.vue";
import TooltipContent from "./TooltipContent.vue";
import TooltipTrigger from "./TooltipTrigger.vue";

defineOptions({
  inheritAttrs: false,
});

const props = withDefaults(
  defineProps<{
    content?: string | number | undefined;
    side?: TooltipContentProps["side"] | undefined;
    align?: TooltipContentProps["align"] | undefined;
    sideOffset?: number | undefined;
    delayDuration?: number;
    disableHoverableContent?: boolean;
    ignoreNonKeyboardFocus?: boolean;
    disabled?: boolean;
    triggerAsChild?: boolean;
    contentClass?: string | string[] | Record<string, boolean> | undefined;
  }>(),
  {
    content: undefined,
    side: undefined,
    align: undefined,
    sideOffset: undefined,
    delayDuration: 100,
    ignoreNonKeyboardFocus: true,
    triggerAsChild: true,
    contentClass: undefined,
  }
);

const attrs = useAttrs();
const slots = useSlots();
const hasContent = computed(() => Boolean(slots["content"]) || props.content !== undefined);

const contentProps = computed(() => ({
  ...(props.side === undefined ? {} : { side: props.side }),
  ...(props.align === undefined ? {} : { align: props.align }),
  ...(props.sideOffset === undefined ? {} : { sideOffset: props.sideOffset }),
}));
</script>

<template>
  <Tooltip
    :delay-duration="delayDuration"
    :disable-hoverable-content="disableHoverableContent"
    :ignore-non-keyboard-focus="ignoreNonKeyboardFocus"
    :disabled="disabled"
  >
    <TooltipTrigger :as-child="triggerAsChild" v-bind="attrs">
      <slot />
    </TooltipTrigger>
    <TooltipContent v-if="hasContent" v-bind="contentProps" :class="['max-w-screen', contentClass]">
      <slot name="content">
        <span v-if="content !== undefined" class="whitespace-pre-wrap">{{ content }}</span>
      </slot>
    </TooltipContent>
  </Tooltip>
</template>
