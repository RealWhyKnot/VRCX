import { ref } from "vue";
import type { Ref } from "vue";

import type { ActivityDetailChart } from "../activity-types";

export function useIntersectionObserver() {
  const intersectionObservers = ref<IntersectionObserver[]>([]);

  function clearIntersectionObservers() {
    intersectionObservers.value.forEach((observer) => {
      observer.disconnect();
    });
    intersectionObservers.value = [];
  }

  function handleIntersectionObserver(activityDetailChartRef: Ref<ActivityDetailChart[] | null>) {
    clearIntersectionObservers();

    activityDetailChartRef.value?.forEach((child, index) => {
      const observer = new IntersectionObserver((entries) => handleIntersection(index, entries, activityDetailChartRef));
      observer.observe(child.$el);
      intersectionObservers.value[index] = observer;
    });
  }
  function handleIntersection(index: number, entries: IntersectionObserverEntry[], activityDetailChartRef: Ref<ActivityDetailChart[] | null>) {
    entries.forEach((entry) => {
      const chart = activityDetailChartRef.value?.[index];
      if (entry.isIntersecting && chart) {
        chart.initEcharts();
        intersectionObservers.value[index]?.unobserve(entry.target);
      }
    });
  }

  return {
    handleIntersectionObserver,
  };
}
