<script setup lang="ts">
import type { PrimitiveProps, SplitterResizeHandleEmits, SplitterResizeHandleProps } from "reka-ui";
import { SplitterResizeHandle, useForwardPropsEmits } from "reka-ui";
import type { ClassValue } from "clsx";
import { GripVertical } from "lucide-vue-next";
import { cn } from "@/lib/utils";
import { computed } from "vue";

const props = withDefaults(
  defineProps<{
    id?: string | undefined;
    hitAreaMargins?: SplitterResizeHandleProps["hitAreaMargins"] | undefined;
    tabindex?: number | undefined;
    disabled?: boolean;
    nonce?: string | undefined;
    asChild?: boolean;
    as?: PrimitiveProps["as"] | undefined;
    class?: ClassValue | undefined;
    withHandle?: boolean;
  }>(),
  {
    id: undefined,
    hitAreaMargins: undefined,
    tabindex: undefined,
    nonce: undefined,
    as: undefined,
    class: undefined,
  }
);
const emits = defineEmits<SplitterResizeHandleEmits>();

const delegatedProps = computed(() => ({
  ...(props.id === undefined ? {} : { id: props.id }),
  ...(props.hitAreaMargins === undefined ? {} : { hitAreaMargins: props.hitAreaMargins }),
  ...(props.tabindex === undefined ? {} : { tabindex: props.tabindex }),
  disabled: props.disabled,
  ...(props.nonce === undefined ? {} : { nonce: props.nonce }),
  asChild: props.asChild,
  ...(props.as === undefined ? {} : { as: props.as }),
}));
const forwarded = useForwardPropsEmits(delegatedProps, emits);
</script>

<template>
  <SplitterResizeHandle
    data-slot="resizable-handle"
    v-bind="forwarded"
    :class="
      cn(
        'bg-border focus-visible:ring-ring relative flex w-px items-center justify-center after:absolute after:inset-y-0 after:left-1/2 after:w-1 after:-translate-x-1/2 focus-visible:ring-1 focus-visible:ring-offset-1 focus-visible:outline-hidden data-[orientation=vertical]:h-px data-[orientation=vertical]:w-full data-[orientation=vertical]:after:left-0 data-[orientation=vertical]:after:h-1 data-[orientation=vertical]:after:w-full data-[orientation=vertical]:after:-translate-y-1/2 data-[orientation=vertical]:after:translate-x-0 [&[data-orientation=vertical]>div]:rotate-90',
        props.class
      )
    "
  >
    <template v-if="props.withHandle">
      <div class="bg-border z-10 flex h-4 w-3 items-center justify-center rounded-xs border">
        <slot>
          <GripVertical class="size-2.5" />
        </slot>
      </div>
    </template>
  </SplitterResizeHandle>
</template>
