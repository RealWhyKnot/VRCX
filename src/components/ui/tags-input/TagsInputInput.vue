<script setup lang="ts">
import type { PrimitiveProps } from "reka-ui";
import type { ClassValue } from "clsx";
import { TagsInputInput } from "reka-ui";
import { cn } from "@/lib/utils";
import { computed } from "vue";

const props = withDefaults(
  defineProps<{
    placeholder?: string | undefined;
    autoFocus?: boolean;
    maxLength?: number | undefined;
    asChild?: boolean;
    as?: PrimitiveProps["as"] | undefined;
    class?: ClassValue | undefined;
  }>(),
  {
    placeholder: undefined,
    maxLength: undefined,
    as: undefined,
    class: undefined,
  }
);

const delegatedProps = computed(() => ({
  ...(props.placeholder === undefined ? {} : { placeholder: props.placeholder }),
  autoFocus: props.autoFocus,
  ...(props.maxLength === undefined ? {} : { maxLength: props.maxLength }),
  asChild: props.asChild,
  ...(props.as === undefined ? {} : { as: props.as }),
}));
</script>

<template>
  <TagsInputInput v-bind="delegatedProps" :class="cn('text-sm min-h-5 focus:outline-none flex-1 bg-transparent px-1', props.class)" />
</template>
