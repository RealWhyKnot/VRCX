<script setup lang="ts">
import type { VariantProps } from "class-variance-authority";
import type { ClassValue } from "clsx";
import type { buttonVariants } from "@/components/ui/button";
import { ArrowRight } from "lucide-vue-next";
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

const { orientation, canScrollNext, scrollNext } = useCarousel();
</script>

<template>
  <Button
    data-slot="carousel-next"
    :disabled="!canScrollNext"
    :class="
      cn(
        'absolute size-8 rounded-full',
        orientation === 'horizontal' ? 'top-1/2 -right-12 -translate-y-1/2' : '-bottom-12 left-1/2 -translate-x-1/2 rotate-90',
        props.class
      )
    "
    :variant="variant"
    :size="size"
    @click="scrollNext"
  >
    <slot>
      <ArrowRight />
      <span class="sr-only">Next Slide</span>
    </slot>
  </Button>
</template>
