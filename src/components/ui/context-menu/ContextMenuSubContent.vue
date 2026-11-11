<script setup lang="ts">
import type { ClassValue } from "clsx";
import type { ContextMenuSubContentEmits, ContextMenuSubContentProps, PrimitiveProps } from "reka-ui";
import { reactiveOmit } from "@vueuse/core";
import { ContextMenuSubContent, useForwardPropsEmits } from "reka-ui";
import { cn } from "@/lib/utils";

const props = withDefaults(
  defineProps<{
    forceMount?: boolean;
    loop?: boolean;
    sideOffset?: number | undefined;
    sideFlip?: boolean;
    alignOffset?: number | undefined;
    alignFlip?: boolean;
    avoidCollisions?: boolean;
    collisionBoundary?: ContextMenuSubContentProps["collisionBoundary"] | undefined;
    collisionPadding?: ContextMenuSubContentProps["collisionPadding"] | undefined;
    arrowPadding?: number | undefined;
    hideShiftedArrow?: boolean;
    sticky?: ContextMenuSubContentProps["sticky"] | undefined;
    hideWhenDetached?: boolean;
    positionStrategy?: ContextMenuSubContentProps["positionStrategy"] | undefined;
    updatePositionStrategy?: ContextMenuSubContentProps["updatePositionStrategy"] | undefined;
    disableUpdateOnLayoutShift?: boolean;
    prioritizePosition?: boolean;
    reference?: ContextMenuSubContentProps["reference"] | undefined;
    asChild?: boolean;
    as?: PrimitiveProps["as"] | undefined;
    class?: ClassValue | undefined;
  }>(),
  {
    sideOffset: undefined,
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
const emits = defineEmits<ContextMenuSubContentEmits>();

const delegatedProps: Record<string, unknown> = reactiveOmit(props, "class");

const forwarded = useForwardPropsEmits(delegatedProps, emits);
</script>

<template>
  <ContextMenuSubContent
    data-slot="context-menu-sub-content"
    v-bind="forwarded"
    :class="
      cn(
        'bg-popover text-popover-foreground data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 z-50 min-w-[8rem] origin-(--reka-context-menu-content-transform-origin) overflow-hidden rounded-md border p-1 shadow-lg',
        props.class
      )
    "
  >
    <slot />
  </ContextMenuSubContent>
</template>
