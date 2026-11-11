<script setup lang="ts">
import type { PrimitiveProps } from "reka-ui";
import type { ClassValue } from "clsx";
import { DialogOverlay } from "reka-ui";
import { cn } from "@/lib/utils";
import { reactiveOmit } from "@vueuse/core";
import { storeToRefs } from "pinia";
import { useGeneralSettingsStore } from "@/stores/settings/general";

const props = withDefaults(
  defineProps<{
    forceMount?: boolean;
    asChild?: boolean;
    as?: PrimitiveProps["as"] | undefined;
    class?: ClassValue | undefined;
  }>(),
  {
    as: undefined,
    class: undefined,
  }
);

const delegatedProps: Record<string, unknown> = reactiveOmit(props, "class");
const { disableGpuAcceleration } = storeToRefs(useGeneralSettingsStore());
</script>

<template>
  <DialogOverlay
    data-slot="dialog-overlay"
    v-bind="delegatedProps"
    :class="
      cn(
        'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-black/40',
        !disableGpuAcceleration && 'backdrop-blur-xs',
        props.class
      )
    "
  >
    <slot />
  </DialogOverlay>
</template>
