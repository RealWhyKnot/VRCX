<script setup lang="ts">
import type { PrimitiveProps } from "reka-ui";
import type { ClassValue } from "clsx";
import { TabsList } from "reka-ui";
import { cn } from "@/lib/utils";
import { computed } from "vue";

const props = withDefaults(
  defineProps<{
    loop?: boolean;
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
  loop: props.loop,
  asChild: props.asChild,
  ...(props.as === undefined ? {} : { as: props.as }),
}));
</script>

<template>
  <TabsList
    data-slot="tabs-list"
    v-bind="delegatedProps"
    :class="cn('bg-muted text-muted-foreground inline-flex h-9 w-fit items-center justify-center rounded-lg p-[3px]', props.class)"
  >
    <slot />
  </TabsList>
</template>
