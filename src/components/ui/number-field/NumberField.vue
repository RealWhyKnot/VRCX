<script setup lang="ts">
import type { NumberFieldRootEmits, NumberFieldRootProps } from "reka-ui";
import type { ClassValue } from "clsx";
import { NumberFieldRoot, useForwardPropsEmits } from "reka-ui";
import { computed } from "vue";
import { cn } from "@/lib/utils";

const props = defineProps<{
  defaultValue?: number;
  modelValue?: number | null;
  min?: number;
  max?: number;
  step?: number;
  stepSnapping?: boolean;
  formatOptions?: NumberFieldRootProps["formatOptions"];
  locale?: string;
  disabled?: boolean;
  readonly?: boolean;
  disableWheelChange?: boolean;
  invertWheelChange?: boolean;
  id?: string;
  asChild?: boolean;
  as?: NumberFieldRootProps["as"];
  name?: string;
  required?: boolean;
  class?: ClassValue;
}>();
const emits = defineEmits<NumberFieldRootEmits>();

const delegatedProps = computed(() => ({
  ...(props.defaultValue === undefined ? {} : { defaultValue: props.defaultValue }),
  ...(props.modelValue === undefined ? {} : { modelValue: props.modelValue }),
  ...(props.min === undefined ? {} : { min: props.min }),
  ...(props.max === undefined ? {} : { max: props.max }),
  ...(props.step === undefined ? {} : { step: props.step }),
  stepSnapping: props.stepSnapping,
  ...(props.formatOptions === undefined ? {} : { formatOptions: props.formatOptions }),
  ...(props.locale === undefined ? {} : { locale: props.locale }),
  disabled: props.disabled,
  readonly: props.readonly,
  disableWheelChange: props.disableWheelChange,
  invertWheelChange: props.invertWheelChange,
  ...(props.id === undefined ? {} : { id: props.id }),
  asChild: props.asChild,
  ...(props.as === undefined ? {} : { as: props.as }),
  ...(props.name === undefined ? {} : { name: props.name }),
  required: props.required,
}));

const forwarded = useForwardPropsEmits(delegatedProps, emits);
</script>

<template>
  <NumberFieldRoot v-slot="slotProps" v-bind="forwarded" :class="cn('grid gap-1.5', props.class)">
    <slot v-bind="slotProps" />
  </NumberFieldRoot>
</template>
