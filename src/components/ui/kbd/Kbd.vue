<script setup lang="ts">
import type { ClassValue } from "clsx";
import { cn } from "@/lib/utils";

defineOptions({ name: "UiKbd" });

const props = withDefaults(
  defineProps<{
    class?: ClassValue | undefined;
  }>(),
  {
    class: undefined,
  }
);
</script>

<template>
  <kbd
    :class="
      cn(
        'bg-muted text-muted-foreground pointer-events-none inline-flex h-5 w-fit min-w-5 items-center justify-center gap-1 rounded-sm px-1 font-sans text-xs font-medium select-none',
        '[&_svg:not([class*=\'size-\'])]:size-3',
        '[[data-slot=tooltip-content]_&]:bg-background/20 [[data-slot=tooltip-content]_&]:text-background dark:[[data-slot=tooltip-content]_&]:bg-background/10',
        props.class
      )
    "
  >
    <slot />
  </kbd>
</template>
