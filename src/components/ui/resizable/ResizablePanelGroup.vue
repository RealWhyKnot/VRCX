<script setup lang="ts">
import type { PrimitiveProps, SplitterGroupEmits, SplitterGroupProps } from "reka-ui";
import { SplitterGroup, useForwardPropsEmits } from "reka-ui";
import type { ClassValue } from "clsx";
import { cn } from "@/lib/utils";
import { computed } from "vue";

const props = defineProps<{
  id?: string | null | undefined;
  autoSaveId?: string | null | undefined;
  direction: SplitterGroupProps["direction"];
  keyboardResizeBy?: number | null | undefined;
  storage?: SplitterGroupProps["storage"] | undefined;
  asChild?: boolean;
  as?: PrimitiveProps["as"] | undefined;
  class?: ClassValue | undefined;
}>();
const emits = defineEmits<SplitterGroupEmits>();

const delegatedProps = computed(() => ({
  ...(props.id === undefined ? {} : { id: props.id }),
  ...(props.autoSaveId === undefined ? {} : { autoSaveId: props.autoSaveId }),
  ...(props.keyboardResizeBy === undefined ? {} : { keyboardResizeBy: props.keyboardResizeBy }),
  ...(props.storage === undefined ? {} : { storage: props.storage }),
  asChild: props.asChild,
  ...(props.as === undefined ? {} : { as: props.as }),
}));

const forwarded = useForwardPropsEmits(delegatedProps, emits);
</script>

<template>
  <SplitterGroup
    v-slot="slotProps"
    data-slot="resizable-panel-group"
    v-bind="forwarded"
    :direction="props.direction"
    :class="cn('flex h-full w-full data-[orientation=vertical]:flex-col', props.class)"
  >
    <slot v-bind="slotProps" />
  </SplitterGroup>
</template>
