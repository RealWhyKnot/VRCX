<script setup lang="ts">
import type { ClassValue } from "clsx";
import type { AcceptableValue, ContextMenuRadioItemEmits, PrimitiveProps } from "reka-ui";
import { reactiveOmit } from "@vueuse/core";
import { Circle } from "lucide-vue-next";
import { ContextMenuItemIndicator, ContextMenuRadioItem, useForwardPropsEmits } from "reka-ui";
import { cn } from "@/lib/utils";

const props = withDefaults(
  defineProps<{
    value: AcceptableValue;
    disabled?: boolean;
    textValue?: string | undefined;
    asChild?: boolean;
    as?: PrimitiveProps["as"] | undefined;
    class?: ClassValue | undefined;
  }>(),
  {
    textValue: undefined,
    as: undefined,
    class: undefined,
  }
);
const emits = defineEmits<ContextMenuRadioItemEmits>();

const delegatedProps: Record<string, unknown> = reactiveOmit(props, "class");

const forwarded = useForwardPropsEmits(delegatedProps, emits);
</script>

<template>
  <ContextMenuRadioItem
    data-slot="context-menu-radio-item"
    v-bind="forwarded"
    :value="props.value"
    :class="
      cn(
        'focus:bg-accent focus:text-accent-foreground relative flex cursor-pointer items-center gap-2 rounded-sm py-1.5 pr-2 pl-8 text-sm outline-hidden select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*=\'size-\'])]:size-4',
        props.class
      )
    "
  >
    <span class="pointer-events-none absolute left-2 flex size-3.5 items-center justify-center">
      <ContextMenuItemIndicator>
        <slot name="indicator-icon">
          <Circle class="size-2 fill-current" />
        </slot>
      </ContextMenuItemIndicator>
    </span>
    <slot />
  </ContextMenuRadioItem>
</template>
