<script setup lang="ts">
import type { PrimitiveProps, SeparatorProps } from "reka-ui";
import type { ClassValue } from "clsx";
import { Separator } from "reka-ui";
import { cn } from "@/lib/utils";
import { computed } from "vue";

defineOptions({ name: "UiSeparator" });

const props = withDefaults(
  defineProps<{
    orientation?: SeparatorProps["orientation"];
    decorative?: boolean;
    asChild?: boolean;
    as?: PrimitiveProps["as"] | undefined;
    class?: ClassValue | undefined;
  }>(),
  {
    orientation: "horizontal",
    decorative: true,
    as: undefined,
    class: undefined,
  }
);

const delegatedProps = computed(() => ({
  orientation: props.orientation,
  decorative: props.decorative,
  asChild: props.asChild,
  ...(props.as === undefined ? {} : { as: props.as }),
}));
</script>

<template>
  <Separator
    data-slot="separator"
    v-bind="delegatedProps"
    :class="
      cn(
        'bg-border shrink-0 data-[orientation=horizontal]:h-px data-[orientation=horizontal]:w-full data-[orientation=vertical]:h-full data-[orientation=vertical]:w-px',
        props.class
      )
    "
  />
</template>
