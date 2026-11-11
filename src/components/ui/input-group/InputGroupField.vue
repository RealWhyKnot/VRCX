<script setup lang="ts">
import type { ClassValue } from "clsx";
import { Eye, EyeOff, X } from "lucide-vue-next";
import { computed, ref, useAttrs } from "vue";
import { cn } from "@/lib/utils";
import { useVModel } from "@vueuse/core";

import InputGroup from "./InputGroup.vue";
import InputGroupAddon from "./InputGroupAddon.vue";
import InputGroupButton from "./InputGroupButton.vue";
import InputGroupInput from "./InputGroupInput.vue";
import InputGroupText from "./InputGroupText.vue";
import { resolveWrapperStyle } from "./wrapper-style";

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
    type?: string | undefined;
    size?: string;
  }>(),
  {
    modelValue: "",
    class: undefined,
    inputClass: undefined,
    maxlength: undefined,
    type: undefined,
    size: "default",
  }
);

const emit = defineEmits<{ "update:modelValue": [value: string]; input: [value: string]; change: [value: string] }>();
const attrs = useAttrs();
const DETACHED_ATTRS = ["style", "onInput", "onChange"];

const modelValue = useVModel(props, "modelValue", emit, {
  passive: true,
  defaultValue: props.modelValue,
});

const reveal = ref(false);
const valueLength = computed(() => String(modelValue.value ?? "").length);
const maxLength = computed(() => props.maxlength);
const wrapperClass = computed(() => cn(props.class, props.size === "sm" && "h-8", "flex-nowrap"));

const wrapperStyle = computed(() => {
  const { style } = attrs;
  return resolveWrapperStyle(style);
});

const inputType = computed(() => {
  const rawType = props.type;
  if (props.showPassword) {
    if (reveal.value) return "text";
    if (!rawType) return "password";
    return rawType;
  }
  return rawType;
});
const inputClass = computed(() => {
  const type = inputType.value ?? "";
  return cn(
    props.inputClass,
    ["date", "datetime-local", "month", "number", "time", "week"].includes(type) && "dark:[color-scheme:dark]",
    ["date", "datetime-local", "month", "time", "week"].includes(type) && "[&::-webkit-calendar-picker-indicator]:cursor-pointer"
  );
});

const inputAttrs = computed(() => {
  const rest = Object.fromEntries(Object.entries(attrs).filter(([key]) => !DETACHED_ATTRS.includes(key)));
  return {
    ...rest,
    type: inputType.value,
    maxlength: maxLength.value,
  };
});

const isDisabled = computed(() => {
  const { disabled } = attrs;
  return Boolean(disabled);
});
const showCount = computed(() => Boolean(maxLength.value) && props.showCount);

function readInputValue(event: Event) {
  const target = event.target;
  if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) return target.value;
  return "";
}

function clearValue() {
  if (isDisabled.value) return;
  modelValue.value = "";
  emit("input", "");
  emit("change", "");
}

function toggleReveal() {
  if (isDisabled.value) return;
  reveal.value = !reveal.value;
}

function handleInput(event: Event) {
  emit("input", readInputValue(event));
}

function handleChange(event: Event) {
  emit("change", readInputValue(event));
}
</script>

<template>
  <InputGroup :class="wrapperClass" :style="wrapperStyle" :data-disabled="isDisabled ? 'true' : undefined">
    <InputGroupAddon v-if="$slots['leading']" align="inline-start">
      <slot name="leading" />
    </InputGroupAddon>
    <InputGroupInput v-model="modelValue" :class="inputClass" v-bind="inputAttrs" @input="handleInput" @change="handleChange" />
    <InputGroupAddon v-if="$slots['trailing']" align="inline-end">
      <slot name="trailing" />
    </InputGroupAddon>
    <InputGroupAddon v-if="props.showPassword" align="inline-end">
      <InputGroupButton size="icon-xs" :disabled="isDisabled" @click="toggleReveal">
        <Eye v-if="!reveal" class="size-3.5" />
        <EyeOff v-else class="size-3.5" />
        <span class="sr-only">Toggle password</span>
      </InputGroupButton>
    </InputGroupAddon>
    <InputGroupAddon v-if="props.clearable && valueLength > 0" align="inline-end">
      <InputGroupButton size="icon-xs" :disabled="isDisabled" @click="clearValue">
        <X class="size-3.5" />
        <span class="sr-only">Clear</span>
      </InputGroupButton>
    </InputGroupAddon>
    <InputGroupAddon v-if="showCount && valueLength > 0" align="inline-end">
      <InputGroupText class="gap-1 tabular-nums text-xs">
        <span>{{ valueLength }}</span>
        <span class="text-muted-foreground/70">/ {{ maxLength }}</span>
      </InputGroupText>
    </InputGroupAddon>
  </InputGroup>
</template>
