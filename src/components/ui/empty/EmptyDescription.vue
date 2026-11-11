<script setup lang="ts">
import type { ClassValue } from "clsx";
import { cn } from "@/lib/utils";

defineProps<{ class?: ClassValue }>();
</script>

<template>
  <p
    data-slot="empty-description"
    :class="cn('text-muted-foreground [&>a:hover]:text-primary text-sm/relaxed [&>a]:underline [&>a]:underline-offset-4', $attrs.class ?? '')"
  >
    <slot />
  </p>
</template>
