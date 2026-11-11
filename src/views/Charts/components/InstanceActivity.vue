<template>
  <div id="chart" class="x-container">
    <div ref="instanceActivityRef" class="pt-12">
      <BackToTop :target="instanceActivityRef" :right="30" :bottom="30" :teleport="false" />
      <div class="options-container flex items-center justify-between mt-0">
        <div class="flex items-center justify-between">
          <span class="shrink-0">{{ t("view.charts.instance_activity.header") }}</span>
          <HoverCard>
            <HoverCardTrigger as-child>
              <Info class="ml-1 text-xs opacity-70" />
            </HoverCardTrigger>
            <HoverCardContent side="bottom" align="start" class="w-75">
              <div>
                <div class="mb-1.5 text-xs">
                  {{ t("view.charts.instance_activity.tips.online_time") }}
                </div>
                <div class="mb-1.5 text-xs">
                  {{ t("view.charts.instance_activity.tips.click_Y_axis") }}
                </div>
                <div class="mb-1.5 text-xs flex items-center mt-2">
                  {{ t("view.charts.instance_activity.tips.click_instance_name") }}
                </div>
              </div>
            </HoverCardContent>
          </HoverCard>
        </div>

        <div class="flex items-center">
          <TooltipWrapper :content="t('view.charts.instance_activity.refresh')" side="top">
            <Button class="rounded-full mr-1.5" size="icon" variant="ghost" @click="reloadData">
              <RefreshCcw />
            </Button>
          </TooltipWrapper>

          <Popover>
            <PopoverTrigger as-child>
              <div>
                <TooltipWrapper :content="t('view.charts.instance_activity.settings.header')" side="top">
                  <Button class="rounded-full mr-1.5" size="icon" variant="ghost">
                    <Settings />
                  </Button>
                </TooltipWrapper>
              </div>
            </PopoverTrigger>
            <PopoverContent side="bottom" class="w-62.5">
              <div>
                <div class="flex items-center justify-between px-0.5 h-[30px]">
                  <span class="shrink-0">{{ t("view.charts.instance_activity.settings.bar_width") }}</span>
                  <div class="w-40 ml-5">
                    <Slider v-model="barWidthDraftValue" :max="50" :min="1" @value-commit="handleBarWidthCommit"></Slider>
                  </div>
                </div>
                <div class="flex items-center justify-between px-0.5 h-[30px]">
                  <span class="shrink-0">{{ t("view.charts.instance_activity.settings.show_detail") }}</span>
                  <Switch v-model="isDetailVisible" @update:model-value="(value) => changeIsDetailInstanceVisible(value, () => handleSettingsChange())" />
                </div>
                <div v-if="isDetailVisible" class="flex items-center justify-between px-0.5 h-[30px]">
                  <span class="shrink-0">{{ t("view.charts.instance_activity.settings.show_solo_instance") }}</span>
                  <Switch v-model="isSoloInstanceVisible" @update:model-value="(value) => changeIsSoloInstanceVisible(value, () => handleSettingsChange())" />
                </div>
                <div v-if="isDetailVisible" class="flex items-center justify-between px-0.5 h-[30px]">
                  <span class="shrink-0">{{ t("view.charts.instance_activity.settings.show_no_friend_instance") }}</span>
                  <Switch
                    v-model="isNoFriendInstanceVisible"
                    @update:model-value="(value) => changeIsNoFriendInstanceVisible(value, () => handleSettingsChange())"
                  />
                </div>
              </div>
            </PopoverContent>
          </Popover>
          <ButtonGroup class="mr-2">
            <TooltipWrapper :content="t('view.charts.instance_activity.previous_day')" side="top">
              <Button variant="ghost" size="icon-sm" :disabled="isPrevDayBtnDisabled" @click="changeSelectedDateFromBtn(false)">
                <ArrowLeft />
              </Button>
            </TooltipWrapper>
            <TooltipWrapper :content="t('view.charts.instance_activity.next_day')" side="top">
              <Button variant="ghost" size="icon-sm" :disabled="isNextDayBtnDisabled" @click="changeSelectedDateFromBtn(true)">
                <ArrowRight />
              </Button>
            </TooltipWrapper>
          </ButtonGroup>
          <Popover v-model:open="isDatePickerOpen">
            <PopoverTrigger as-child>
              <div>
                <Button variant="outline" class="w-50 justify-start text-left font-normal" :disabled="isLoading">
                  <CalendarIcon class="mr-2 h-4 w-4" />
                  {{ dayjs(selectedDate).format("YYYY-MM-DD") }}
                </Button>
              </div>
            </PopoverTrigger>
            <PopoverContent class="w-auto p-0" align="end">
              <Calendar
                :model-value="calendarModelValue"
                :default-placeholder="defaultCalendarPlaceholder"
                :is-date-disabled="isCalendarDateDisabled"
                :prevent-deselect="true"
                :week-starts-on="weekStartsOn"
                initial-focus
                @update:model-value="handleCalendarModelUpdate"
              />
            </PopoverContent>
          </Popover>
        </div>
      </div>
      <div class="flex justify-center text-center">
        <div class="text-center">
          <div class="text-sm text-muted-foreground">
            {{ t("view.charts.instance_activity.online_time") }}
          </div>
          <div class="text-2xl font-semibold">
            {{ timeToText(totalOnlineTime, true) }}
          </div>
        </div>
      </div>

      <div ref="activityChartRef" class="w-full"></div>
      <div v-if="!isLoading && activityData.length === 0" class="flex items-center justify-center mt-[100px]">
        <DataTableEmpty type="nodata" />
      </div>

      <transition name="el-fade-in-linear">
        <div v-show="isDetailVisible && !isLoading && activityData.length !== 0" class="px-[400px] transition-[top] duration-300 ease-in-out">
          <div class="flex items-center">
            <Separator class="flex-1" />
            <span class="px-2 text-muted-foreground">·</span>
            <Separator class="flex-1" />
          </div>
        </div>
      </transition>
      <template v-if="isDetailVisible && activityData.length !== 0">
        <InstanceActivityDetail
          v-for="arr in filteredActivityDetailData"
          :key="`${arr[0]?.location}${arr[0]?.created_at}`"
          ref="activityDetailChartRef"
          :activity-detail-data="arr"
          :bar-width="barWidth"
        />
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
defineOptions({ name: "ChartsInstance" });

