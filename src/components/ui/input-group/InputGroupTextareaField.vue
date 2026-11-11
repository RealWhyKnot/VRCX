<script setup lang="ts">
import type { ClassValue } from "clsx";
import { computed, nextTick, onMounted, ref, useAttrs, watch } from "vue";
import { X } from "lucide-vue-next";
import { cn } from "@/lib/utils";
import { useVModel } from "@vueuse/core";

import InputGroup from "./InputGroup.vue";
import InputGroupAddon from "./InputGroupAddon.vue";
import InputGroupButton from "./InputGroupButton.vue";
import InputGroupText from "./InputGroupText.vue";
import InputGroupTextarea from "./InputGroupTextarea.vue";
import { resolveWrapperStyle } from "./wrapper-style";

defineOptions({ inheritAttrs: false });

type AutosizeOptions = {
  minRows?: number;
  maxRows?: number;
};

const props = withDefaults(
  defineProps<{
    modelValue?: string | number | null | undefined;
    class?: ClassValue | undefined;
    inputClass?: ClassValue | undefined;
    clearable?: boolean;
    showCount?: boolean;
    maxlength?: number | undefined;
    rows?: number | undefined;
    autosize?: boolean | AutosizeOptions;
  }>(),
  {
    modelValue: "",
    class: undefined,
    inputClass: undefined,
    clearable: false,
    showCount: false,
    maxlength: undefined,
    rows: undefined,
    autosize: false,
  }
);

const emit = defineEmits<{ "update:modelValue": [value: string]; input: [value: string]; change: [value: string] }>();
const attrs = useAttrs();
const DETACHED_ATTRS = ["style", "onInput", "onChange"];

const modelValue = useVModel(props, "modelValue", emit, {
  passive: true,
  defaultValue: props.modelValue,
});

const textareaRef = ref<{ $el: unknown } | null>(null);
const valueLength = computed(() => String(modelValue.value ?? "").length);
const maxLength = computed(() => props.maxlength);
const wrapperClass = computed(() => cn(props.class, "flex-nowrap"));
const inputClass = computed(() => cn(props.inputClass));
const wrapperStyle = computed(() => {
  const { style } = attrs;
  return resolveWrapperStyle(style);
});
const showCount = computed(() => Boolean(maxLength.value) && props.showCount);
const autosizeConfig = computed<AutosizeOptions | null>(() => {
  if (!props.autosize) return null;
  return typeof props.autosize === "object" ? props.autosize : {};
});

const inputAttrs = computed(() => {
  const rest = Object.fromEntries(Object.entries(attrs).filter(([key]) => !DETACHED_ATTRS.includes(key)));
  return {
    ...rest,
    ...(autosizeConfig.value ? { "data-autosize": "true" } : {}),
    maxlength: maxLength.value,
  };
});

const isDisabled = computed(() => {
  const { disabled } = attrs;
  return Boolean(disabled);
});

function resolveTextareaEl() {
  const el = textareaRef.value?.$el;
  return el instanceof HTMLElement ? el : null;
}

function resizeTextarea() {
  if (!autosizeConfig.value) return;
  const el = resolveTextareaEl();
  if (!el) return;
  const computedStyle = window.getComputedStyle(el);
  const lineHeight = Number(computedStyle.lineHeight.replace("px", "")) || 16;
  const paddingTop = Number(computedStyle.paddingTop.replace("px", "")) || 0;
  const paddingBottom = Number(computedStyle.paddingBottom.replace("px", "")) || 0;
  const minRows = autosizeConfig.value.minRows ?? (Number(attrs["rows"]) || 1);
  const maxRows = autosizeConfig.value.maxRows ?? Number.POSITIVE_INFINITY;
  const minHeight = lineHeight * minRows + paddingTop + paddingBottom;
  const maxHeight = lineHeight * maxRows + paddingTop + paddingBottom;

  el.style.height = "auto";
  const nextHeight = Math.min(maxHeight, Math.max(el.scrollHeight, minHeight));
  el.style.height = `${nextHeight}px`;
}

async function clearValue() {
  if (isDisabled.value) return;
  modelValue.value = "";
  emit("input", "");
  emit("change", "");
  await nextTick();
  resizeTextarea();
}

function readTextareaValue(event: Event) {
  const target = event.target;
  return target instanceof HTMLTextAreaElement ? target.value : "";
}

function handleInput(event: Event) {
  emit("input", readTextareaValue(event));
  resizeTextarea();
}

function handleChange(event: Event) {
  emit("change", readTextareaValue(event));
}

onMounted(async () => {
  if (autosizeConfig.value) {
    await nextTick();
    resizeTextarea();
  }
});

watch(
  () => modelValue.value,
  async () => {
    if (autosizeConfig.value) {
      await nextTick();
      resizeTextarea();
    }
  }
);
</script>

<template>
  <InputGroup :class="wrapperClass" :style="wrapperStyle" :data-disabled="isDisabled ? 'true' : undefined">
    <InputGroupAddon v-if="$slots['leading']" align="block-start">
      <slot name="leading" />
    </InputGroupAddon>
    <InputGroupTextarea
      ref="textareaRef"
      v-model="modelValue"
      :class="inputClass"
      :rows="props.rows"
      v-bind="inputAttrs"
      @input="handleInput"
      @change="handleChange"
    />
    <InputGroupAddon v-if="$slots['trailing']" align="block-end">
      <slot name="trailing" />
    </InputGroupAddon>
    <InputGroupAddon v-if="props.clearable && valueLength > 0" align="inline-end">
      <InputGroupButton size="icon-xs" :disabled="isDisabled" @click="clearValue">
        <X class="size-3.5" />
        <span class="sr-only">Clear</span>
      </InputGroupButton>
    </InputGroupAddon>
    <InputGroupAddon v-if="showCount" align="block-end">
      <InputGroupText class="gap-1 tabular-nums text-xs">
        <span>{{ valueLength }}</span>
        <span class="text-muted-foreground/70">/ {{ maxLength }}</span>
      </InputGroupText>
    </InputGroupAddon>
  </InputGroup>
</template>
