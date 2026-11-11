<script setup lang="ts">
import type { ClassValue } from "clsx";
import { computed, useAttrs, useSlots } from "vue";
import { useVModel } from "@vueuse/core";

import InputGroupField from "./InputGroupField.vue";
import InputGroupText from "./InputGroupText.vue";

defineOptions({ inheritAttrs: false });

const props = withDefaults(
  defineProps<{
    modelValue?: string | number | null | undefined;
    class?: ClassValue | undefined;
    inputClass?: ClassValue | undefined;
    prefixText?: string;
    suffixText?: string;
    clearable?: boolean;
    size?: string;
  }>(),
  {
    modelValue: "",
    class: undefined,
    inputClass: undefined,
    prefixText: "",
    suffixText: "",
    size: "default",
  }
);

const emit = defineEmits<{ "update:modelValue": [value: string | number] }>();
const attrs = useAttrs();
const slots = useSlots();

const modelValue = useVModel(props, "modelValue", emit, {
  passive: true,
  defaultValue: props.modelValue,
});

const hasLeading = computed(() => {
  const { leading } = slots;
  return Boolean(props.prefixText) || Boolean(leading);
});
const hasTrailing = computed(() => {
  const { trailing } = slots;
  return Boolean(props.suffixText) || Boolean(trailing);
});
</script>

<template>
  <InputGroupField v-model="modelValue" :class="props.class" :input-class="props.inputClass" :clearable="props.clearable" :size="props.size" v-bind="attrs">
    <template v-if="hasLeading" #leading>
      <InputGroupText v-if="props.prefixText">{{ props.prefixText }}</InputGroupText>
      <slot name="leading" />
    </template>
    <template v-if="hasTrailing" #trailing>
      <slot name="trailing" />
      <InputGroupText v-if="props.suffixText">{{ props.suffixText }}</InputGroupText>
    </template>
  </InputGroupField>
</template>
