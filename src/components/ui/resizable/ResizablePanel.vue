<script setup lang="ts">
import type { PrimitiveProps, SplitterPanelEmits } from "reka-ui";
import { SplitterPanel, useForwardExpose, useForwardPropsEmits } from "reka-ui";
import { computed } from "vue";

const props = withDefaults(
  defineProps<{
    collapsedSize?: number | undefined;
    collapsible?: boolean;
    defaultSize?: number | undefined;
    id?: string | undefined;
    maxSize?: number | undefined;
    minSize?: number | undefined;
    order?: number | undefined;
    asChild?: boolean;
    as?: PrimitiveProps["as"] | undefined;
  }>(),
  {
    collapsedSize: undefined,
    defaultSize: undefined,
    id: undefined,
    maxSize: undefined,
    minSize: undefined,
    order: undefined,
    as: undefined,
  }
);
const emits = defineEmits<SplitterPanelEmits>();

const delegatedProps = computed(() => ({
  ...(props.collapsedSize === undefined ? {} : { collapsedSize: props.collapsedSize }),
  collapsible: props.collapsible,
  ...(props.defaultSize === undefined ? {} : { defaultSize: props.defaultSize }),
  ...(props.id === undefined ? {} : { id: props.id }),
  ...(props.maxSize === undefined ? {} : { maxSize: props.maxSize }),
  ...(props.minSize === undefined ? {} : { minSize: props.minSize }),
  ...(props.order === undefined ? {} : { order: props.order }),
  asChild: props.asChild,
  ...(props.as === undefined ? {} : { as: props.as }),
}));
const forwarded = useForwardPropsEmits(delegatedProps, emits);
const { forwardRef } = useForwardExpose();
</script>

<template>
  <SplitterPanel :ref="forwardRef" v-slot="slotProps" data-slot="resizable-panel" v-bind="forwarded">
    <slot v-bind="slotProps" />
  </SplitterPanel>
</template>
