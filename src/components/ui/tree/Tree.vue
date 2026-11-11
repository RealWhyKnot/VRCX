<script setup lang="ts">
import type { TreeRootEmits, TreeRootProps } from "reka-ui";
import { TreeRoot } from "reka-ui";
import type { ClassValue } from "clsx";
import { cn } from "@/lib/utils";
import { computed } from "vue";

defineOptions({ name: "UiTree" });

const props = withDefaults(
  defineProps<{
    items: NonNullable<TreeRootProps["items"]>;
    getKey: TreeRootProps["getKey"];
    getChildren?: TreeRootProps["getChildren"] | undefined;
    defaultExpanded?: TreeRootProps["defaultExpanded"] | undefined;
    expanded?: TreeRootProps["expanded"] | undefined;
    multiple?: boolean;
    propagateSelect?: boolean;
    class?: ClassValue | undefined;
  }>(),
  {
    getChildren: undefined,
    defaultExpanded: undefined,
    expanded: undefined,
    multiple: false,
    propagateSelect: false,
    class: undefined,
  }
);

const emit = defineEmits<TreeRootEmits>();

const delegatedProps = computed(() => ({
  items: props.items,
  getKey: props.getKey,
  ...(props.getChildren === undefined ? {} : { getChildren: props.getChildren }),
  ...(props.defaultExpanded === undefined ? {} : { defaultExpanded: props.defaultExpanded }),
  ...(props.expanded === undefined ? {} : { expanded: props.expanded }),
  multiple: props.multiple,
  propagateSelect: props.propagateSelect,
}));
</script>

<template>
  <TreeRoot
    v-bind="delegatedProps"
    :class="cn('flex flex-col', props.class)"
    @update:expanded="(val) => emit('update:expanded', val)"
    @update:model-value="(val) => emit('update:modelValue', val)"
  >
    <template #default="slotProps">
      <slot v-bind="slotProps" />
    </template>
  </TreeRoot>
</template>
