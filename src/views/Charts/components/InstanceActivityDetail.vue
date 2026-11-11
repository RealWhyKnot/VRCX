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

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import DataTableEmpty from "@/components/ui/data-table/DataTableEmpty.vue";
import { storeToRefs } from "pinia";

import dayjs from "dayjs";

import { useAppearanceSettingsStore } from "../../../stores/settings/appearance";
import { useUserStore } from "../../../stores/user";
import { timeToText } from "../../../shared/utils/base/format";

import * as echarts from "echarts";
import { showUserDialog } from "../../../coordinators/user-coordinator";
import { InstanceActivityTooltip } from "./instance-activity-tooltip.jsx";
import { renderToHtml } from "@/lib/utils";

const { isDarkMode, dtHour12 } = storeToRefs(useAppearanceSettingsStore());

const { currentUser } = storeToRefs(useUserStore());

const props = defineProps({
  activityDetailData: {
    type: Array,
    required: true,
  },
  barWidth: {
    type: Number,
    required: true,
    default: 10,
  },
});

const activityDetailChartRef = ref(null);

const isLoading = ref(true);
let echartsInstance = null;
const usersFirstActivity = ref(null);
const resizeObserver = ref(null);
const hasChartData = computed(() => (props.activityDetailData || []).length > 0);

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
  if (echartsInstance.value) {
    echartsInstance.value.dispose();
    echartsInstance.value = null;
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

async function initEcharts() {
  if (!activityDetailChartRef.value || !props.activityDetailData || props.activityDetailData.length === 0) {
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
      if (options?.series && options.series.length > 0) {
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
      echartsInstance = echarts.init(chartDom, `${isDarkMode.value ? "dark" : null}`, {
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

function handleClickYAxisLabel(params) {
  const userData = usersFirstActivity.value[params.dataIndex];
  if (userData?.user_id) {
    showUserDialog(userData.user_id);
  }
}

function getNewOption() {
  if (!props.activityDetailData || props.activityDetailData.length === 0) {
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

  const userGroupedEntries = new Map();

  const uniqueUserEntries = [];
  for (const entry of props.activityDetailData) {
    if (!userGroupedEntries.has(entry.user_id)) {
      userGroupedEntries.set(entry.user_id, []);
      uniqueUserEntries.push(entry);
    }
    const elements = userGroupedEntries.get(entry.user_id);
    const offset = Math.max(
      0,
      elements.length === 0
        ? entry.joinTime.valueOf() - startTimeStamp.value
        : entry.joinTime.valueOf() - startTimeStamp.value - elements[elements.length - 1].tail
    );
    const tail = elements.length === 0 ? offset + entry.time : elements[elements.length - 1].tail + offset + entry.time;
    const element = { offset, time: entry.time, tail, entry };
    elements.push(element);
  }
  usersFirstActivity.value = uniqueUserEntries;

  const generateSeries = () => {
    const maxEntryCount = Math.max(...Array.from(userGroupedEntries.values()).map((entries) => entries.length));
    const placeholderSeries = (data) => {
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
    const timeSeries = (data) => {
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

    const series = Array(maxEntryCount)
      .fill(0)
      .flatMap((_, index) => {
        return [
          placeholderSeries(
            uniqueUserEntries.map((entry) => {
              const element = userGroupedEntries.get(entry.user_id)[index];
              return element ? element.offset : 0;
            })
          ),
          timeSeries(
            uniqueUserEntries.map((entry) => {
              const element = userGroupedEntries.get(entry.user_id)[index];
              return element ? element.time : 0;
            })
          ),
        ];
      });

    return series;
  };

  const friendOrFavIcon = (display_name) => {
    const foundItem = props.activityDetailData.find((item) => item.display_name === display_name);

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

  const getTooltip = (params) => {
    const isTimeSeries = params.seriesIndex % 2 === 1;
    if (!isTimeSeries) return "";

    const userData = uniqueUserEntries[params.dataIndex];
    const targetEntryIndex = Math.floor(params.seriesIndex / 2);

    const instanceData = userGroupedEntries.get(userData?.user_id)?.[targetEntryIndex]?.entry;

    if (!instanceData) return "";

    const format = dtHour12.value ? "hh:mm:ss A" : "HH:mm:ss";
    return renderToHtml(
      InstanceActivityTooltip({
        color: params.color,
        displayName: instanceData.display_name,
        icon: friendOrFavIcon(instanceData.display_name),
        joinTime: dayjs(instanceData.joinTime).format(format),
        leaveTime: dayjs(instanceData.leaveTime).format(format),
        duration: timeToText(instanceData.time, true),
      })
    );
  };

  const format = dtHour12.value ? "hh:mm A" : "HH:mm";

  const echartsOption = {
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
        formatter: (value) => {
          const MAX_LENGTH = 20;
          const len = value.length;
          return `${friendOrFavIcon(value)} ${len > MAX_LENGTH ? `${value.substring(0, MAX_LENGTH)}...` : value}`;
        },
      },
      inverse: true,
      data: uniqueUserEntries.map((item) => item.display_name),
      triggerEvent: true,
    },
    xAxis: {
      type: "value",
      min: 0,
      max: endTimeStamp.value - startTimeStamp.value,
      axisLine: { show: true },
      axisLabel: {
        formatter: (value) => dayjs(value + startTimeStamp.value).format(format),
      },
      splitLine: { lineStyle: { type: "dashed" } },
    },
    series: generateSeries(),
    backgroundColor: "transparent",
  };

  return echartsOption;
}

defineExpose({
  echartsInstance,
  initEcharts,
});
</script>
