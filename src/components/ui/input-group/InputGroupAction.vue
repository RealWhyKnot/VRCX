<script setup lang="ts">
import type { ClassValue } from "clsx";
import { useAttrs } from "vue";
import { useVModel } from "@vueuse/core";

import InputGroupField from "./InputGroupField.vue";

defineOptions({ inheritAttrs: false });

const props = withDefaults(
  defineProps<{
    modelValue?: string | number | null | undefined;
    class?: ClassValue | undefined;
    inputClass?: ClassValue | undefined;
    clearable?: boolean;
    showPassword?: boolean;
    showCount?: boolean;
    maxlength?: number | undefined;
    size?: string;
  }>(),
  {
    modelValue: "",
    class: undefined,
    inputClass: undefined,
    maxlength: undefined,
    size: "default",
  }
);

const emit = defineEmits<{ "update:modelValue": [value: string | number] }>();
const attrs = useAttrs();

const modelValue = useVModel(props, "modelValue", emit, {
  passive: true,
  defaultValue: props.modelValue,
});
</script>

<template>
  <InputGroupField
    v-model="modelValue"
    :class="props.class"
    :input-class="props.inputClass"
    :clearable="props.clearable"
    :show-password="props.showPassword"
    :show-count="props.showCount"
    :maxlength="props.maxlength"
    :size="props.size"
    v-bind="attrs"
  >
    <template v-if="$slots['leading']" #leading>
      <slot name="leading" />
    </template>
    <template v-if="$slots['actions']" #trailing>
      <slot name="actions" />
    </template>
  </InputGroupField>
</template>
