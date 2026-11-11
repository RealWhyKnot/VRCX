<script setup lang="ts">
import type { TooltipContentEmits, TooltipContentProps } from "reka-ui";
import type { ClassValue } from "clsx";
import type { PrimitiveProps } from "reka-ui";
import { TooltipArrow, TooltipContent, TooltipPortal, useForwardPropsEmits } from "reka-ui";
import { cn } from "@/lib/utils";
import { computed } from "vue";

defineOptions({
  inheritAttrs: false,
});

const props = withDefaults(
  defineProps<{
    forceMount?: boolean;
    ariaLabel?: string | undefined;
    asChild?: boolean;
    as?: PrimitiveProps["as"] | undefined;
    side?: TooltipContentProps["side"] | undefined;
    sideOffset?: number;
    align?: TooltipContentProps["align"] | undefined;
    alignOffset?: number | undefined;
    avoidCollisions?: boolean;
    collisionBoundary?: TooltipContentProps["collisionBoundary"] | undefined;
    collisionPadding?: TooltipContentProps["collisionPadding"] | undefined;
    arrowPadding?: number | undefined;
    sticky?: TooltipContentProps["sticky"] | undefined;
    hideWhenDetached?: boolean;
    positionStrategy?: TooltipContentProps["positionStrategy"] | undefined;
    updatePositionStrategy?: TooltipContentProps["updatePositionStrategy"] | undefined;
    class?: ClassValue | undefined;
  }>(),
  {
    ariaLabel: undefined,
    as: undefined,
    side: undefined,
    sideOffset: 4,
    align: undefined,
    alignOffset: undefined,
    collisionBoundary: undefined,
    collisionPadding: undefined,
    arrowPadding: undefined,
    sticky: undefined,
    positionStrategy: undefined,
    updatePositionStrategy: undefined,
    class: undefined,
  }
);

const emits = defineEmits<TooltipContentEmits>();

const delegatedProps = computed(() => ({
  forceMount: props.forceMount,
  ...(props.ariaLabel === undefined ? {} : { ariaLabel: props.ariaLabel }),
  asChild: props.asChild,
  ...(props.as === undefined ? {} : { as: props.as }),
  ...(props.side === undefined ? {} : { side: props.side }),
  sideOffset: props.sideOffset,
  ...(props.align === undefined ? {} : { align: props.align }),
  ...(props.alignOffset === undefined ? {} : { alignOffset: props.alignOffset }),
  avoidCollisions: props.avoidCollisions,
  ...(props.collisionBoundary === undefined ? {} : { collisionBoundary: props.collisionBoundary }),
  ...(props.collisionPadding === undefined ? {} : { collisionPadding: props.collisionPadding }),
  ...(props.arrowPadding === undefined ? {} : { arrowPadding: props.arrowPadding }),
  ...(props.sticky === undefined ? {} : { sticky: props.sticky }),
  hideWhenDetached: props.hideWhenDetached,
  ...(props.positionStrategy === undefined ? {} : { positionStrategy: props.positionStrategy }),
  ...(props.updatePositionStrategy === undefined ? {} : { updatePositionStrategy: props.updatePositionStrategy }),
}));

const forwarded = useForwardPropsEmits(delegatedProps, emits);
</script>

<template>
  <TooltipPortal>
    <TooltipContent
      data-slot="tooltip-content"
      v-bind="{ ...forwarded, ...$attrs }"
      :class="
        cn(
          'bg-foreground text-background animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 z-12000 w-fit rounded-md px-3 py-1.5 text-xs leading-normal text-balance',
          props.class
        )
      "
    >
      <slot />

      <TooltipArrow class="bg-foreground fill-foreground z-12000 size-2.5 translate-y-[calc(-50%-2px)] rotate-45 rounded-[2px]" />
    </TooltipContent>
  </TooltipPortal>
</template>