import { computed, nextTick, onBeforeMount, onBeforeUnmount, onMounted, ref, shallowRef, watch } from "vue";
import { ArrowLeft, ArrowRight, Calendar as CalendarIcon, Info, RefreshCcw, Settings } from "lucide-vue-next";
import HoverCard from "@/components/ui/hover-card/HoverCard.vue";
import HoverCardContent from "@/components/ui/hover-card/HoverCardContent.vue";
import HoverCardTrigger from "@/components/ui/hover-card/HoverCardTrigger.vue";
import { fromDate, getLocalTimeZone, today } from "@internationalized/date";
import type { DateValue } from "@internationalized/date";
import Button from "@/components/ui/button/Button.vue";
import ButtonGroup from "@/components/ui/button-group/ButtonGroup.vue";
import Calendar from "@/components/ui/calendar/Calendar.vue";
import DataTableEmpty from "@/components/ui/data-table/DataTableEmpty.vue";
import Separator from "@/components/ui/separator/Separator.vue";
import { storeToRefs } from "pinia";
import { toDate } from "reka-ui/date";
import { useI18n } from "vue-i18n";

import BackToTop from "@/components/BackToTop.vue";
import dayjs from "dayjs";

import Popover from "../../../components/ui/popover/Popover.vue";
import PopoverContent from "../../../components/ui/popover/PopoverContent.vue";
import PopoverTrigger from "../../../components/ui/popover/PopoverTrigger.vue";
import { useAppearanceSettingsStore } from "../../../stores/settings/appearance";
import { useFriendStore } from "../../../stores/friend";
import { useUserStore } from "../../../stores/user";
import { timeToText } from "../../../shared/utils/base/format";
import Slider from "../../../components/ui/slider/Slider.vue";
import Switch from "../../../components/ui/switch/Switch.vue";
import { useActivityDataProcessor } from "../composables/use-activity-data-processor";
import { useInstanceActivityChartOption } from "../composables/use-instance-activity-chart-option";
import { useDateNavigation } from "../composables/use-date-navigation";
import { useInstanceActivityData } from "../composables/use-instance-activity-data";
import { useInstanceActivitySettings } from "../composables/use-instance-activity-settings";
import { useIntersectionObserver } from "../composables/use-intersection-observer";
import type { ActivityDetailChart } from "../activity-types";

