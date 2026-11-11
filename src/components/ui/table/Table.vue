<script setup lang="ts">
import type { ClassValue } from "clsx";
import type { StyleValue } from "vue";
import { cn } from "@/lib/utils";

defineOptions({ name: "UiTable" });

const props = withDefaults(
  defineProps<{
    class?: ClassValue | undefined;
    style?: StyleValue | undefined;
  }>(),
  {
    class: undefined,
    style: undefined,
  }
);
</script>

<template>
  <div data-slot="table-container" class="relative w-full">
    <table data-slot="table" :class="cn('w-full caption-bottom text-[13px] in-[.is-compact-table]:text-[12px]', props.class)" :style="props.style">
      <slot />
    </table>
  </div>
</template>
