<script setup lang="ts">
import type { ClassValue } from "clsx";
import { Loader2Icon } from "lucide-vue-next";
import { cn } from "@/lib/utils";

defineOptions({ name: "UiSpinner" });

const props = defineProps<{ class?: ClassValue }>();
</script>

<template>
  <Loader2Icon role="status" aria-label="Loading" :class="cn('size-4 animate-spin', props.class)" />
</template>
