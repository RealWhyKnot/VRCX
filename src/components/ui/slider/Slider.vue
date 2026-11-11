<script setup lang="ts">
import type { ClassValue } from "clsx";
import type { SliderRootEmits, SliderRootProps } from "reka-ui";
import { SliderRange, SliderRoot, SliderThumb, SliderTrack, useForwardPropsEmits } from "reka-ui";
import { cn } from "@/lib/utils";
import { computed } from "vue";

defineOptions({ name: "UiSlider" });

const props = defineProps<{
  defaultValue?: SliderRootProps["defaultValue"];
  modelValue?: SliderRootProps["modelValue"];
  disabled?: boolean;
  orientation?: SliderRootProps["orientation"];
  dir?: SliderRootProps["dir"];
  inverted?: boolean;
  min?: number;
  max?: number;
  step?: number;
  minStepsBetweenThumbs?: number;
  thumbAlignment?: SliderRootProps["thumbAlignment"];
  asChild?: boolean;
  as?: SliderRootProps["as"];
  name?: string;
  required?: boolean;
  class?: ClassValue;
}>();
const emits = defineEmits<SliderRootEmits>();

const delegatedProps = computed(() => ({
  ...(props.defaultValue === undefined ? {} : { defaultValue: props.defaultValue }),
  ...(props.modelValue === undefined ? {} : { modelValue: props.modelValue }),
  disabled: props.disabled,
  ...(props.orientation === undefined ? {} : { orientation: props.orientation }),
  ...(props.dir === undefined ? {} : { dir: props.dir }),
  inverted: props.inverted,
  ...(props.min === undefined ? {} : { min: props.min }),
  ...(props.max === undefined ? {} : { max: props.max }),
  ...(props.step === undefined ? {} : { step: props.step }),
  ...(props.minStepsBetweenThumbs === undefined ? {} : { minStepsBetweenThumbs: props.minStepsBetweenThumbs }),
  ...(props.thumbAlignment === undefined ? {} : { thumbAlignment: props.thumbAlignment }),
  asChild: props.asChild,
  ...(props.as === undefined ? {} : { as: props.as }),
  ...(props.name === undefined ? {} : { name: props.name }),
  required: props.required,
}));

const forwarded = useForwardPropsEmits(delegatedProps, emits);
</script>

<template>
  <SliderRoot
    v-slot="slotProps"
    data-slot="slider"
    :class="
      cn(
        'relative flex w-full touch-none items-center select-none data-disabled:opacity-50 data-[orientation=vertical]:h-full data-[orientation=vertical]:min-h-44 data-[orientation=vertical]:w-auto data-[orientation=vertical]:flex-col',
        props.class
      )
    "
    v-bind="forwarded"
  >
    <SliderTrack
      data-slot="slider-track"
      class="bg-muted relative grow overflow-hidden rounded-full data-[orientation=horizontal]:h-1.5 data-[orientation=horizontal]:w-full data-[orientation=vertical]:h-full data-[orientation=vertical]:w-1.5"
    >
      <SliderRange data-slot="slider-range" class="bg-primary absolute data-[orientation=horizontal]:h-full data-[orientation=vertical]:w-full" />
    </SliderTrack>

    <SliderThumb
      v-for="(_, key) in slotProps.modelValue"
      :key="key"
      data-slot="slider-thumb"
      class="bg-white border-primary ring-ring/50 block size-4 shrink-0 rounded-full border shadow-sm transition-[color,box-shadow] hover:ring-4 focus-visible:ring-4 focus-visible:outline-hidden disabled:pointer-events-none disabled:opacity-50"
    />
  </SliderRoot>
</template>
