<script setup lang="ts">
import type { PrimitiveProps } from "reka-ui";
import type { ClassValue } from "clsx";
import { MoreHorizontal } from "lucide-vue-next";
import { PaginationEllipsis } from "reka-ui";
import { cn } from "@/lib/utils";
import { computed } from "vue";
import { useI18n } from "vue-i18n";

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

const { t } = useI18n();

const delegatedProps = computed(() => ({
  asChild: props.asChild,
  ...(props.as === undefined ? {} : { as: props.as }),
}));
</script>

<template>
  <PaginationEllipsis data-slot="pagination-ellipsis" v-bind="delegatedProps" :class="cn('flex size-9 items-center justify-center text-[13px]', props.class)">
    <slot>
      <MoreHorizontal class="size-4" />
      <span class="sr-only">
        {{ t("table.pagination.more_pages") }}
      </span>
    </slot>
  </PaginationEllipsis>
</template>