import InstanceActivityDetail from "./InstanceActivityDetail.vue";

import * as echarts from "echarts";
import { logFailure } from "@/stores/log-failure";

const appearanceSettingsStore = useAppearanceSettingsStore();
const friendStore = useFriendStore();
const { friends, allFavoriteFriendIds } = storeToRefs(friendStore);
const { currentUser } = storeToRefs(useUserStore());
const { t } = useI18n();
const { isDarkMode, dtHour12, weekStartsOn } = storeToRefs(appearanceSettingsStore);

const instanceActivityRef = ref<HTMLDivElement | null>(null);

const instanceActivityResizeObserver = new ResizeObserver(() => {
  setInstanceActivityHeight();
});

function setInstanceActivityHeight() {
  if (instanceActivityRef.value) {
    const availableHeight = window.innerHeight - 110;
    instanceActivityRef.value.style.height = `${availableHeight}px`;
    instanceActivityRef.value.style.overflowY = "auto";
  }
}

onMounted(() => {
  if (instanceActivityRef.value) {
    instanceActivityResizeObserver.observe(instanceActivityRef.value);
  }
  setInstanceActivityHeight();
});

onBeforeUnmount(() => {
  if (instanceActivityRef.value) {
    instanceActivityResizeObserver.unobserve(instanceActivityRef.value);
  }
});

const {
  barWidth,
  isDetailVisible,
  isSoloInstanceVisible,
  isNoFriendInstanceVisible,
  initializeSettings,
  changeBarWidth,
  changeIsDetailInstanceVisible,
  changeIsSoloInstanceVisible,
  changeIsNoFriendInstanceVisible,
  handleChangeSettings,
} = useInstanceActivitySettings();
const barWidthDraft = ref(barWidth.value);
const barWidthDraftValue = computed({
  get: () => [barWidthDraft.value],
  set: (value: number[] | undefined) => {
    const next = value?.[0];
    if (typeof next === "number") {
      barWidthDraft.value = next;
    }
  },
});

function handleBarWidthCommit(value: number[] | undefined) {
  changeBarWidth(value?.[0] ?? barWidthDraft.value, () => handleEchartsRerender());
}

watch(
  () => barWidth.value,
  (value) => {
    barWidthDraft.value = value;
  }
);

const { activityData, activityDetailData, allDateOfActivity, worldNameArray, getAllDateOfActivity, getWorldNameData, getActivityData } =
  useInstanceActivityData();

let echartsInstance: echarts.EChartsType | null = null;
const resizeObserver = ref<ResizeObserver | null>(null);
const { handleIntersectionObserver } = useIntersectionObserver();
const isLoading = ref(true);

const { selectedDate, isNextDayBtnDisabled, isPrevDayBtnDisabled, changeSelectedDateFromBtn, getDatePickerDisabledDate } = useDateNavigation(
  allDateOfActivity,
  () => {
    void reloadData().catch(logReloadError);
  }
);

const isDatePickerOpen = ref(false);
const calendarTimeZone = getLocalTimeZone();
const defaultCalendarPlaceholder = today(calendarTimeZone);

const calendarModelValue = computed(() => {
  return fromDate(selectedDate.value, calendarTimeZone);
});

function isCalendarDateDisabled(dateValue: DateValue) {
  try {
    return getDatePickerDisabledDate(toDate(dateValue, calendarTimeZone));
  } catch {
    return true;
  }
}

function handleCalendarModelUpdate(dateValue: DateValue | DateValue[] | undefined) {
  if (!dateValue || Array.isArray(dateValue)) return;
  selectedDate.value = toDate(dateValue, calendarTimeZone);
  isDatePickerOpen.value = false;
  void reloadData().catch(logReloadError);
}

const activityChartRef = ref<HTMLDivElement | null>(null);
const activityDetailChartRef = shallowRef<ActivityDetailChart[] | null>(null);

const { totalOnlineTime, filteredActivityDetailData } = useActivityDataProcessor(
  activityData,
  activityDetailData,
  isDetailVisible,
  isSoloInstanceVisible,
  isNoFriendInstanceVisible,
  selectedDate
);

