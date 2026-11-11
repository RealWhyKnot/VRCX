<script setup lang="ts">
import type { ClassValue } from "clsx";
import type { ContextMenuContentEmits, ContextMenuContentProps, PrimitiveProps } from "reka-ui";
import { reactiveOmit } from "@vueuse/core";
import { ContextMenuContent, ContextMenuPortal, useForwardPropsEmits } from "reka-ui";
import { cn } from "@/lib/utils";

defineOptions({
  inheritAttrs: false,
});

const props = withDefaults(
  defineProps<{
    forceMount?: boolean;
    loop?: boolean;
    sideFlip?: boolean;
    alignOffset?: number | undefined;
    alignFlip?: boolean;
    avoidCollisions?: boolean;
    collisionBoundary?: ContextMenuContentProps["collisionBoundary"] | undefined;
    collisionPadding?: ContextMenuContentProps["collisionPadding"] | undefined;
    hideShiftedArrow?: boolean;
    sticky?: ContextMenuContentProps["sticky"] | undefined;
    hideWhenDetached?: boolean;
    positionStrategy?: ContextMenuContentProps["positionStrategy"] | undefined;
    disableUpdateOnLayoutShift?: boolean;
    prioritizePosition?: boolean;
    reference?: ContextMenuContentProps["reference"] | undefined;
    asChild?: boolean;
    as?: PrimitiveProps["as"] | undefined;
    class?: ClassValue | undefined;
  }>(),
  {
    alignOffset: undefined,
    collisionBoundary: undefined,
    collisionPadding: undefined,
    sticky: undefined,
    positionStrategy: undefined,
    reference: undefined,
    as: undefined,
    class: undefined,
  }
);
const emits = defineEmits<ContextMenuContentEmits>();

const delegatedProps: Record<string, unknown> = reactiveOmit(props, "class");

const forwarded = useForwardPropsEmits(delegatedProps, emits);
</script>

<template>
  <ContextMenuPortal>
    <ContextMenuContent
      data-slot="context-menu-content"
      v-bind="{ ...$attrs, ...forwarded }"
      :class="
        cn(
          'bg-popover text-popover-foreground data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 z-50 max-h-(--reka-context-menu-content-available-height) min-w-[8rem] overflow-x-hidden overflow-y-auto rounded-md border p-1 shadow-md',
          props.class
        )
      "
    >
      <slot />
    </ContextMenuContent>
  </ContextMenuPortal>
</template>
