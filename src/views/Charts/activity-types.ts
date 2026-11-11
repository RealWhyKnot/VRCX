import type { Dayjs } from "dayjs";
import type { EChartsType } from "echarts";

export type InstanceActivityRow = {
  id: number | null;
  created_at: string | null;
  type: string | null;
  display_name: string | null;
  location: string;
  user_id: string | null;
  time: number | null;
};

export type InstanceActivityEntry = InstanceActivityRow & {
  joinTime: Dayjs;
  leaveTime: Dayjs;
  isFriend: boolean | null;
  isFavorite: boolean | null;
};

export type ActivityDetailChart = {
  $el: Element;
  echartsInstance: EChartsType | null;
  initEcharts: () => void;
};
