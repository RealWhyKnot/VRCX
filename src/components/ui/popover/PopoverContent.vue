<script setup lang="ts">
import type { ClassValue } from "clsx";
import type { PopoverContentEmits, PopoverContentProps } from "reka-ui";
import { PopoverContent, PopoverPortal, useForwardPropsEmits } from "reka-ui";
import { cn } from "@/lib/utils";
import { computed } from "vue";

defineOptions({
  inheritAttrs: false,
});

const props = withDefaults(
  defineProps<{
    forceMount?: boolean;
    side?: PopoverContentProps["side"] | undefined;
    sideOffset?: number;
    sideFlip?: boolean;
    align?: PopoverContentProps["align"];
    alignOffset?: number | undefined;
    alignFlip?: boolean;
    avoidCollisions?: boolean;
    collisionBoundary?: PopoverContentProps["collisionBoundary"] | undefined;
    collisionPadding?: PopoverContentProps["collisionPadding"] | undefined;
    arrowPadding?: number | undefined;
    sticky?: PopoverContentProps["sticky"] | undefined;
    hideWhenDetached?: boolean;
    positionStrategy?: PopoverContentProps["positionStrategy"] | undefined;
    updatePositionStrategy?: PopoverContentProps["updatePositionStrategy"] | undefined;
    disableUpdateOnLayoutShift?: boolean;
    prioritizePosition?: boolean;
    reference?: PopoverContentProps["reference"] | undefined;
    asChild?: boolean;
    as?: PopoverContentProps["as"] | undefined;
    disableOutsidePointerEvents?: boolean;
    class?: ClassValue | undefined;
  }>(),
  {
    side: undefined,
    sideOffset: 4,
    align: "center",
    alignOffset: undefined,
    collisionBoundary: undefined,
    collisionPadding: undefined,
    arrowPadding: undefined,
    sticky: undefined,
    positionStrategy: undefined,
    updatePositionStrategy: undefined,
    reference: undefined,
    as: undefined,
    class: undefined,
  }
);

const emits = defineEmits<PopoverContentEmits>();

const delegatedProps = computed(() => ({
  forceMount: props.forceMount,
  ...(props.side === undefined ? {} : { side: props.side }),
  sideOffset: props.sideOffset,
  sideFlip: props.sideFlip,
  align: props.align,
  ...(props.alignOffset === undefined ? {} : { alignOffset: props.alignOffset }),
  alignFlip: props.alignFlip,
  avoidCollisions: props.avoidCollisions,
  ...(props.collisionBoundary === undefined ? {} : { collisionBoundary: props.collisionBoundary }),
  ...(props.collisionPadding === undefined ? {} : { collisionPadding: props.collisionPadding }),
  ...(props.arrowPadding === undefined ? {} : { arrowPadding: props.arrowPadding }),
  ...(props.sticky === undefined ? {} : { sticky: props.sticky }),
  hideWhenDetached: props.hideWhenDetached,
  ...(props.positionStrategy === undefined ? {} : { positionStrategy: props.positionStrategy }),
  ...(props.updatePositionStrategy === undefined ? {} : { updatePositionStrategy: props.updatePositionStrategy }),
  disableUpdateOnLayoutShift: props.disableUpdateOnLayoutShift,
  prioritizePosition: props.prioritizePosition,
  ...(props.reference === undefined ? {} : { reference: props.reference }),
  asChild: props.asChild,
  ...(props.as === undefined ? {} : { as: props.as }),
  disableOutsidePointerEvents: props.disableOutsidePointerEvents,
}));

const forwarded = useForwardPropsEmits(delegatedProps, emits);
</script>

<template>
  <PopoverPortal>
    <PopoverContent
      data-slot="popover-content"
      v-bind="{ ...$attrs, ...forwarded }"
      :class="
        cn(
          'bg-popover text-popover-foreground data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 z-12000 w-72 rounded-md border p-4 shadow-md origin-(--reka-popover-content-transform-origin) outline-hidden',
          props.class
        )
      "
    >
      <slot />
    </PopoverContent>
  </PopoverPortal>
</template>
