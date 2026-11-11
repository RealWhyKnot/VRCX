<script setup lang="ts">
import type { PrimitiveProps } from "reka-ui";
import type { ClassValue } from "clsx";
import { DialogClose, DialogContent, DialogPortal, useForwardPropsEmits } from "reka-ui";
import type { DialogContentEmits } from "reka-ui";
import { X } from "lucide-vue-next";
import { cn } from "@/lib/utils";
import { computed } from "vue";

import SheetOverlay from "./SheetOverlay.vue";

defineOptions({
  inheritAttrs: false,
});

const props = withDefaults(
  defineProps<{
    class?: ClassValue | undefined;
    side?: string;
    forceMount?: boolean;
    disableOutsidePointerEvents?: boolean;
    asChild?: boolean;
    as?: PrimitiveProps["as"] | undefined;
  }>(),
  {
    class: undefined,
    side: "right",
    as: undefined,
  }
);
const emits = defineEmits<DialogContentEmits>();

const delegatedProps = computed(() => ({
  forceMount: props.forceMount,
  disableOutsidePointerEvents: props.disableOutsidePointerEvents,
  asChild: props.asChild,
  ...(props.as === undefined ? {} : { as: props.as }),
}));

const forwarded = useForwardPropsEmits(delegatedProps, emits);
</script>

<template>
  <DialogPortal>
    <SheetOverlay />
    <DialogContent
      data-slot="sheet-content"
      :class="
        cn(
          'bg-background data-[state=open]:animate-in data-[state=closed]:animate-out fixed z-50 flex flex-col gap-4 shadow-lg transition ease-in-out data-[state=closed]:duration-300 data-[state=open]:duration-500',
          side === 'right' &&
            'data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right inset-y-0 right-0 h-full w-3/4 border-l sm:max-w-sm',
          side === 'left' && 'data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left inset-y-0 left-0 h-full w-3/4 border-r sm:max-w-sm',
          side === 'top' && 'data-[state=closed]:slide-out-to-top data-[state=open]:slide-in-from-top inset-x-0 top-0 h-auto border-b',
          side === 'bottom' && 'data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom inset-x-0 bottom-0 h-auto border-t',
          props.class
        )
      "
      v-bind="{ ...$attrs, ...forwarded }"
    >
      <slot />

      <DialogClose
        class="ring-offset-background focus:ring-ring data-[state=open]:bg-secondary absolute top-4 right-4 rounded-xs opacity-70 transition-opacity hover:opacity-100 focus:ring-2 focus:ring-offset-2 focus:outline-hidden disabled:pointer-events-none cursor-pointer"
      >
        <X class="size-4" />
        <span class="sr-only">Close</span>
      </DialogClose>
    </DialogContent>
  </DialogPortal>
</template>
