<script setup lang="ts">
import type { ClassValue } from "clsx";
import { cn } from "@/lib/utils";

import { useCarousel } from "./use-carousel";

defineOptions({
  inheritAttrs: false,
});

const props = defineProps<{ class?: ClassValue }>();

const { carouselRef, orientation } = useCarousel();

function bindCarouselRef(element: unknown) {
  carouselRef.value = element instanceof HTMLElement ? element : undefined;
}
</script>

<template>
  <div :ref="bindCarouselRef" data-slot="carousel-content" class="overflow-hidden">
    <div :class="cn('flex', orientation === 'horizontal' ? '-ml-4' : '-mt-4 flex-col', props.class)" v-bind="$attrs">
      <slot />
    </div>
  </div>
</template>
