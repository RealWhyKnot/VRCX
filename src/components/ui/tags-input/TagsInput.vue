<script setup lang="ts">
import type { ClassValue } from "clsx";
import type { TagsInputRootEmits, TagsInputRootProps } from "reka-ui";
import { TagsInputRoot, useForwardPropsEmits } from "reka-ui";
import { cn } from "@/lib/utils";
import { computed } from "vue";

const props = defineProps<{
  modelValue?: TagsInputRootProps["modelValue"];
  defaultValue?: TagsInputRootProps["defaultValue"];
  addOnPaste?: boolean;
  addOnTab?: boolean;
  addOnBlur?: boolean;
  duplicate?: boolean;
  disabled?: boolean;
  delimiter?: TagsInputRootProps["delimiter"];
  dir?: TagsInputRootProps["dir"];
  max?: number;
  id?: string;
  convertValue?: TagsInputRootProps["convertValue"];
  displayValue?: TagsInputRootProps["displayValue"];
  asChild?: boolean;
  as?: TagsInputRootProps["as"];
  name?: string;
  required?: boolean;
  class?: ClassValue;
}>();
const emits = defineEmits<TagsInputRootEmits>();

const delegatedProps = computed(() => ({
  ...(props.modelValue === undefined ? {} : { modelValue: props.modelValue }),
  ...(props.defaultValue === undefined ? {} : { defaultValue: props.defaultValue }),
  addOnPaste: props.addOnPaste,
  addOnTab: props.addOnTab,
  addOnBlur: props.addOnBlur,
  duplicate: props.duplicate,
  disabled: props.disabled,
  ...(props.delimiter === undefined ? {} : { delimiter: props.delimiter }),
  ...(props.dir === undefined ? {} : { dir: props.dir }),
  ...(props.max === undefined ? {} : { max: props.max }),
  ...(props.id === undefined ? {} : { id: props.id }),
  ...(props.convertValue === undefined ? {} : { convertValue: props.convertValue }),
  ...(props.displayValue === undefined ? {} : { displayValue: props.displayValue }),
  asChild: props.asChild,
  ...(props.as === undefined ? {} : { as: props.as }),
  ...(props.name === undefined ? {} : { name: props.name }),
  required: props.required,
}));

const forwarded = useForwardPropsEmits(delegatedProps, emits);
</script>

<template>
  <TagsInputRoot
    v-slot="slotProps"
    v-bind="forwarded"
    :class="
      cn(
        'flex flex-wrap gap-2 items-center rounded-md border border-input bg-background px-2 py-1 text-sm shadow-xs transition-[color,box-shadow] outline-none',
        'focus-within:border-ring focus-within:ring-ring/50 focus-within:ring-[3px]',
        'aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive',
        props.class
      )
    "
  >
    <slot v-bind="slotProps" />
  </TagsInputRoot>
</template>
