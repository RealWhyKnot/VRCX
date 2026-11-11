<script setup lang="ts">
import type { ClassValue } from "clsx";
import type { VariantProps } from "class-variance-authority";
import type { PrimitiveProps } from "reka-ui";

import { Primitive } from "reka-ui";
import { cn } from "@/lib/utils";
import { reactiveOmit } from "@vueuse/core";
import { useAttrs } from "vue";

import { badgeVariants } from ".";

defineOptions({ name: "UiBadge" });

const props = withDefaults(
  defineProps<{
    asChild?: boolean;
    as?: PrimitiveProps["as"] | undefined;
    variant?: VariantProps<typeof badgeVariants>["variant"] | undefined;
    class?: ClassValue | undefined;
  }>(),
  {
    as: undefined,
    variant: undefined,
    class: undefined,
  }
);

const delegatedProps: Record<string, unknown> = reactiveOmit(props, "class");
const attrs = useAttrs();
</script>

<template>
  <Primitive data-slot="badge" :class="cn(badgeVariants({ variant }), props.class)" v-bind="{ ...delegatedProps, ...attrs }">
    <slot />
  </Primitive>
</template>
