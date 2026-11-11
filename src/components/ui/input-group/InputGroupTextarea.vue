<script setup lang="ts">
import type { ClassValue } from "clsx";
import Textarea from "@/components/ui/textarea/Textarea.vue";
import { cn } from "@/lib/utils";

const props = defineProps<{ class?: ClassValue }>();
</script>

<template>
  <Textarea
    data-slot="input-group-control"
    :class="cn('flex-1 resize-none rounded-none border-0 bg-transparent py-3 shadow-none focus-visible:ring-0 dark:bg-transparent break-all', props.class)"
  />
</template>
