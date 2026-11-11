<script setup lang="ts">
import type { ClassValue } from "clsx";
import type { VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

import { alertVariants } from ".";

defineOptions({ name: "UiAlert" });

const props = withDefaults(
  defineProps<{
    class?: ClassValue | undefined;
    variant?: VariantProps<typeof alertVariants>["variant"] | undefined;
  }>(),
  {
    class: undefined,
    variant: undefined,
  }
);
</script>

<template>
  <div data-slot="alert" :class="cn(alertVariants({ variant }), props.class)" role="alert">
    <slot />
  </div>
</template>
