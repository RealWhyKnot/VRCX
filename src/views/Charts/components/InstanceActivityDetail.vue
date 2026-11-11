<template>
  <div style="width: 100%">
    <div class="mt-15" style="height: 25px">
      <transition name="el-fade-in-linear">
        <Location
          v-show="!isLoading"
          class="flex items-center justify-center"
          :location="activityDetailData[0]?.location"
          is-open-previous-instance-info-dialog
        />
      </transition>
    </div>

    <div v-if="hasChartData" ref="activityDetailChartRef"></div>
    <div v-else style="display: flex; justify-content: center; align-items: center; min-height: 160px; width: 100%">
      <DataTableEmpty type="nodata" />
    </div>
  </div>
</template>

<script setup lang="ts">
import Location from "@/components/Location.vue";
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import DataTableEmpty from "@/components/ui/data-table/DataTableEmpty.vue";
import { storeToRefs } from "pinia";

import dayjs from "dayjs";

import { useAppearanceSettingsStore } from "../../../stores/settings/appearance";
import { useUserStore } from "../../../stores/user";
import { timeToText } from "../../../shared/utils/base/format";

import * as echarts from "echarts";
import { showUserDialog } from "../../../coordinators/user-coordinator";
import { InstanceActivityTooltip } from "./instance-activity-tooltip.tsx";
import { renderToHtml } from "@/lib/utils";
import type { InstanceActivityEntry } from "../activity-types";

type DetailElement = {
  offset: number;
  time: number | null;
  tail: number;
  entry: InstanceActivityEntry;
};

const { isDarkMode, dtHour12 } = storeToRefs(useAppearanceSettingsStore());

const { currentUser } = storeToRefs(useUserStore());

const props = withDefaults(
  defineProps<{
    activityDetailData: InstanceActivityEntry[];
    barWidth?: number;
  }>(),
  { barWidth: 10 }
);

const activityDetailChartRef = ref<HTMLDivElement | null>(null);

const isLoading = ref(true);
let echartsInstance: echarts.EChartsType | null = null;
const usersFirstActivity = ref<InstanceActivityEntry[] | null>(null);
const resizeObserver = ref<ResizeObserver | null>(null);
const hasChartData = computed(() => props.activityDetailData.length > 0);

const startTimeStamp = computed(() => {
  return props.activityDetailData.find((item) => item.user_id === currentUser.value.id)?.joinTime.valueOf();
});

const endTimeStamp = computed(() => {
  return props.activityDetailData.find((item) => item.user_id === currentUser.value.id)?.leaveTime.valueOf();
});

watch(
  () => isDarkMode.value,
  () => {
    if (echartsInstance) {
      echartsInstance.dispose();
      echartsInstance = null;
      initEcharts();
    }
  }
);

watch(
  () => dtHour12.value,
  () => {
    if (echartsInstance) {
      initEcharts();
    }
  }
);

initResizeObserver();

onMounted(async () => {
  await nextTick();
  initEcharts();
});

onBeforeUnmount(() => {
  if (resizeObserver.value) {
    resizeObserver.value.disconnect();
    resizeObserver.value = null;
  }
});

function initResizeObserver() {
  resizeObserver.value = new ResizeObserver((entries) => {
    if (!echartsInstance) {
      return;
    }
    for (const entry of entries) {
      try {
        echartsInstance.resize({
          width: entry.contentRect.width,
          animation: {
            duration: 300,
          },
        });
      } catch (error) {
        console.warn("Error resizing chart:", error);
      }
    }
  });
}

function initEcharts() {
  if (!activityDetailChartRef.value || props.activityDetailData.length === 0) {
    isLoading.value = false;
    return;
  }

  const chartsHeight = props.activityDetailData.length * (props.barWidth + 10) + 200;
  const chartDom = activityDetailChartRef.value;

  const afterInit = () => {
    if (!echartsInstance) {
      console.error("ECharts instance not initialized");
      isLoading.value = false;
      return;
    }

    try {
      echartsInstance.resize({
        height: chartsHeight,
        animation: {
          duration: 300,
        },
      });

      echartsInstance.off("click");

      const options = getNewOption();
      const series = options.series;
      if (Array.isArray(series) && series.length > 0) {
        echartsInstance.clear();
        echartsInstance.setOption(options, { notMerge: true });
        echartsInstance.on("click", "yAxis", handleClickYAxisLabel);
      } else {
        echartsInstance.clear();
      }
    } catch (error) {
      console.error("Error in afterInit:", error);
    }

    isLoading.value = false;
  };

  const initEchartsInstance = () => {
    if (!echartsInstance) {
      echartsInstance = echarts.init(chartDom, isDarkMode.value ? "dark" : "null", {
        height: chartsHeight,
        useDirtyRect: props.activityDetailData.length > 80,
      });
      if (resizeObserver.value) {
        resizeObserver.value.observe(chartDom);
      }
    }
  };

  initEchartsInstance();
  setTimeout(afterInit, 50);
}

function handleClickYAxisLabel(params: echarts.ECElementEvent) {
  const userData = usersFirstActivity.value?.[params.dataIndex];
  if (userData?.user_id) {
    showUserDialog(userData.user_id);
  }
}