const { getNewOption } = useInstanceActivityChartOption({
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

onBeforeMount(() => {
  void initializeSettings().catch(logFailure("Initializing instance activity settings failed:"));
});

onMounted(async () => {
  try {
    void getAllDateOfActivity().catch(logFailure("Loading activity dates failed:"));
    await getActivityData(selectedDate, currentUser, friends, allFavoriteFriendIds, () => handleIntersectionObserver(activityDetailChartRef));
    await getWorldNameData();
    initEcharts();
  } catch (error) {
    console.error("error in mounted", error);
    isLoading.value = false;
  }
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

async function reloadData() {
  isLoading.value = true;
  try {
    await getActivityData(selectedDate, currentUser, friends, allFavoriteFriendIds, () => handleIntersectionObserver(activityDetailChartRef));
    await getWorldNameData();

    void getAllDateOfActivity().catch(logFailure("Loading activity dates failed:"));

    await nextTick();

    echartsInstance?.off("click");

    if (echartsInstance && activityData.value.length) {
      const chartsHeight = activityData.value.length * (barWidth.value + 10) + 200;
      echartsInstance.resize({
        height: chartsHeight,
        animation: {
          duration: 300,
        },
      });
      echartsInstance.setOption(getNewOption(), { notMerge: true });
      const handleClickYAxisLabel = handleYAxisLabelClick;
      echartsInstance.on("click", "yAxis", handleClickYAxisLabel);
    } else if (echartsInstance) {
      echartsInstance.clear();
    }
  } finally {
    isLoading.value = false;
  }
}

function logReloadError(error: unknown) {
  console.error("Error in reloadData:", error);
}

function handleYAxisLabelClick(params: echarts.ECElementEvent) {
  const targetActivity = activityData.value[params.dataIndex];
  if (!targetActivity) {
    console.error("handleClickYAxisLabel failed, no activity data found for index:", params.dataIndex);
    return;
  }

  const detailDataIdx = filteredActivityDetailData.value.findIndex((arr) => {
    const isSameLocation = arr[0]?.location === targetActivity.location;
    const isSameJoinTime = arr.find((item) => item.user_id === currentUser.value.id)?.joinTime.isSame(targetActivity.joinTime) ?? false;
    return isSameLocation && isSameJoinTime;
  });

  if (detailDataIdx === -1) {
    console.error("handleClickYAxisLabel failed, likely current user wasn't in this instance or chart is filtered out.", params);
    return;
  }

  const detailChart = activityDetailChartRef.value?.[detailDataIdx];
  if (detailChart) {
    detailChart.$el.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  } else {
    console.error("handleClickYAxisLabel failed, chart ref not found at index:", detailDataIdx);
  }
}

function initEcharts() {
  const chartsHeight = activityData.value.length * (barWidth.value + 10) + 200;
  const chartDom = activityChartRef.value;
  if (!chartDom) {
    throw new Error("Instance activity chart element is not mounted");
  }

  const afterInit = () => {
    if (!echartsInstance) {
      console.error("ECharts instance not initialized");
      return;
    }

    echartsInstance.resize({
      height: chartsHeight,
      animation: {
        duration: 300,
      },
    });

    const handleClickYAxisLabel = handleYAxisLabelClick;

    echartsInstance.off("click");

    if (activityData.value.length && worldNameArray.value.length) {
      const options = getNewOption();
      echartsInstance.clear();
      echartsInstance.setOption(options, { notMerge: true });
      echartsInstance.on("click", "yAxis", handleClickYAxisLabel);
    } else {
      echartsInstance.clear();
    }
    isLoading.value = false;
  };

  const initEchartsInstance = () => {
    echartsInstance = echarts.init(chartDom, isDarkMode.value ? "dark" : "null", {
      height: chartsHeight,
    });
    resizeObserver.value = new ResizeObserver((entries) => {
      for (const entry of entries) {
        echartsInstance?.resize({
          width: entry.contentRect.width,
          animation: {
            duration: 300,
          },
        });
      }
    });
    resizeObserver.value.observe(chartDom);
  };

  if (!echartsInstance) {
    initEchartsInstance();
  }
  afterInit();
}

function handleEchartsRerender() {
  initEcharts();
  handleSettingsChange();
}
function handleSettingsChange() {
  handleChangeSettings(activityDetailChartRef);

  if (echartsInstance) {
    const newOptions = getNewOption();
    echartsInstance.setOption({
      yAxis: newOptions.yAxis,
    });
  }

  void nextTick(() => {
    handleIntersectionObserver(activityDetailChartRef);
  }).catch(logFailure("Observing activity detail charts failed:"));
}
</script>
