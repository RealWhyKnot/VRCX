<script setup lang="ts">
import type { PrimitiveProps } from "reka-ui";
import type { ClassValue } from "clsx";
import Label from "@/components/ui/label/Label.vue";
import { cn } from "@/lib/utils";

import { useFormField } from "./use-form-field";

const props = withDefaults(
  defineProps<{
    for?: string | undefined;
    asChild?: boolean;
    as?: PrimitiveProps["as"] | undefined;
    class?: ClassValue | undefined;
  }>(),
  {
    for: undefined,
    as: undefined,
    class: undefined,
  }
);

const { error, formItemId } = useFormField();
</script>

<template>
  <Label data-slot="form-label" :data-error="!!error" :class="cn('data-[error=true]:text-destructive', props.class)" :for="formItemId">
    <slot />
  </Label>
</template>
