<script setup lang="ts">
import type { PrimitiveProps } from "reka-ui";
import type { ClassValue } from "clsx";
import type { Component } from "vue";
import Tooltip from "@/components/ui/tooltip/Tooltip.vue";
import TooltipContent from "@/components/ui/tooltip/TooltipContent.vue";
import TooltipTrigger from "@/components/ui/tooltip/TooltipTrigger.vue";
import { reactiveOmit } from "@vueuse/core";

import { useSidebar } from "./utils";

import SidebarMenuButtonChild from "./SidebarMenuButtonChild.vue";

defineOptions({
  inheritAttrs: false,
});

const props = withDefaults(
  defineProps<{
    as?: PrimitiveProps["as"] | undefined;
    asChild?: boolean;
    variant?: "default" | "outline";
    size?: "default" | "sm" | "lg";
    isActive?: boolean;
    tooltip?: string | Component | undefined;
    class?: ClassValue | undefined;
  }>(),
  {
    as: "button",
    asChild: false,
    variant: "default",
    size: "default",
    isActive: false,
    tooltip: undefined,
    class: undefined,
  }
);

const { isMobile, state } = useSidebar();

const delegatedProps = reactiveOmit(props, "tooltip");
</script>

<template>
  <SidebarMenuButtonChild v-if="!tooltip" v-bind="{ ...delegatedProps, ...$attrs }">
    <slot />
  </SidebarMenuButtonChild>

  <Tooltip v-else ignore-non-keyboard-focus>
    <TooltipTrigger as-child>
      <SidebarMenuButtonChild v-bind="{ ...delegatedProps, ...$attrs }">
        <slot />
      </SidebarMenuButtonChild>
    </TooltipTrigger>
    <TooltipContent side="right" align="center" :hidden="state !== 'collapsed' || isMobile">
      <template v-if="typeof tooltip === 'string'">
        {{ tooltip }}
      </template>
      <component :is="tooltip" v-else />
    </TooltipContent>
  </Tooltip>
</template>
