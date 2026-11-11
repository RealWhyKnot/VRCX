<script setup lang="ts">
import type { HTMLAttributes } from "vue";

defineOptions({ name: "UiBreadcrumb" });

const props = defineProps<{ class?: HTMLAttributes extends { class?: infer Value } ? Value : never }>();
</script>

<template>
  <nav aria-label="breadcrumb" data-slot="breadcrumb" :class="props.class">
    <slot />
  </nav>
</template>
