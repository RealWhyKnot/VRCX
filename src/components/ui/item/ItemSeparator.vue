<script setup lang="ts">
import type { PrimitiveProps } from "reka-ui";
import type { ClassValue } from "clsx";
import { cn } from "@/lib/utils";
import Separator from "@/components/ui/separator/Separator.vue";

const props = withDefaults(
  defineProps<{
    orientation?: string | undefined;
    decorative?: boolean;
    asChild?: boolean;
    as?: PrimitiveProps["as"] | undefined;
    class?: ClassValue | undefined;
  }>(),
  {
    orientation: undefined,
    as: undefined,
    class: undefined,
  }
);
</script>

<template>
  <Separator data-slot="item-separator" orientation="horizontal" :class="cn('my-0', props.class)" />
</template>
