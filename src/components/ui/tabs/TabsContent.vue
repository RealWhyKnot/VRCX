<script setup lang="ts">
import type { PrimitiveProps } from "reka-ui";
import type { ClassValue } from "clsx";
import { TabsContent } from "reka-ui";
import { cn } from "@/lib/utils";
import { computed } from "vue";

const props = withDefaults(
  defineProps<{
    value: string | number;
    forceMount?: boolean;
    asChild?: boolean;
    as?: PrimitiveProps["as"] | undefined;
    class?: ClassValue | undefined;
  }>(),
  {
    as: undefined,
    class: undefined,
  }
);

const delegatedProps = computed(() => ({
  value: props.value,
  forceMount: props.forceMount,
  asChild: props.asChild,
  ...(props.as === undefined ? {} : { as: props.as }),
}));
</script>

<template>
  <TabsContent data-slot="tabs-content" :class="cn('flex-1 outline-none', props.class)" v-bind="delegatedProps">
    <slot />
  </TabsContent>
</template>
