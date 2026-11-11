import type { EmblaCarouselType, EmblaOptionsType, EmblaPluginType } from "embla-carousel";
import { onMounted, ref } from "vue";
import { createInjectionState } from "@vueuse/core";

import emblaCarouselVue from "embla-carousel-vue";

export type CarouselProps = {
  opts?: EmblaOptionsType | undefined;
  plugins?: EmblaPluginType[] | undefined;
  orientation: "horizontal" | "vertical";
};

export type CarouselEmits = (event: "init-api", api: EmblaCarouselType) => void;

const [useProvideCarousel, useInjectCarousel] = createInjectionState((props: CarouselProps, emits: CarouselEmits) => {
  const { opts, orientation, plugins } = props;
  const [emblaNode, emblaApi] = emblaCarouselVue(
    {
      ...opts,
      axis: orientation === "horizontal" ? "x" : "y",
    },
    plugins
  );

  function scrollPrev() {
    emblaApi.value?.scrollPrev();
  }
  function scrollNext() {
    emblaApi.value?.scrollNext();
  }

  const canScrollNext = ref(false);
  const canScrollPrev = ref(false);

  function onSelect(api: EmblaCarouselType) {
    canScrollNext.value = api.canScrollNext();
    canScrollPrev.value = api.canScrollPrev();
  }

  onMounted(() => {
    if (!emblaApi.value) return;

    emblaApi.value.on("init", onSelect);
    emblaApi.value.on("reInit", onSelect);
    emblaApi.value.on("select", onSelect);

    emits("init-api", emblaApi.value);
  });

  return {
    carouselRef: emblaNode,
    carouselApi: emblaApi,
    canScrollPrev,
    canScrollNext,
    scrollPrev,
    scrollNext,
    orientation,
  };
});

function useCarousel() {
  const carouselState = useInjectCarousel();

  if (!carouselState) throw new Error("useCarousel must be used within a <Carousel />");

  return carouselState;
}

export { useCarousel, useProvideCarousel };
