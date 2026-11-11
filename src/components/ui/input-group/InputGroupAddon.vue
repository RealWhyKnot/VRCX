<script setup lang="ts">
import type { VariantProps } from "class-variance-authority";
import type { ClassValue } from "clsx";
import { cn } from "@/lib/utils";

import { inputGroupAddonVariants } from ".";

const props = withDefaults(
  defineProps<{
    align?: VariantProps<typeof inputGroupAddonVariants>["align"] | undefined;
    class?: ClassValue | undefined;
  }>(),
  {
    align: "inline-start",
    class: undefined,
  }
);

function handleInputGroupAddonClick(event: MouseEvent) {
  const currentTarget = event.currentTarget;
  const target = event.target;
  if (target instanceof Element && target.closest("button")) {
    return;
  }
  if (currentTarget instanceof HTMLElement && currentTarget.parentElement) {
    currentTarget.parentElement.querySelector("input")?.focus();
  }
}
</script>

<template>
  <div
    role="group"
    data-slot="input-group-addon"
    :data-align="props.align"
    :class="cn(inputGroupAddonVariants({ align: props.align }), props.class)"
    @click="handleInputGroupAddonClick"
  >
    <slot />
  </div>
</template>
