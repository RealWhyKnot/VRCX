<script setup lang="ts">
import type { PrimitiveProps } from "reka-ui";
import type { ClassValue } from "clsx";
import { SwitchRoot, SwitchThumb, useForwardPropsEmits } from "reka-ui";
import type { SwitchRootEmits } from "reka-ui";
import { cn } from "@/lib/utils";
import { computed } from "vue";

defineOptions({ name: "UiSwitch" });

const props = withDefaults(
  defineProps<{
    defaultValue?: boolean;
    modelValue?: boolean | null | undefined;
    disabled?: boolean;
    id?: string | undefined;
    value?: string | undefined;
    asChild?: boolean;
    as?: PrimitiveProps["as"] | undefined;
    name?: string | undefined;
    required?: boolean;
    class?: ClassValue | undefined;
    ariaLabel?: string | undefined;
  }>(),
  {
    modelValue: undefined,
    id: undefined,
    value: undefined,
    as: undefined,
    name: undefined,
    class: undefined,
    ariaLabel: undefined,
  }
);

const emits = defineEmits<SwitchRootEmits>();

const delegatedProps = computed(() => ({
  defaultValue: props.defaultValue,
  ...(props.modelValue === undefined ? {} : { modelValue: props.modelValue }),
  disabled: props.disabled,
  ...(props.id === undefined ? {} : { id: props.id }),
  ...(props.value === undefined ? {} : { value: props.value }),
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
  <SwitchRoot
    v-slot="slotProps"
    data-slot="switch"
    v-bind="forwarded"
    :aria-label="computedAriaLabel"
    :class="
      cn(
        'peer data-[state=checked]:bg-primary data-[state=unchecked]:bg-input focus-visible:border-ring focus-visible:ring-ring/50 dark:data-[state=unchecked]:bg-input/80 inline-flex h-[1.15rem] w-8 shrink-0 items-center rounded-full border border-transparent shadow-xs transition-all outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer',
        props.class
      )
    "
  >
    <SwitchThumb
      data-slot="switch-thumb"
      :class="
        cn(
          'bg-background dark:data-[state=unchecked]:bg-foreground dark:data-[state=checked]:bg-primary-foreground pointer-events-none block size-4 rounded-full ring-0 transition-transform data-[state=checked]:translate-x-[calc(100%-2px)] data-[state=unchecked]:translate-x-0'
        )
      "
    >
      <slot name="thumb" v-bind="slotProps" />
    </SwitchThumb>
  </SwitchRoot>
</template>
