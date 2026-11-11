<script setup lang="ts">
import type { VariantProps } from "class-variance-authority";
import type { ClassValue } from "clsx";
import type { buttonVariants } from "@/components/ui/button";
import { ArrowLeft } from "lucide-vue-next";
import Button from "@/components/ui/button/Button.vue";
import { cn } from "@/lib/utils";

import { useCarousel } from "./use-carousel";

const props = withDefaults(
  defineProps<{
    variant?: VariantProps<typeof buttonVariants>["variant"] | undefined;
    size?: VariantProps<typeof buttonVariants>["size"] | undefined;
    class?: ClassValue | undefined;
  }>(),
  {
    variant: "outline",
    size: "icon",
    class: undefined,
  }
);

const { orientation, canScrollPrev, scrollPrev } = useCarousel();
</script>

<template>
  <Button
    data-slot="carousel-previous"
    :disabled="!canScrollPrev"
    :class="
      cn(
        'absolute size-8 rounded-full',
        orientation === 'horizontal' ? 'top-1/2 -left-12 -translate-y-1/2' : '-top-12 left-1/2 -translate-x-1/2 rotate-90',
        props.class
      )
    "
    :variant="variant"
    :size="size"
    @click="scrollPrev"
  >
    <slot>
      <ArrowLeft />
      <span class="sr-only">Previous Slide</span>
    </slot>
  </Button>
</template>
