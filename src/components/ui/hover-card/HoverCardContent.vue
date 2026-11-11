<script setup lang="ts">
import type { ClassValue } from "clsx";
import type { HoverCardContentProps, PrimitiveProps } from "reka-ui";
import { HoverCardContent, HoverCardPortal, useForwardProps } from "reka-ui";
import { cn } from "@/lib/utils";
import { reactiveOmit } from "@vueuse/core";

defineOptions({
  inheritAttrs: false,
});

const props = withDefaults(
  defineProps<{
    forceMount?: boolean;
    side?: HoverCardContentProps["side"] | undefined;
    sideOffset?: number | undefined;
    sideFlip?: boolean;
    align?: HoverCardContentProps["align"] | undefined;
    alignOffset?: number | undefined;
    alignFlip?: boolean;
    avoidCollisions?: boolean;
    collisionBoundary?: HoverCardContentProps["collisionBoundary"] | undefined;
    collisionPadding?: HoverCardContentProps["collisionPadding"] | undefined;
    arrowPadding?: number | undefined;
    sticky?: HoverCardContentProps["sticky"] | undefined;
    hideWhenDetached?: boolean;
    positionStrategy?: HoverCardContentProps["positionStrategy"] | undefined;
    updatePositionStrategy?: HoverCardContentProps["updatePositionStrategy"] | undefined;
    disableUpdateOnLayoutShift?: boolean;
    prioritizePosition?: boolean;
    reference?: HoverCardContentProps["reference"] | undefined;
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

const delegatedProps: Record<string, unknown> = reactiveOmit(props, "class");

const forwardedProps = useForwardProps(delegatedProps);
</script>

<template>
  <HoverCardPortal>
    <HoverCardContent
      data-slot="hover-card-content"
      v-bind="{ ...$attrs, ...forwardedProps }"
      :class="
        cn(
          'bg-popover text-popover-foreground data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 z-12000 w-64 rounded-md border p-4 shadow-md outline-hidden',
          props.class
        )
      "
    >
      <slot />
    </HoverCardContent>
  </HoverCardPortal>
</template>
