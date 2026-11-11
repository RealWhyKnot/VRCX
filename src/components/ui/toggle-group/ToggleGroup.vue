<script setup lang="ts">
import type { ClassValue } from "clsx";
import type { VariantProps } from "class-variance-authority";
import type { ToggleGroupRootEmits, ToggleGroupRootProps } from "reka-ui";
import { computed, provide, unref } from "vue";
import { ToggleGroupRoot, useForwardPropsEmits } from "reka-ui";
import { cn } from "@/lib/utils";
import { toggleVariants } from "@/components/ui/toggle";

const props = withDefaults(
  defineProps<{
    rovingFocus?: boolean;
    disabled?: boolean;
    orientation?: ToggleGroupRootProps["orientation"] | undefined;
    dir?: ToggleGroupRootProps["dir"] | undefined;
    loop?: boolean;
    asChild?: boolean;
    as?: ToggleGroupRootProps["as"] | undefined;
    name?: string | undefined;
    required?: boolean;
    type?: ToggleGroupRootProps["type"] | undefined;
    modelValue?: ToggleGroupRootProps["modelValue"] | undefined;
    defaultValue?: ToggleGroupRootProps["defaultValue"] | undefined;
    class?: ClassValue | undefined;
    variant?: VariantProps<typeof toggleVariants>["variant"] | undefined;
    size?: VariantProps<typeof toggleVariants>["size"] | undefined;
    spacing?: number;
  }>(),
  {
    orientation: undefined,
    dir: undefined,
    as: undefined,
    name: undefined,
    type: undefined,
    modelValue: undefined,
    defaultValue: undefined,
    class: undefined,
    variant: undefined,
    size: undefined,
    spacing: 0,
  }
);

const emits = defineEmits<ToggleGroupRootEmits>();

provide("toggleGroup", {
  variant: props.variant,
  size: props.size,
  spacing: props.spacing,
});

const delegatedProps = computed(() => ({
  rovingFocus: props.rovingFocus,
  disabled: props.disabled,
  ...(props.orientation === undefined ? {} : { orientation: props.orientation }),
  ...(props.dir === undefined ? {} : { dir: props.dir }),
  loop: props.loop,
  asChild: props.asChild,
  ...(props.as === undefined ? {} : { as: props.as }),
  ...(props.name === undefined ? {} : { name: props.name }),
  required: props.required,
  ...(props.type === undefined ? {} : { type: props.type }),
  ...(props.modelValue === undefined ? {} : { modelValue: props.modelValue }),
  ...(props.defaultValue === undefined ? {} : { defaultValue: props.defaultValue }),
  spacing: props.spacing,
}));
const forwarded = useForwardPropsEmits(delegatedProps, emits);
const forwardedProps = computed(() => {
  const { ["onUpdate:modelValue"]: _ignored, ...rest } = unref(forwarded);
  return rest;
});

function onUpdateModelValue(value: ToggleGroupRootEmits["update:modelValue"][0]) {
  if (props.type === "single" && !value) {
    return;
  }
  emits("update:modelValue", value);
}
</script>

<template>
  <ToggleGroupRoot
    v-slot="slotProps"
    data-slot="toggle-group"
    :data-size="size"
    :data-variant="variant"
    :data-spacing="spacing"
    :style="{
      '--gap': spacing,
    }"
    v-bind="forwardedProps"
    :class="
      cn(
        'group/toggle-group flex w-fit items-center gap-[--spacing(var(--gap))] rounded-md data-[spacing=default]:data-[variant=outline]:shadow-xs',
        props.class
      )
    "
    @update:model-value="onUpdateModelValue"
  >
    <slot v-bind="slotProps" />
  </ToggleGroupRoot>
</template>
