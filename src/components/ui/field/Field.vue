<script setup lang="ts">
import type { VariantProps } from "class-variance-authority";
import type { ClassValue } from "clsx";
import { cn } from "@/lib/utils";

import { fieldVariants } from ".";

defineOptions({ name: "UiField" });

const props = withDefaults(
  defineProps<{
    class?: ClassValue | undefined;
    orientation?: VariantProps<typeof fieldVariants>["orientation"] | undefined;
  }>(),
  {
    class: undefined,
    orientation: undefined,
  }
);
</script>

<template>
  <div role="group" data-slot="field" :data-orientation="orientation" :class="cn(fieldVariants({ orientation }), props.class)">
    <slot />
  </div>
</template>
