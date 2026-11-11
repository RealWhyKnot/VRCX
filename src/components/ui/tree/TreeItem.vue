<script setup lang="ts">
import type { ClassValue } from "clsx";
import { TreeItem as RekaTreeItem } from "reka-ui";
import { cn } from "@/lib/utils";

const props = withDefaults(
  defineProps<{
    value: object;
    level?: number;
    asChild?: boolean;
    class?: ClassValue | undefined;
  }>(),
  {
    level: 0,
    asChild: false,
    class: undefined,
  }
);
</script>

<template>
  <RekaTreeItem
    v-slot="slotProps"
    :value="props.value"
    :level="props.level"
    :as-child="props.asChild"
    :class="
      cn(
        'flex items-center gap-2 rounded-md pl-[calc(var(--tree-level)*16px_+_8px)] pr-2 py-1.5 text-sm outline-none select-none',
        'hover:bg-accent hover:text-accent-foreground',
        'focus-visible:ring-ring focus-visible:ring-1',
        'data-selected:bg-accent data-selected:text-accent-foreground',
        props.class
      )
    "
    :style="{ '--tree-level': props.level }"
  >
    <slot v-bind="slotProps" />
  </RekaTreeItem>
</template>
