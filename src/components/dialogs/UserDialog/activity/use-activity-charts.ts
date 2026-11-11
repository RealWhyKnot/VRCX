import { h, nextTick } from "vue";
import type { ComputedRef, Ref } from "vue";
import type { useI18n } from "vue-i18n";
import { toast } from "vue-sonner";
import { Sprout, Tractor } from "lucide-vue-next";
import * as echarts from "echarts";

import { logError } from "../../../../stores/notification/errors";
import type { HeatmapView } from "./activity-tab-types";
import { buildHeatmapOption, toHeatmapSeriesData } from "./build-heatmap-option";

type ActivityChartsDeps = {
  t: ReturnType<typeof useI18n>["t"];
  activityChartRef: Ref<HTMLDivElement | null>;
  overlapChartRef: Ref<HTMLDivElement | null>;
  isDarkMode: Ref<boolean>;
  weekStartsOn: Ref<0 | 1 | 6>;
  displayDayLabels: ComputedRef<string[]>;
  hourLabels: string[];
  mainHeatmapView: Ref<HeatmapView>;
  filteredEventCount: Ref<number>;
  overlapHeatmapView: Ref<HeatmapView>;
  hasOverlapData: Ref<boolean>;
  isOverlapLoading: Ref<boolean>;
};

export function useActivityCharts({
  t,
  activityChartRef,
  overlapChartRef,
  isDarkMode,
  weekStartsOn,
  displayDayLabels,
  hourLabels,
  mainHeatmapView,
  filteredEventCount,
  overlapHeatmapView,
  hasOverlapData,
  isOverlapLoading,
}: ActivityChartsDeps) {
  let overlapRenderTimer: ReturnType<typeof setTimeout> | undefined;
  const overlapRenderDelay = 80;

  let activityChart: echarts.ECharts | null = null;
  let overlapChart: echarts.ECharts | null = null;
  let activityResizeObserver: ResizeObserver | null = null;
  let overlapResizeObserver: ResizeObserver | null = null;
  let easterEggTimer: ReturnType<typeof setTimeout> | undefined;

  function ensureActivityChart() {
    if (!activityChart && activityChartRef.value) {
      activityChart = echarts.init(activityChartRef.value, isDarkMode.value ? "dark" : null, { height: 240 });
      activityResizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
          activityChart?.resize({ width: entry.contentRect.width });
        }
      });
      activityResizeObserver.observe(activityChartRef.value);
    }
  }

  function ensureOverlapChart() {
    if (!overlapChart && overlapChartRef.value) {
      overlapChart = echarts.init(overlapChartRef.value, isDarkMode.value ? "dark" : null, { height: 240 });
      overlapResizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
          overlapChart?.resize({ width: entry.contentRect.width });
        }
      });
      overlapResizeObserver.observe(overlapChartRef.value);
    }
  }

  function disposeCharts() {
    activityResizeObserver?.disconnect();
    overlapResizeObserver?.disconnect();
    activityResizeObserver = null;
    overlapResizeObserver = null;
    activityChart?.dispose();
    overlapChart?.dispose();
    activityChart = null;
    overlapChart = null;
  }

  function renderActivityChart() {
    if (mainHeatmapView.value.normalizedBuckets.length === 0 || filteredEventCount.value === 0) {
      activityChart?.clear();
      return;
    }
    ensureActivityChart();
    if (!activityChart) return;

    activityChart.setOption(
      buildHeatmapOption({
        data: toHeatmapSeriesData(mainHeatmapView.value.normalizedBuckets, weekStartsOn.value),
        rawBuckets: mainHeatmapView.value.rawBuckets,
        dayLabels: displayDayLabels.value,
        hourLabels,
        weekStartsOn: weekStartsOn.value,
        isDarkMode: isDarkMode.value,
        emptyColor: isDarkMode.value ? "hsl(220, 15%, 12%)" : "hsl(210, 30%, 95%)",
        scaleColors: isDarkMode.value
          ? ["hsl(160, 40%, 24%)", "hsl(150, 48%, 32%)", "hsl(142, 55%, 38%)", "hsl(142, 65%, 46%)", "hsl(142, 80%, 55%)"]
          : ["hsl(160, 40%, 82%)", "hsl(155, 45%, 68%)", "hsl(142, 55%, 55%)", "hsl(142, 65%, 40%)", "hsl(142, 76%, 30%)"],
        unitLabel: t("dialog.user.activity.minutes_online"),
      }),
      { replaceMerge: ["series"] }
    );
  }

  function renderOverlapChart() {
    if (!hasOverlapData.value || overlapHeatmapView.value.normalizedBuckets.length === 0) {
      if (!isOverlapLoading.value) {
        overlapChart?.clear();
      }
      return;
    }
    ensureOverlapChart();
    if (!overlapChart) return;

    overlapChart.setOption(
      buildHeatmapOption({
        data: toHeatmapSeriesData(overlapHeatmapView.value.normalizedBuckets, weekStartsOn.value),
        rawBuckets: overlapHeatmapView.value.rawBuckets,
        dayLabels: displayDayLabels.value,
        hourLabels,
        weekStartsOn: weekStartsOn.value,
        isDarkMode: isDarkMode.value,
        emptyColor: isDarkMode.value ? "hsl(220, 15%, 12%)" : "hsl(210, 30%, 95%)",
        scaleColors: isDarkMode.value
          ? ["hsl(260, 30%, 26%)", "hsl(260, 42%, 36%)", "hsl(260, 50%, 45%)", "hsl(260, 60%, 54%)", "hsl(260, 70%, 62%)"]
          : ["hsl(260, 35%, 85%)", "hsl(260, 42%, 70%)", "hsl(260, 48%, 58%)", "hsl(260, 55%, 48%)", "hsl(260, 60%, 38%)"],
        unitLabel: t("dialog.user.activity.overlap.minutes_overlap"),
      }),
      { replaceMerge: ["series"] }
    );
  }

  function rebuildCharts() {
    disposeCharts();
    clearOverlapRenderTimer();
    nextTick(() => {
      renderActivityChart();
      renderOverlapChart();
    }).catch(logError);
  }

  function onChartRightClick() {
    toast(t("dialog.user.activity.chart_hint"), { position: "bottom-center", icon: h(Tractor) });
    clearTimeout(easterEggTimer);
    easterEggTimer = setTimeout(() => {
      easterEggTimer = undefined;
    }, 5000);
  }

  function onOverlapChartRightClick() {
    if (easterEggTimer) {
      toast(t("dialog.user.activity.chart_hint_reply"), { position: "bottom-center", icon: h(Sprout) });
    }
  }

  function clearOverlapRenderTimer() {
    if (overlapRenderTimer !== undefined) {
      clearTimeout(overlapRenderTimer);
      overlapRenderTimer = undefined;
    }
  }
  function scheduleOverlapChartRender() {
    clearOverlapRenderTimer();
    overlapRenderTimer = setTimeout(() => {
      overlapRenderTimer = undefined;
      renderOverlapChart();
    }, overlapRenderDelay);
  }

  function clearEasterEggTimer() {
    clearTimeout(easterEggTimer);
  }

  return {
    renderActivityChart,
    rebuildCharts,
    scheduleOverlapChartRender,
    clearOverlapRenderTimer,
    onChartRightClick,
    onOverlapChartRightClick,
    clearEasterEggTimer,
    disposeCharts,
  };
}
