<script setup lang="ts">
import type { ClassValue } from "clsx";
import type { SelectLabelProps } from "reka-ui";

import { SelectLabel } from "reka-ui";
import { cn } from "@/lib/utils";

const props = defineProps<{
  for?: SelectLabelProps["for"];
  asChild?: SelectLabelProps["asChild"];
  as?: SelectLabelProps["as"];
  class?: ClassValue;
}>();
</script>

<template>
  <SelectLabel data-slot="select-label" :class="cn('text-muted-foreground px-2 py-1.5 text-xs', props.class)">
    <slot />
  </SelectLabel>
</template>
