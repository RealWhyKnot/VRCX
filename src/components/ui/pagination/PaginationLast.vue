<script setup lang="ts">
import type { PrimitiveProps } from "reka-ui";
import type { ClassValue } from "clsx";
import type { VariantProps } from "class-variance-authority";
import { PaginationLast } from "reka-ui";
import { ChevronRightIcon } from "lucide-vue-next";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { computed } from "vue";
import { useI18n } from "vue-i18n";

const props = withDefaults(
  defineProps<{
    asChild?: boolean;
    as?: PrimitiveProps["as"] | undefined;
    size?: VariantProps<typeof buttonVariants>["size"];
    class?: ClassValue | undefined;
  }>(),
  {
    as: undefined,
    size: "default",
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
  <PaginationLast
    data-slot="pagination-last"
    :class="cn(buttonVariants({ variant: 'ghost', size }), 'text-[13px] gap-1 px-2.5 sm:pr-2.5', props.class)"
    v-bind="delegatedProps"
  >
    <slot>
      <span class="hidden sm:block">
        {{ t("table.pagination.last") }}
      </span>
      <ChevronRightIcon />
    </slot>
  </PaginationLast>
</template>
