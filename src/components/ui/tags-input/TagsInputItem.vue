<script setup lang="ts">
import type { PrimitiveProps, TagsInputItemProps } from "reka-ui";
import type { ClassValue } from "clsx";
import { TagsInputItem } from "reka-ui";
import { cn } from "@/lib/utils";
import { computed } from "vue";

const props = withDefaults(
  defineProps<{
    value: TagsInputItemProps["value"];
    disabled?: boolean;
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
  disabled: props.disabled,
  asChild: props.asChild,
  ...(props.as === undefined ? {} : { as: props.as }),
}));
</script>

<template>
  <TagsInputItem
    v-bind="delegatedProps"
    :value="props.value"
    :class="
      cn(
        'flex h-5 items-center rounded-md bg-secondary data-[state=active]:ring-ring data-[state=active]:ring-2 data-[state=active]:ring-offset-2 ring-offset-background',
        props.class
      )
    "
  >
    <slot />
  </TagsInputItem>
</template>
