<template>
  <div ref="chartContainerRef" class="w-full">
    <div v-if="hasChartData" ref="chartRef"></div>
    <div v-else class="flex items-center justify-center min-h-[200px]">
      <DataTableEmpty type="nodata" />
    </div>
  </div>
</template>

<script setup lang="ts">
defineOptions({ name: "PreviousInstancesInfoChart" });

import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import DataTableEmpty from "@/components/ui/data-table/DataTableEmpty.vue";
import { storeToRefs } from "pinia";

import dayjs from "dayjs";

import { useAppearanceSettingsStore } from "../../../stores/settings/appearance";
import { useGameLogStore } from "../../../stores/gameLog";
import { useUserStore } from "../../../stores/user";
import { timeToText } from "../../../shared/utils/base/format";

import * as echarts from "echarts";
import type { BarSeriesOption, EChartsOption, EChartsType, ECElementEvent, TooltipComponentFormatterCallbackParams } from "echarts";
import { showUserDialog } from "../../../coordinators/user-coordinator";
import { logError } from "../../../stores/vrcx-messages";
import { InstanceActivityTooltip } from "@/views/Charts/components/instance-activity-tooltip.tsx";
import { renderToHtml } from "@/lib/utils";

const { isDarkMode, dtHour12 } = storeToRefs(useAppearanceSettingsStore());
const { currentUser } = storeToRefs(useUserStore());
const { gameLogIsFriend, gameLogIsFavorite } = useGameLogStore();

const BAR_WIDTH = 12;

type ChartActivity = {
  created_at: string;
  time: number;
  user_id: string;
  display_name: string;
  userId?: string;
  isFriend?: boolean;
  isFavorite?: boolean;
};

const props = defineProps<{ chartData: ChartActivity[] | null | undefined }>();

const chartRef = ref<HTMLDivElement | null>(null);
let echartsInstance: EChartsType | null = null;
const usersFirstActivity = ref<{ user_id: string }[]>([]);
const resizeObserver = ref<ResizeObserver | null>(null);

const processedData = computed(() => {
  if (!props.chartData || props.chartData.length === 0) return [];
  return props.chartData.map((item) => ({
    ...item,
    joinTime: dayjs(item.created_at).subtract(item.time, "millisecond"),
    leaveTime: dayjs(item.created_at),
    time: item.time < 0 ? 0 : item.time,
    isFriend: item.user_id === currentUser.value.id ? null : gameLogIsFriend(item),
    isFavorite: item.user_id === currentUser.value.id ? null : gameLogIsFavorite(item),
  }));
});

const hasChartData = computed(() => processedData.value.length > 0);

const startTimeStamp = computed(() => {
  if (processedData.value.length === 0) return null;
  let min = Infinity;
  for (const entry of processedData.value) {
    const val = entry.joinTime.valueOf();
    if (val < min) min = val;
  }
  return min;
});

