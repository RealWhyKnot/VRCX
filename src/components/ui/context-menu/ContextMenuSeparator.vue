<script setup lang="ts">
import type { PrimitiveProps } from "reka-ui";
import type { ClassValue } from "clsx";
import { reactiveOmit } from "@vueuse/core";
import { ContextMenuSeparator } from "reka-ui";
import { cn } from "@/lib/utils";

const props = withDefaults(
  defineProps<{
    asChild?: boolean;
    as?: PrimitiveProps["as"] | undefined;
    class?: ClassValue | undefined;
  }>(),
  {
    as: undefined,
    class: undefined,
  }
);

const delegatedProps: Record<string, unknown> = reactiveOmit(props, "class");
</script>

<template>
  <ContextMenuSeparator data-slot="context-menu-separator" v-bind="delegatedProps" :class="cn('bg-border -mx-1 my-1 h-px', props.class)" />
</template>
