<script setup lang="ts">
import type { ClassValue } from "clsx";
import type { ProgressRootProps } from "reka-ui";
import { ProgressIndicator, ProgressRoot } from "reka-ui";
import { cn } from "@/lib/utils";
import { computed } from "vue";

defineOptions({ name: "UiProgress" });

const props = withDefaults(
  defineProps<{
    modelValue?: number | null;
    max?: number | undefined;
    getValueLabel?: ProgressRootProps["getValueLabel"] | undefined;
    getValueText?: ProgressRootProps["getValueText"] | undefined;
    asChild?: boolean;
    as?: ProgressRootProps["as"] | undefined;
    class?: ClassValue | undefined;
  }>(),
  {
    modelValue: 0,
    max: undefined,
    getValueLabel: undefined,
    getValueText: undefined,
    as: undefined,
    class: undefined,
  }
);

const delegatedProps = computed(() => ({
  modelValue: props.modelValue,
  asChild: props.asChild,
  ...(props.max === undefined ? {} : { max: props.max }),
  ...(props.getValueLabel === undefined ? {} : { getValueLabel: props.getValueLabel }),
  ...(props.getValueText === undefined ? {} : { getValueText: props.getValueText }),
  ...(props.as === undefined ? {} : { as: props.as }),
}));
</script>

<template>
  <ProgressRoot data-slot="progress" v-bind="delegatedProps" :class="cn('bg-primary/20 relative h-2 w-full overflow-hidden rounded-full', props.class)">
    <ProgressIndicator
      data-slot="progress-indicator"
      class="bg-primary h-full w-full flex-1 transition-all"
      :style="`transform: translateX(-${100 - (props.modelValue ?? 0)}%);`"
    />
  </ProgressRoot>
</template>