function getNewOption(): echarts.EChartsOption {
  if (props.activityDetailData.length === 0) {
    return {
      title: {
        text: "No data",
        left: "center",
        top: "middle",
      },
    };
  }

  if (!startTimeStamp.value || !endTimeStamp.value) {
    return {
      title: {
        text: "Invalid timestamp data",
        left: "center",
        top: "middle",
      },
    };
  }

  const startTime = startTimeStamp.value;
  const endTime = endTimeStamp.value;

  const userGroupedEntries = new Map<string | null, DetailElement[]>();

  const uniqueUserEntries: InstanceActivityEntry[] = [];
  for (const entry of props.activityDetailData) {
    let elements = userGroupedEntries.get(entry.user_id);
    if (!elements) {
      elements = [];
      userGroupedEntries.set(entry.user_id, elements);
      uniqueUserEntries.push(entry);
    }
    const lastElement = elements[elements.length - 1];
    const offset = Math.max(0, elements.length === 0 ? entry.joinTime.valueOf() - startTime : entry.joinTime.valueOf() - startTime - (lastElement?.tail ?? 0));
    const tail = elements.length === 0 ? offset + (entry.time ?? 0) : (lastElement?.tail ?? 0) + offset + (entry.time ?? 0);
    const element = { offset, time: entry.time, tail, entry };
    elements.push(element);
  }
  usersFirstActivity.value = uniqueUserEntries;

  const generateSeries = (): echarts.BarSeriesOption[] => {
    const maxEntryCount = Math.max(...Array.from(userGroupedEntries.values()).map((entries) => entries.length));
    const placeholderSeries = (data: number[]): echarts.BarSeriesOption => {
      return {
        name: "Placeholder",
        type: "bar",
        stack: "Total",
        itemStyle: {
          borderColor: "transparent",
          color: "transparent",
        },
        emphasis: {
          itemStyle: {
            borderColor: "transparent",
            color: "transparent",
          },
        },
        data,
      };
    };
    const timeSeries = (data: (number | null)[]): echarts.BarSeriesOption => {
      return {
        name: "Time",
        type: "bar",
        stack: "Total",
        colorBy: "data",
        barWidth: props.barWidth,
        emphasis: {
          focus: "self",
        },
        itemStyle: {
          borderRadius: 2,
          shadowBlur: 2,
          shadowOffsetX: 0.7,
          shadowOffsetY: 0.5,
        },
        data,
      };
    };

    const series = Array.from({ length: maxEntryCount }).flatMap((_, index) => {
      return [
        placeholderSeries(
          uniqueUserEntries.map((entry) => {
            const element = userGroupedEntries.get(entry.user_id)?.[index];
            return element ? element.offset : 0;
          })
        ),
        timeSeries(
          uniqueUserEntries.map((entry) => {
            const element = userGroupedEntries.get(entry.user_id)?.[index];
            return element ? element.time : 0;
          })
        ),
      ];
    });

    return series;
  };

  const friendOrFavIcon = (displayName: string | null) => {
    const foundItem = props.activityDetailData.find((item) => item.display_name === displayName);

    if (!foundItem) {
      return "";
    }

    if (foundItem.isFavorite) {
      return "⭐";
    }
    if (foundItem.isFriend) {
      return "💚";
    }
    return "";
  };

  const getTooltip = (params: echarts.DefaultLabelFormatterCallbackParams) => {
    const seriesIndex = params.seriesIndex ?? 0;
    const isTimeSeries = seriesIndex % 2 === 1;
    if (!isTimeSeries) return "";

    const userData = uniqueUserEntries[params.dataIndex];
    const targetEntryIndex = Math.floor(seriesIndex / 2);

    const instanceData = userData === undefined ? undefined : userGroupedEntries.get(userData.user_id)?.[targetEntryIndex]?.entry;

    if (!instanceData) return "";

    const format = dtHour12.value ? "hh:mm:ss A" : "HH:mm:ss";
    return renderToHtml(
      InstanceActivityTooltip({
        color: typeof params.color === "string" ? params.color : undefined,
        displayName: instanceData.display_name,
        icon: friendOrFavIcon(instanceData.display_name),
        joinTime: dayjs(instanceData.joinTime).format(format),
        leaveTime: dayjs(instanceData.leaveTime).format(format),
        duration: timeToText(instanceData.time ?? 0, true),
      })
    );
  };

  const format = dtHour12.value ? "hh:mm A" : "HH:mm";

  return {
    tooltip: {
      trigger: "item",
      axisPointer: {
        type: "shadow",
      },
      formatter: (params: echarts.TooltipComponentFormatterCallbackParams) => (Array.isArray(params) ? "" : getTooltip(params)),
    },
    grid: {
      top: 50,
      left: 160,
      right: 90,
    },
    yAxis: {
      type: "category",
      axisLabel: {
        interval: 0,
        formatter: (value: string) => {
          const maxLength = 20;
          const len = value.length;
          return `${friendOrFavIcon(value)} ${len > maxLength ? `${value.substring(0, maxLength)}...` : value}`;
        },
      },
      inverse: true,
      data: uniqueUserEntries.map((item) => item.display_name ?? ""),
      triggerEvent: true,
    },
    xAxis: {
      type: "value",
      min: 0,
      max: endTime - startTime,
      axisLine: { show: true },
      axisLabel: {
        formatter: (value: number) => dayjs(value + startTime).format(format),
      },
      splitLine: { lineStyle: { type: "dashed" } },
    },
    series: generateSeries(),
    backgroundColor: "transparent",
  };
}

defineExpose({
  echartsInstance,
  initEcharts,
});
</script>
