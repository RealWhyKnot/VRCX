<script setup lang="ts">
import type { ClassValue } from "clsx";
import type { DropdownMenuSubContentEmits, DropdownMenuSubContentProps, PrimitiveProps } from "reka-ui";
import { DropdownMenuSubContent, useForwardPropsEmits } from "reka-ui";
import { cn } from "@/lib/utils";
import { reactiveOmit } from "@vueuse/core";

const props = withDefaults(
  defineProps<{
    forceMount?: boolean;
    loop?: boolean;
    sideOffset?: number | undefined;
    sideFlip?: boolean;
    alignOffset?: number | undefined;
    alignFlip?: boolean;
    avoidCollisions?: boolean;
    collisionBoundary?: DropdownMenuSubContentProps["collisionBoundary"] | undefined;
    collisionPadding?: DropdownMenuSubContentProps["collisionPadding"] | undefined;
    arrowPadding?: number | undefined;
    sticky?: DropdownMenuSubContentProps["sticky"] | undefined;
    hideWhenDetached?: boolean;
    positionStrategy?: DropdownMenuSubContentProps["positionStrategy"] | undefined;
    updatePositionStrategy?: DropdownMenuSubContentProps["updatePositionStrategy"] | undefined;
    disableUpdateOnLayoutShift?: boolean;
    prioritizePosition?: boolean;
    reference?: DropdownMenuSubContentProps["reference"] | undefined;
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
const emits = defineEmits<DropdownMenuSubContentEmits>();

const delegatedProps: Record<string, unknown> = reactiveOmit(props, "class");

const forwarded = useForwardPropsEmits(delegatedProps, emits);
</script>

<template>
  <DropdownMenuSubContent
    data-slot="dropdown-menu-sub-content"
    v-bind="forwarded"
    :class="
      cn(
        'bg-popover text-popover-foreground data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 z-12000 min-w-32 origin-(--reka-dropdown-menu-content-transform-origin) overflow-hidden rounded-md border p-1 shadow-lg',
        props.class
      )
    "
  >
    <slot />
  </DropdownMenuSubContent>
</template>