const endTimeStamp = computed(() => {
  if (processedData.value.length === 0) return null;
  let max = -Infinity;
  for (const entry of processedData.value) {
    const val = entry.leaveTime.valueOf();
    if (val > max) max = val;
  }
  return max;
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

watch(
  () => props.chartData,
  () => {
    if (echartsInstance) {
      echartsInstance.dispose();
      echartsInstance = null;
    }
    void nextTick(() => {
      initEcharts();
    }).catch(logError);
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
  if (echartsInstance) {
    echartsInstance.dispose();
    echartsInstance = null;
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
  const data = processedData.value;
  if (!chartRef.value || data.length === 0) {
    return;
  }

  const uniqueUsers = new Map();
  for (const entry of data) {
    if (!uniqueUsers.has(entry.user_id)) {
      uniqueUsers.set(entry.user_id, entry);
    }
  }

  const chartsHeight = uniqueUsers.size * (BAR_WIDTH + 10) + 200;
  const chartDom = chartRef.value;

  const afterInit = () => {
    if (!echartsInstance) {
      console.error("ECharts instance not initialized");
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
      if (Array.isArray(options.series) && options.series.length > 0) {
        echartsInstance.clear();
        echartsInstance.setOption(options, { notMerge: true });
        echartsInstance.on("click", "yAxis", handleClickYAxisLabel);
      } else {
        echartsInstance.clear();
      }
    } catch (error) {
      console.error("Error in afterInit:", error);
    }
  };

  if (!echartsInstance) {
    echartsInstance = echarts.init(chartDom, isDarkMode.value ? "dark" : undefined, {
      height: chartsHeight,
      useDirtyRect: data.length > 80,
    });
    if (resizeObserver.value) {
      resizeObserver.value.observe(chartDom);
    }
  }

  setTimeout(afterInit, 50);
}

function handleClickYAxisLabel(params: ECElementEvent) {
  const userData = usersFirstActivity.value[params.dataIndex];
  if (userData?.user_id) {
    showUserDialog(userData.user_id);
  }
}

function getNewOption(): EChartsOption {
  const data = processedData.value;
  if (data.length === 0) {
    return {
      title: {
        text: "No data",
        left: "center",
        top: "middle",
      },
    };
  }

  const startTimestamp = startTimeStamp.value;
  const endTimestamp = endTimeStamp.value;
  if (!startTimestamp || !endTimestamp) {
    return {
      title: {
        text: "Invalid timestamp data",
        left: "center",
        top: "middle",
      },
    };
  }

  type ProcessedActivity = (typeof data)[number];
  type ActivitySegment = { offset: number; time: number; tail: number; entry: ProcessedActivity };
  const userGroupedEntries = new Map<string, ActivitySegment[]>();
  const uniqueUserEntries: ProcessedActivity[] = [];

  const sortedData = [...data].sort((a, b) => {
    const timeDiff = Math.abs(a.joinTime.diff(b.joinTime, "second"));
    return timeDiff < 3 ? a.leaveTime.valueOf() - b.leaveTime.valueOf() : a.joinTime.valueOf() - b.joinTime.valueOf();
  });

  for (const entry of sortedData) {
    let elements = userGroupedEntries.get(entry.user_id);
    if (!elements) {
      elements = [];
      userGroupedEntries.set(entry.user_id, elements);
      uniqueUserEntries.push(entry);
    }
    const previousTail = elements.at(-1)?.tail ?? 0;
    const offset = Math.max(0, entry.joinTime.valueOf() - startTimestamp - previousTail);
    const tail = previousTail + offset + entry.time;
    const element = { offset, time: entry.time, tail, entry };
    elements.push(element);
  }
  usersFirstActivity.value = uniqueUserEntries;

  const generateSeries = () => {
    const maxEntryCount = Math.max(...Array.from(userGroupedEntries.values()).map((entries) => entries.length));
    const placeholderSeries = (seriesData: number[]): BarSeriesOption => {
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
        data: seriesData,
      };
    };
    const timeSeries = (seriesData: number[]): BarSeriesOption => {
      return {
        name: "Time",
        type: "bar",
        stack: "Total",
        colorBy: "data",
        barWidth: BAR_WIDTH,
        emphasis: {
          focus: "self",
        },
        itemStyle: {
          borderRadius: 2,
          shadowBlur: 2,
          shadowOffsetX: 0.7,
          shadowOffsetY: 0.5,
        },
        data: seriesData,
      };
    };

    const series = Array.from({ length: maxEntryCount }, (_, index) => {
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
    }).flat();

    return series;
  };

  const friendOrFavIcon = (displayName: string) => {
    const foundItem = data.find((item) => item.display_name === displayName);

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

  const getTooltip = (params: TooltipComponentFormatterCallbackParams) => {
    if (Array.isArray(params)) return "";
    const seriesIndex = params.seriesIndex;
    if (seriesIndex === undefined || seriesIndex % 2 !== 1) return "";

    const userData = uniqueUserEntries[params.dataIndex];
    const targetEntryIndex = Math.floor(seriesIndex / 2);
    const instanceData = userData && userGroupedEntries.get(userData.user_id)?.[targetEntryIndex]?.entry;

    if (!instanceData) return "";

    const format = dtHour12.value ? "hh:mm:ss A" : "HH:mm:ss";

    return renderToHtml(
      InstanceActivityTooltip({
        color: typeof params.color === "string" ? params.color : undefined,
        displayName: instanceData.display_name,
        icon: friendOrFavIcon(instanceData.display_name),
        joinTime: dayjs(instanceData.joinTime).format(format),
        leaveTime: dayjs(instanceData.leaveTime).format(format),
        duration: timeToText(instanceData.time, true),
      }),
      undefined
    );
  };

  const format = dtHour12.value ? "hh:mm A" : "HH:mm";

  const echartsOption: EChartsOption = {
    tooltip: {
      trigger: "item",
      axisPointer: {
        type: "shadow",
      },
      formatter: getTooltip,
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
      data: uniqueUserEntries.map((item) => item.display_name),
      triggerEvent: true,
    },
    xAxis: {
      type: "value",
      min: 0,
      max: endTimestamp - startTimestamp,
      axisLine: { show: true },
      axisLabel: {
        formatter: (value: number | string) =>
          dayjs(typeof value === "string" ? value + String(startTimeStamp.value) : value + Number(startTimeStamp.value)).format(format),
      },
      splitLine: { lineStyle: { type: "dashed" } },
    },
    series: generateSeries(),
    backgroundColor: "transparent",
  };

  return echartsOption;
}
</script>
