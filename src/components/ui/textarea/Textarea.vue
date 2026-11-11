<script setup lang="ts">
import type { ClassValue } from "clsx";
import { computed, useAttrs } from "vue";
import { cn } from "@/lib/utils";
import { useVModel } from "@vueuse/core";

defineOptions({ name: "UiTextarea" });

const props = withDefaults(
  defineProps<{
    class?: ClassValue | undefined;
    defaultValue?: string | number | undefined;
    modelValue?: string | number | undefined;
  }>(),
  {
    class: undefined,
    defaultValue: undefined,
    modelValue: undefined,
  }
);

const emits = defineEmits<{ "update:modelValue": [value: string | number] }>();
const attrs = useAttrs();

const modelValue = useVModel(props, "modelValue", emits, {
  passive: true,
  defaultValue: props.defaultValue,
});

const autosizeClass = computed(() => {
  const raw = attrs["data-autosize"];
  const isAutosize = raw === "" || raw === true || raw === "true";
  return isAutosize ? "field-sizing-content" : "[field-sizing:fixed]";
});
</script>

<template>
  <textarea
    v-model="modelValue"
    data-slot="textarea"
    :class="
      cn(
        'border-input placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:bg-input/30 flex min-h-16 w-full rounded-md border bg-transparent px-3 py-2 text-base shadow-xs transition-[color,box-shadow] outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50 md:text-sm',
        autosizeClass,
        props.class
      )
    "
  />
</template>
