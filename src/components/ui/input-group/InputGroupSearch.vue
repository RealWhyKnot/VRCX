<script setup lang="ts">
import type { ClassValue } from "clsx";
import { useAttrs } from "vue";
import { useVModel } from "@vueuse/core";
import { Search } from "lucide-vue-next";

import InputGroupField from "./InputGroupField.vue";

defineOptions({ inheritAttrs: false });

const props = withDefaults(
  defineProps<{
    modelValue?: string | number | null | undefined;
    class?: ClassValue | undefined;
    inputClass?: ClassValue | undefined;
    clearable?: boolean;
    size?: string;
  }>(),
  {
    modelValue: "",
    class: undefined,
    inputClass: undefined,
    clearable: true,
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
  <InputGroupField v-model="modelValue" :class="props.class" :input-class="props.inputClass" :clearable="props.clearable" :size="props.size" v-bind="attrs">
    <template #leading>
      <Search class="size-4" />
    </template>
    <template v-if="$slots['trailing']" #trailing>
      <slot name="trailing" />
    </template>
  </InputGroupField>
</template>
