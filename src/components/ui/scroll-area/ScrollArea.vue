<script setup lang="ts">
defineOptions({ inheritAttrs: false });

import type { PrimitiveProps, ScrollAreaRootProps } from "reka-ui";
import { ScrollAreaCorner, ScrollAreaRoot, ScrollAreaViewport } from "reka-ui";
import type { ClassValue } from "clsx";
import type { ComponentPublicInstance } from "vue";
import { computed, ref, useAttrs } from "vue";
import { cn } from "@/lib/utils";

import ScrollBar from "./ScrollBar.vue";

const props = withDefaults(
  defineProps<{
    type?: ScrollAreaRootProps["type"] | undefined;
    dir?: ScrollAreaRootProps["dir"] | undefined;
    scrollHideDelay?: number | undefined;
    asChild?: boolean;
    as?: PrimitiveProps["as"] | undefined;
    class?: ClassValue | undefined;
  }>(),
  {
    type: undefined,
    dir: undefined,
    scrollHideDelay: undefined,
    as: undefined,
    class: undefined,
  }
);

const delegatedProps = computed(() => ({
  ...(props.type === undefined ? {} : { type: props.type }),
  ...(props.dir === undefined ? {} : { dir: props.dir }),
  ...(props.scrollHideDelay === undefined ? {} : { scrollHideDelay: props.scrollHideDelay }),
  asChild: props.asChild,
  ...(props.as === undefined ? {} : { as: props.as }),
}));

const attrs = useAttrs();
const viewportEl = ref<unknown>(null);

function setViewportEl(el: Element | ComponentPublicInstance | null) {
  viewportEl.value = el instanceof Element ? el : (el?.$el ?? null);
}

defineExpose({ viewportEl, update: () => undefined });
</script>

<template>
  <ScrollAreaRoot data-slot="scroll-area" v-bind="delegatedProps" :class="cn('relative', props.class)">
    <ScrollAreaViewport
      :ref="setViewportEl"
      data-slot="scroll-area-viewport"
      v-bind="attrs"
      class="focus-visible:ring-ring/50 size-full rounded-[inherit] transition-[color,box-shadow] outline-none focus-visible:ring-[3px] focus-visible:outline-1"
    >
      <slot />
    </ScrollAreaViewport>
    <ScrollBar />
    <ScrollAreaCorner />
  </ScrollAreaRoot>
</template>
