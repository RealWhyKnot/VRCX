<script setup lang="ts">
import type { ClassValue } from "clsx";
import type { RadioGroupRootEmits, RadioGroupRootProps } from "reka-ui";
import { RadioGroupRoot, useForwardPropsEmits } from "reka-ui";
import { cn } from "@/lib/utils";
import { computed } from "vue";

const props = defineProps<{
  modelValue?: RadioGroupRootProps["modelValue"];
  defaultValue?: RadioGroupRootProps["defaultValue"];
  disabled?: boolean;
  orientation?: RadioGroupRootProps["orientation"];
  dir?: RadioGroupRootProps["dir"];
  loop?: boolean;
  asChild?: boolean;
  as?: RadioGroupRootProps["as"];
  name?: string;
  required?: boolean;
  class?: ClassValue;
}>();
const emits = defineEmits<RadioGroupRootEmits>();

const delegatedProps = computed(() => ({
  ...(props.modelValue === undefined ? {} : { modelValue: props.modelValue }),
  ...(props.defaultValue === undefined ? {} : { defaultValue: props.defaultValue }),
  disabled: props.disabled,
  ...(props.orientation === undefined ? {} : { orientation: props.orientation }),
  ...(props.dir === undefined ? {} : { dir: props.dir }),
  loop: props.loop,
  asChild: props.asChild,
  ...(props.as === undefined ? {} : { as: props.as }),
  ...(props.name === undefined ? {} : { name: props.name }),
  required: props.required,
}));

const forwarded = useForwardPropsEmits(delegatedProps, emits);
</script>

<template>
  <RadioGroupRoot v-slot="slotProps" data-slot="radio-group" :class="cn('grid gap-3', props.class)" v-bind="forwarded">
    <slot v-bind="slotProps" />
  </RadioGroupRoot>
</template>
