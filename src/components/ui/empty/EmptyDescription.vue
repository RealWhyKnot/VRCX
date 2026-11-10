<script setup lang="ts">
import { cn } from "@/lib/utils";

defineProps<{ class?: unknown }>();
</script>

<template>
  <p
    data-slot="empty-description"
    :class="cn('text-muted-foreground [&>a:hover]:text-primary text-sm/relaxed [&>a]:underline [&>a]:underline-offset-4', $attrs.class ?? '')"
  >
    <slot />
  </p>
</template>
