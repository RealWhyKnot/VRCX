<script setup lang="ts">
import type { PrimitiveProps } from "reka-ui";
import type { ClassValue } from "clsx";
import Separator from "@/components/ui/separator/Separator.vue";
import { cn } from "@/lib/utils";
import { reactiveOmit } from "@vueuse/core";

const props = withDefaults(
  defineProps<{
    orientation?: "horizontal" | "vertical";
    decorative?: boolean;
    asChild?: boolean;
    as?: PrimitiveProps["as"] | undefined;
    class?: ClassValue | undefined;
  }>(),
  {
    orientation: "vertical",
    as: undefined,
    class: undefined,
  }
);
const delegatedProps = reactiveOmit(props, "class");
</script>

<template>
  <Separator
    data-slot="button-group-separator"
    v-bind="delegatedProps"
    :orientation="props.orientation"
    :class="cn('bg-input relative !m-0 self-stretch data-[orientation=vertical]:h-auto', props.class)"
  />
</template>
