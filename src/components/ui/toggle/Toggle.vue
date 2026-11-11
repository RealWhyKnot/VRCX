<script setup lang="ts">
import type { PrimitiveProps, ToggleEmits } from "reka-ui";
import type { ClassValue } from "clsx";
import type { VariantProps } from "class-variance-authority";
import { Toggle, useForwardPropsEmits } from "reka-ui";
import { cn } from "@/lib/utils";
import { computed } from "vue";

import { toggleVariants } from ".";

defineOptions({ name: "UiToggle" });

const props = withDefaults(
  defineProps<{
    defaultValue?: boolean;
    modelValue?: boolean | null;
    disabled?: boolean;
    asChild?: boolean;
    as?: PrimitiveProps["as"] | undefined;
    name?: string | undefined;
    required?: boolean;
    class?: ClassValue | undefined;
    variant?: VariantProps<typeof toggleVariants>["variant"] | undefined;
    size?: VariantProps<typeof toggleVariants>["size"] | undefined;
    ariaLabel?: string | undefined;
  }>(),
  {
    modelValue: false,
    as: undefined,
    name: undefined,
    class: undefined,
    variant: "default",
    size: "default",
    ariaLabel: undefined,
  }
);

const emits = defineEmits<ToggleEmits>();

const delegatedProps = computed(() => ({
  defaultValue: props.defaultValue,
  modelValue: props.modelValue,
  disabled: props.disabled,
  asChild: props.asChild,
  ...(props.as === undefined ? {} : { as: props.as }),
  ...(props.name === undefined ? {} : { name: props.name }),
  required: props.required,
  ...(props.ariaLabel === undefined ? {} : { ariaLabel: props.ariaLabel }),
}));
const forwarded = useForwardPropsEmits(delegatedProps, emits);

const computedAriaLabel = computed(() => {
  return props.ariaLabel;
});
</script>

<template>
  <Toggle v-slot="slotProps" data-slot="toggle" v-bind="forwarded" :aria-label="computedAriaLabel" :class="cn(toggleVariants({ variant, size }), props.class)">
    <slot v-bind="slotProps" />
  </Toggle>
</template>
