<script setup lang="ts">
import type { ClassValue } from "clsx";
import type { DropdownMenuContentEmits, DropdownMenuContentProps, PrimitiveProps } from "reka-ui";
import { DropdownMenuContent, DropdownMenuPortal, useForwardPropsEmits } from "reka-ui";
import { cn } from "@/lib/utils";
import { reactiveOmit } from "@vueuse/core";

defineOptions({
  inheritAttrs: false,
});

const props = withDefaults(
  defineProps<{
    forceMount?: boolean;
    loop?: boolean;
    side?: DropdownMenuContentProps["side"] | undefined;
    sideOffset?: number | undefined;
    sideFlip?: boolean;
    align?: DropdownMenuContentProps["align"] | undefined;
    alignOffset?: number | undefined;
    alignFlip?: boolean;
    avoidCollisions?: boolean;
    collisionBoundary?: DropdownMenuContentProps["collisionBoundary"] | undefined;
    collisionPadding?: DropdownMenuContentProps["collisionPadding"] | undefined;
    arrowPadding?: number | undefined;
    sticky?: DropdownMenuContentProps["sticky"] | undefined;
    hideWhenDetached?: boolean;
    positionStrategy?: DropdownMenuContentProps["positionStrategy"] | undefined;
    updatePositionStrategy?: DropdownMenuContentProps["updatePositionStrategy"] | undefined;
    disableUpdateOnLayoutShift?: boolean;
    prioritizePosition?: boolean;
    reference?: DropdownMenuContentProps["reference"] | undefined;
    asChild?: boolean;
    as?: PrimitiveProps["as"] | undefined;
    class?: ClassValue | undefined;
  }>(),
  {
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
    reference: undefined,
    as: undefined,
    class: undefined,
  }
);
const emits = defineEmits<DropdownMenuContentEmits>();

const delegatedProps: Record<string, unknown> = reactiveOmit(props, "class");

const forwarded = useForwardPropsEmits(delegatedProps, emits);
</script>

<template>
  <DropdownMenuPortal>
    <DropdownMenuContent
      data-slot="dropdown-menu-content"
      v-bind="{ ...$attrs, ...forwarded }"
      :class="
        cn(
          'bg-popover text-popover-foreground data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 z-12000 max-h-(--reka-dropdown-menu-content-available-height) min-w-[8rem] origin-(--reka-dropdown-menu-content-transform-origin) overflow-x-hidden overflow-y-auto rounded-md border p-1 shadow-md',
          props.class
        )
      "
    >
      <slot />
    </DropdownMenuContent>
  </DropdownMenuPortal>
</template>
