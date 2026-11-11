<script setup lang="ts">
import type { PrimitiveProps } from "reka-ui";
import type { ClassValue } from "clsx";
import { Primitive } from "reka-ui";
import { cn } from "@/lib/utils";

import { sidebarMenuButtonVariants } from ".";

const props = withDefaults(
  defineProps<{
    as?: PrimitiveProps["as"] | undefined;
    asChild?: boolean;
    variant?: "default" | "outline";
    size?: "default" | "sm" | "lg";
    isActive?: boolean;
    class?: ClassValue | undefined;
  }>(),
  {
    as: "button",
    asChild: false,
    variant: "default",
    size: "default",
    isActive: false,
    class: undefined,
  }
);
</script>

<template>
  <Primitive
    data-slot="sidebar-menu-button"
    data-sidebar="menu-button"
    :data-size="size"
    :data-active="isActive"
    :class="cn(sidebarMenuButtonVariants({ variant, size }), props.class)"
    :as="as"
    :as-child="asChild"
    v-bind="$attrs"
  >
    <slot />
  </Primitive>
</template>
