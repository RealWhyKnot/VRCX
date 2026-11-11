<script setup lang="ts">
import type { SelectRootEmits, SelectRootProps } from "reka-ui";
import { SelectRoot, useForwardPropsEmits } from "reka-ui";
import { computed } from "vue";

defineOptions({ name: "UiSelect" });

const props = defineProps<{
  open?: boolean;
  defaultOpen?: boolean;
  defaultValue?: SelectRootProps["defaultValue"];
  modelValue?: SelectRootProps["modelValue"];
  by?: SelectRootProps["by"];
  dir?: SelectRootProps["dir"];
  multiple?: boolean;
  autocomplete?: string;
  disabled?: boolean;
  name?: string;
  required?: boolean;
}>();
const emits = defineEmits<SelectRootEmits>();

const delegatedProps = computed(() => ({
  open: props.open,
  defaultOpen: props.defaultOpen,
  ...(props.defaultValue === undefined ? {} : { defaultValue: props.defaultValue }),
  ...(props.modelValue === undefined ? {} : { modelValue: props.modelValue }),
  ...(props.by === undefined ? {} : { by: props.by }),
  ...(props.dir === undefined ? {} : { dir: props.dir }),
  multiple: props.multiple,
  ...(props.autocomplete === undefined ? {} : { autocomplete: props.autocomplete }),
  disabled: props.disabled,
  ...(props.name === undefined ? {} : { name: props.name }),
  required: props.required,
}));

const forwarded = useForwardPropsEmits(delegatedProps, emits);

function handleOpenChange(isOpen: boolean) {
  if (!isOpen || typeof document === "undefined") {
    return;
  }

  const activeElement = document.activeElement;
  if (activeElement instanceof HTMLElement && activeElement.dataset["slot"] === "select-trigger") {
    activeElement.blur();
  }
}
</script>

<template>
  <SelectRoot v-slot="slotProps" data-slot="select" v-bind="forwarded" @update:open="handleOpenChange">
    <slot v-bind="slotProps" />
  </SelectRoot>
</template>
