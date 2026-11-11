<script setup lang="ts">
import type { PrimitiveProps } from "reka-ui";
import type { ClassValue } from "clsx";
import { PaginationRoot, useForwardPropsEmits } from "reka-ui";
import type { PaginationRootEmits } from "reka-ui";
import { cn } from "@/lib/utils";
import { computed } from "vue";

defineOptions({ name: "UiPagination" });

const props = withDefaults(
  defineProps<{
    page?: number | undefined;
    defaultPage?: number | undefined;
    itemsPerPage: number;
    total?: number | undefined;
    siblingCount?: number | undefined;
    disabled?: boolean;
    showEdges?: boolean;
    asChild?: boolean;
    as?: PrimitiveProps["as"] | undefined;
    class?: ClassValue | undefined;
  }>(),
  {
    page: undefined,
    defaultPage: undefined,
    total: undefined,
    siblingCount: undefined,
    as: undefined,
    class: undefined,
  }
);
const emits = defineEmits<PaginationRootEmits>();

const delegatedProps = computed(() => ({
  ...(props.page === undefined ? {} : { page: props.page }),
  ...(props.defaultPage === undefined ? {} : { defaultPage: props.defaultPage }),
  itemsPerPage: props.itemsPerPage,
  ...(props.total === undefined ? {} : { total: props.total }),
  ...(props.siblingCount === undefined ? {} : { siblingCount: props.siblingCount }),
  disabled: props.disabled,
  showEdges: props.showEdges,
  asChild: props.asChild,
  ...(props.as === undefined ? {} : { as: props.as }),
}));
const forwarded = useForwardPropsEmits(delegatedProps, emits);
</script>

<template>
  <PaginationRoot v-slot="slotProps" data-slot="pagination" v-bind="forwarded" :class="cn('flex justify-center text-[13px]', props.class)">
    <slot v-bind="slotProps" />
  </PaginationRoot>
</template>
