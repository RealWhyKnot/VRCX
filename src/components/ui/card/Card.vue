<script setup lang="ts">
import type { ClassValue } from "clsx";

import { cn } from "@/lib/utils";

defineOptions({ name: "UiCard" });

const props = withDefaults(defineProps<{ class?: ClassValue }>(), {
  class: undefined,
});
</script>

<template>
  <div data-slot="card" :class="cn('bg-card text-card-foreground flex flex-col gap-6 rounded-xl border py-6 shadow-sm', props.class)">
    <slot />
  </div>
</template>
