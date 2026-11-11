<script setup lang="ts">
import type { TabsRootEmits, TabsRootProps } from "reka-ui";
import { TabsRoot, useForwardPropsEmits } from "reka-ui";
import type { ClassValue } from "clsx";
import { cn } from "@/lib/utils";
import { computed } from "vue";

defineOptions({ name: "UiTabs" });

const props = defineProps<{
  defaultValue?: TabsRootProps["defaultValue"] | undefined;
  orientation?: TabsRootProps["orientation"] | undefined;
  dir?: TabsRootProps["dir"] | undefined;
  activationMode?: TabsRootProps["activationMode"] | undefined;
  modelValue?: TabsRootProps["modelValue"] | undefined;
  unmountOnHide?: boolean;
  asChild?: boolean;
  as?: TabsRootProps["as"] | undefined;
  class?: ClassValue | undefined;
}>();
const emits = defineEmits<TabsRootEmits>();

const delegatedProps = computed(() => ({
  ...(props.defaultValue === undefined ? {} : { defaultValue: props.defaultValue }),
  ...(props.orientation === undefined ? {} : { orientation: props.orientation }),
  ...(props.dir === undefined ? {} : { dir: props.dir }),
  ...(props.activationMode === undefined ? {} : { activationMode: props.activationMode }),
  ...(props.modelValue === undefined ? {} : { modelValue: props.modelValue }),
  unmountOnHide: props.unmountOnHide,
  asChild: props.asChild,
  ...(props.as === undefined ? {} : { as: props.as }),
}));
const forwarded = useForwardPropsEmits(delegatedProps, emits);
</script>

<template>
  <TabsRoot v-slot="slotProps" data-slot="tabs" v-bind="forwarded" :class="cn('flex flex-col gap-2', props.class)">
    <slot v-bind="slotProps" />
  </TabsRoot>
</template>
