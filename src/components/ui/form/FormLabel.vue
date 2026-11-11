<script setup lang="ts">
import Label from "@/components/ui/label/Label.vue";
import { cn } from "@/lib/utils";

import { useFormField } from "./use-form-field";

const props = defineProps({
  for: { type: String, required: false },
  asChild: { type: Boolean, required: false },
  as: { type: null, required: false },
  class: { type: null, required: false },
});

const { error, formItemId } = useFormField();
</script>

<template>
  <Label data-slot="form-label" :data-error="!!error" :class="cn('data-[error=true]:text-destructive', props.class)" :for="formItemId">
    <slot />
  </Label>
</template>
