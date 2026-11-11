<script setup lang="ts">
import type { PrimitiveProps } from "reka-ui";
import type { ClassValue } from "clsx";
import type { VariantProps } from "class-variance-authority";
import { PaginationListItem } from "reka-ui";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { computed } from "vue";

const props = withDefaults(
  defineProps<{
    value: number;
    asChild?: boolean;
    as?: PrimitiveProps["as"] | undefined;
    size?: VariantProps<typeof buttonVariants>["size"];
    class?: ClassValue | undefined;
    isActive?: boolean;
  }>(),
  {
    as: undefined,
    size: "icon",
    class: undefined,
  }
);

const delegatedProps = computed(() => ({
  value: props.value,
  asChild: props.asChild,
  ...(props.as === undefined ? {} : { as: props.as }),
}));
</script>

<template>
  <PaginationListItem
    data-slot="pagination-item"
    v-bind="delegatedProps"
    :class="
      cn(
        buttonVariants({
          variant: isActive ? 'outline' : 'ghost',
          size,
        }),
        'text-[13px]',
        props.class
      )
    "
  >
    <slot />
  </PaginationListItem>
</template>
