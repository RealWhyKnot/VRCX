<script setup lang="ts">
import type { ClassValue } from "clsx";
import { cn } from "@/lib/utils";

defineOptions({ name: "UiEmpty" });

const props = defineProps<{ class?: ClassValue }>();
</script>

<template>
  <div
    data-slot="empty"
    :class="cn('flex min-w-0 flex-1 flex-col items-center justify-center gap-6 text-balance rounded-lg border-dashed p-6 text-center md:p-12', props.class)"
  >
    <slot />
  </div>
</template>
