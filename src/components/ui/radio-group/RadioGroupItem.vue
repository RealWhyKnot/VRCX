<script setup lang="ts">
import type { ClassValue } from "clsx";
import type { RadioGroupItemProps } from "reka-ui";
import { RadioGroupIndicator, RadioGroupItem } from "reka-ui";
import { CircleIcon } from "lucide-vue-next";
import { cn } from "@/lib/utils";
import { computed } from "vue";

const props = defineProps<{
  id?: string;
  value?: RadioGroupItemProps["value"];
  disabled?: boolean;
  asChild?: boolean;
  as?: RadioGroupItemProps["as"];
  name?: string;
  required?: boolean;
  class?: ClassValue;
}>();

const delegatedProps = computed(() => ({
  ...(props.id === undefined ? {} : { id: props.id }),
  ...(props.value === undefined ? {} : { value: props.value }),
  disabled: props.disabled,
  asChild: props.asChild,
  ...(props.as === undefined ? {} : { as: props.as }),
  ...(props.name === undefined ? {} : { name: props.name }),
  required: props.required,
}));
</script>

<template>
  <RadioGroupItem
    data-slot="radio-group-item"
    v-bind="delegatedProps"
    :class="
      cn(
        'border-input text-primary focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:bg-input/30 aspect-square size-4 shrink-0 rounded-full border shadow-xs transition-[color,box-shadow] outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer',
        props.class
      )
    "
  >
    <RadioGroupIndicator data-slot="radio-group-indicator" class="relative flex items-center justify-center">
      <slot>
        <CircleIcon class="fill-primary absolute top-1/2 left-1/2 size-2 -translate-x-1/2 -translate-y-1/2" />
      </slot>
    </RadioGroupIndicator>
  </RadioGroupItem>
</template>
