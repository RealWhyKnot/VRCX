<script setup lang="ts">
import type { PrimitiveProps } from "reka-ui";
import type { ClassValue } from "clsx";
import { Primitive } from "reka-ui";
import { cn } from "@/lib/utils";
import { computed } from "vue";
import { reactiveOmit } from "@vueuse/core";

import { useCommand } from ".";

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

const { filterState } = useCommand();
const isRender = computed(() => !!filterState.search && filterState.filtered.count === 0);
</script>

<template>
  <Primitive v-if="isRender" data-slot="command-empty" v-bind="delegatedProps" :class="cn('py-6 text-center text-sm', props.class)">
    <slot />
  </Primitive>
</template>
