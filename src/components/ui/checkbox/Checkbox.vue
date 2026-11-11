<script setup lang="ts">
import type { CheckboxRootEmits, CheckboxRootProps, PrimitiveProps } from "reka-ui";
import type { ClassValue } from "clsx";
import { CheckboxIndicator, CheckboxRoot, useForwardPropsEmits } from "reka-ui";
import { Check } from "lucide-vue-next";
import { cn } from "@/lib/utils";
import { reactiveOmit } from "@vueuse/core";

defineOptions({ name: "UiCheckbox" });

const props = withDefaults(
  defineProps<{
    defaultValue?: boolean | string;
    modelValue?: boolean | string | null;
    disabled?: boolean;
    value?: CheckboxRootProps["value"] | undefined;
    id?: string | undefined;
    asChild?: boolean;
    as?: PrimitiveProps["as"] | undefined;
    name?: string | undefined;
    required?: boolean;
    class?: ClassValue | undefined;
  }>(),
  {
    defaultValue: false,
    modelValue: false,
    value: undefined,
    id: undefined,
    as: undefined,
    name: undefined,
    class: undefined,
  }
);
const emits = defineEmits<CheckboxRootEmits>();

const delegatedProps: Record<string, unknown> = reactiveOmit(props, "class");

const forwarded = useForwardPropsEmits(delegatedProps, emits);
</script>

<template>
  <CheckboxRoot
    v-slot="slotProps"
    data-slot="checkbox"
    v-bind="forwarded"
    :class="
      cn(
        'peer border-input data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground data-[state=checked]:border-primary focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive size-4 shrink-0 rounded-[4px] border shadow-xs transition-shadow outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer',
        props.class
      )
    "
  >
    <CheckboxIndicator data-slot="checkbox-indicator" class="grid place-content-center text-current transition-none">
      <slot v-bind="slotProps">
        <Check class="size-3.5" />
      </slot>
    </CheckboxIndicator>
  </CheckboxRoot>
</template>
