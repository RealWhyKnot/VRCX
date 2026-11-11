<script setup lang="ts">
import type { EmblaCarouselType, EmblaOptionsType, EmblaPluginType } from "embla-carousel";
import type { ClassValue } from "clsx";
import { cn } from "@/lib/utils";

import { useProvideCarousel } from "./use-carousel";

defineOptions({ name: "UiCarousel" });

const props = withDefaults(
  defineProps<{
    opts?: EmblaOptionsType | undefined;
    plugins?: EmblaPluginType[] | undefined;
    orientation?: "horizontal" | "vertical";
    class?: ClassValue | undefined;
  }>(),
  {
    opts: undefined,
    plugins: undefined,
    orientation: "horizontal",
    class: undefined,
  }
);

const emits = defineEmits<{
  "init-api": [api: EmblaCarouselType];
}>();

const { canScrollNext, canScrollPrev, carouselApi, carouselRef, orientation, scrollNext, scrollPrev } = useProvideCarousel(props, emits);

defineExpose({
  canScrollNext,
  canScrollPrev,
  carouselApi,
  carouselRef,
  orientation,
  scrollNext,
  scrollPrev,
});

function onKeyDown(event: KeyboardEvent) {
  const prevKey = props.orientation === "vertical" ? "ArrowUp" : "ArrowLeft";
  const nextKey = props.orientation === "vertical" ? "ArrowDown" : "ArrowRight";

  if (event.key === prevKey) {
    event.preventDefault();
    scrollPrev();

    return;
  }

  if (event.key === nextKey) {
    event.preventDefault();
    scrollNext();
  }
}
</script>

<template>
  <div data-slot="carousel" :class="cn('relative', props.class)" role="region" aria-roledescription="carousel" tabindex="0" @keydown="onKeyDown">
    <slot :can-scroll-next :can-scroll-prev :carousel-api :carousel-ref :orientation :scroll-next :scroll-prev />
  </div>
</template>
