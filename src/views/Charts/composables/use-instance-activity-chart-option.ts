import * as echarts from "echarts";
import dayjs from "dayjs";
import type { Ref } from "vue";
import { renderToHtml } from "@/lib/utils";
import { parseLocation } from "../../../shared/utils/location-parser";
import { timeToText } from "../../../shared/utils/base/format";
import { InstanceActivityTooltip } from "../components/instance-activity-tooltip.tsx";
import type { InstanceActivityEntry } from "../activity-types";
import { findMatchingDetailData, generateYAxisLabel, isDetailDataFiltered } from "./use-chart-helpers";

type InstanceActivityChartOptions = {
  activityData: Ref<InstanceActivityEntry[]>;
  activityDetailData: Ref<InstanceActivityEntry[][]>;
  worldNameArray: Ref<string[]>;
  currentUser: Ref<{ id: string }>;
  selectedDate: Ref<Date>;
  barWidth: Ref<number>;
  dtHour12: Ref<boolean>;
  isDetailVisible: Ref<boolean>;
  isSoloInstanceVisible: Ref<boolean>;
  isNoFriendInstanceVisible: Ref<boolean>;
};

export function useInstanceActivityChartOption({
  activityData,
  activityDetailData,
  worldNameArray,
  currentUser,
  selectedDate,
  barWidth,
  dtHour12,
  isDetailVisible,
  isSoloInstanceVisible,
  isNoFriendInstanceVisible,
}: InstanceActivityChartOptions) {
  function getYAxisData(): string[] {
    return worldNameArray.value.map((worldName, index) => {
      const activityItem = activityData.value[index];
      if (!activityItem) return worldName;

      const detailData = findMatchingDetailData(activityItem, activityDetailData.value, currentUser.value);
      if (!detailData) return worldName;

      const shouldFilter = isDetailVisible.value && isDetailDataFiltered(detailData, isSoloInstanceVisible.value, isNoFriendInstanceVisible.value);

      return generateYAxisLabel(worldName, shouldFilter);
    });
  }

  function getNewOption(): echarts.EChartsOption {
    const getTooltip = (params: echarts.TooltipComponentFormatterCallbackParams) => {
      if (!Array.isArray(params)) {
        return "";
      }
      const param = params[1];
      if (!param) {
        return "";
      }

      const instanceData = activityData.value[param.dataIndex];
      if (!instanceData) {
        return "";
      }
      const format = dtHour12.value ? "hh:mm:ss A" : "HH:mm:ss";

      const location = parseLocation(instanceData.location);

      let name = param.name;

      name = name.endsWith("}") ? name.slice(0, -1) : name;
      name = name.replaceAll("{filtered|", "").replaceAll("{normal|", "");

      return renderToHtml(
        InstanceActivityTooltip({
          color: typeof param.color === "string" ? param.color : undefined,
          displayName: `${name} #${location.instanceName}`,
          icon: location.accessTypeName,
          joinTime: dayjs(instanceData.joinTime).format(format),
          leaveTime: dayjs(instanceData.leaveTime).format(format),
          duration: timeToText(typeof param.data === "number" ? param.data : 0, true),
        })
      );
    };

    const format = dtHour12.value ? "hh:mm A" : "HH:mm";

    const series: echarts.BarSeriesOption[] = [
      {
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
        data: activityData.value.map((item, idx) => {
          if (idx === 0) {
            const midnight = dayjs.tz(selectedDate.value).startOf("day");
            if (midnight.isAfter(item.joinTime)) {
              return 0;
            }
          }
          return item.joinTime.valueOf() - dayjs.tz(selectedDate.value).startOf("day").valueOf();
        }),
      },
      {
        name: "Time",
        type: "bar",
        stack: "Total",
        colorBy: "data",
        barWidth: barWidth.value,
        emphasis: {
          focus: "self",
        },
        itemStyle: {
          borderRadius: 2,
          shadowBlur: 2,
          shadowOffsetX: 0.7,
          shadowOffsetY: 0.5,
        },
        data: activityData.value.map((item, idx) => {
          if (idx === 0) {
            const midnight = dayjs.tz(selectedDate.value).startOf("day");
            if (midnight.isAfter(item.joinTime)) {
              return item.leaveTime.valueOf() - dayjs.tz(midnight).valueOf();
            }
          }
          return item.time;
        }),
      },
    ];
    const echartsOption: echarts.EChartsOption = {
      tooltip: {
        trigger: "axis",
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
          rich: {
            filtered: {
              opacity: 0.4,
            },
            normal: {
              opacity: 1,
            },
          },
        },
        inverse: true,
        data: getYAxisData(),
        triggerEvent: true,
      },
      xAxis: {
        type: "value",
        min: 0,

        max: 24 * 60 * 60 * 1000,

        interval: 3 * 60 * 60 * 1000,
        axisLine: { show: true },
        axisLabel: {
          formatter: (value: number) => dayjs(value).utc().format(format),
        },
        splitLine: { lineStyle: { type: "dashed" } },
      },
      series,
      backgroundColor: "transparent",
    };
    return echartsOption;
  }

  return { getNewOption };
}
