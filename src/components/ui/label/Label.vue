<script setup lang="ts">
import type { PrimitiveProps } from "reka-ui";
import type { ClassValue } from "clsx";
import { Label } from "reka-ui";
import { computed } from "vue";
import { cn } from "@/lib/utils";

defineOptions({ name: "UiLabel" });

const props = defineProps<{
  for?: string;
  asChild?: boolean;
  as?: PrimitiveProps["as"];
  class?: ClassValue;
}>();

const delegatedProps = computed(() => ({
  ...(props.for === undefined ? {} : { for: props.for }),
  ...(props.as === undefined ? {} : { as: props.as }),
  asChild: props.asChild,
}));
</script>

<template>
  <Label
    data-slot="label"
    v-bind="delegatedProps"
    :class="
      cn(
        'flex items-center gap-2 text-sm leading-none font-medium select-none group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50 peer-disabled:cursor-not-allowed peer-disabled:opacity-50',
        props.class
      )
    "
  >
    <slot />
  </Label>
</template>
