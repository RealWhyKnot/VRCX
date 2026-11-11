<script setup lang="ts">
import type { ClassValue } from "clsx";
import type { PrimitiveProps, SelectContentEmits, SelectContentProps } from "reka-ui";
import { SelectContent, SelectPortal, SelectViewport, useForwardPropsEmits } from "reka-ui";
import { cn } from "@/lib/utils";
import { computed } from "vue";

import SelectScrollDownButton from "./SelectScrollDownButton.vue";
import SelectScrollUpButton from "./SelectScrollUpButton.vue";

defineOptions({
  inheritAttrs: false,
});

const props = withDefaults(
  defineProps<{
    forceMount?: boolean;
    position?: string;
    bodyLock?: boolean;
    side?: SelectContentProps["side"] | undefined;
    sideOffset?: number | undefined;
    sideFlip?: boolean;
    align?: SelectContentProps["align"] | undefined;
    alignOffset?: number | undefined;
    alignFlip?: boolean;
    avoidCollisions?: boolean;
    collisionBoundary?: SelectContentProps["collisionBoundary"] | undefined;
    collisionPadding?: SelectContentProps["collisionPadding"] | undefined;
    arrowPadding?: number | undefined;
    sticky?: SelectContentProps["sticky"] | undefined;
    hideWhenDetached?: boolean;
    positionStrategy?: SelectContentProps["positionStrategy"] | undefined;
    updatePositionStrategy?: SelectContentProps["updatePositionStrategy"] | undefined;
    disableUpdateOnLayoutShift?: boolean;
    prioritizePosition?: boolean;
    reference?: SelectContentProps["reference"] | undefined;
    asChild?: boolean;
    as?: PrimitiveProps["as"] | undefined;
    disableOutsidePointerEvents?: boolean;
    class?: ClassValue | undefined;
  }>(),
  {
    position: "popper",
    side: undefined,
    sideOffset: undefined,
    align: undefined,
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
const emits = defineEmits<SelectContentEmits>();

const delegatedProps = computed(() => ({
  forceMount: props.forceMount,
  bodyLock: props.bodyLock,
  ...(props.side === undefined ? {} : { side: props.side }),
  ...(props.sideOffset === undefined ? {} : { sideOffset: props.sideOffset }),
  sideFlip: props.sideFlip,
  ...(props.align === undefined ? {} : { align: props.align }),
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
  <SelectPortal>
    <SelectContent
      data-slot="select-content"
      v-bind="{ ...$attrs, ...forwarded }"
      :class="
        cn(
          'bg-popover text-popover-foreground data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 relative z-12000 max-h-(--reka-select-content-available-height) min-w-[8rem] overflow-x-hidden overflow-y-auto rounded-md border shadow-md',
          position === 'popper' &&
            'data-[side=bottom]:translate-y-1 data-[side=left]:-translate-x-1 data-[side=right]:translate-x-1 data-[side=top]:-translate-y-1',
          props.class
        )
      "
    >
      <SelectScrollUpButton />
      <SelectViewport
        :class="cn('p-1', position === 'popper' && 'h-[var(--reka-select-trigger-height)] w-full min-w-[var(--reka-select-trigger-width)] scroll-my-1')"
      >
        <slot />
      </SelectViewport>
      <SelectScrollDownButton />
    </SelectContent>
  </SelectPortal>
</template>
