<script setup lang="ts">
import type { PrimitiveProps } from "reka-ui";

import { Primitive } from "reka-ui";
import { cn } from "@/lib/utils";

const props = withDefaults(
  defineProps<{
    asChild?: PrimitiveProps["asChild"];
    as?: PrimitiveProps["as"];
    class?: unknown;
  }>(),
  {
    as: "a",
  }
);
</script>

<template>
  <Primitive data-slot="breadcrumb-link" :as="as" :as-child="asChild" :class="cn('hover:text-foreground transition-colors', props.class)">
    <slot />
  </Primitive>
</template>
