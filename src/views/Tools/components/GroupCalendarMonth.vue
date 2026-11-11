<script setup lang="ts">
import CalendarCell from "@/components/ui/calendar/CalendarCell.vue";
import CalendarCellTrigger from "@/components/ui/calendar/CalendarCellTrigger.vue";
import CalendarGrid from "@/components/ui/calendar/CalendarGrid.vue";
import CalendarGridBody from "@/components/ui/calendar/CalendarGridBody.vue";
import CalendarGridHead from "@/components/ui/calendar/CalendarGridHead.vue";
import CalendarGridRow from "@/components/ui/calendar/CalendarGridRow.vue";
import CalendarHeadCell from "@/components/ui/calendar/CalendarHeadCell.vue";
import CalendarHeader from "@/components/ui/calendar/CalendarHeader.vue";
import CalendarHeading from "@/components/ui/calendar/CalendarHeading.vue";
import CalendarNextButton from "@/components/ui/calendar/CalendarNextButton.vue";
import CalendarPrevButton from "@/components/ui/calendar/CalendarPrevButton.vue";
import { computed, shallowRef, watch } from "vue";
import { fromDate, getLocalTimeZone } from "@internationalized/date";
import { CalendarRoot } from "reka-ui";
import { toDate, type DateValue, type WeekStartsOn } from "reka-ui/date";
import { storeToRefs } from "pinia";

import dayjs from "dayjs";

import { useAppearanceSettingsStore } from "../../../stores/settings/appearance";

const props = withDefaults(
  defineProps<{
    modelValue: Date;
    isLoading?: boolean | undefined;
    eventsByDate?: Map<string, readonly unknown[]> | undefined;
    followingByDate?: Map<string, readonly unknown[]> | undefined;
  }>(),
  {
    isLoading: false,
    eventsByDate: () => new Map(),
    followingByDate: () => new Map(),
  }
);

const emit = defineEmits<{
  "update:modelValue": [value: Date];
}>();

const { weekStartsOn } = storeToRefs(useAppearanceSettingsStore());
const timeZone = getLocalTimeZone();

function isWeekStartsOn(value: number): value is WeekStartsOn {
  return Number.isInteger(value) && value >= 0 && value <= 6;
}

const weekStartsOnDay = computed<WeekStartsOn>(() => (isWeekStartsOn(weekStartsOn.value) ? weekStartsOn.value : 1));

const internalValue = shallowRef<DateValue>(fromDate(props.modelValue, timeZone));
const placeholder = shallowRef<DateValue>(fromDate(props.modelValue, timeZone));

watch(
  () => props.modelValue,
  (next: Date | undefined) => {
    if (!next) return;
    internalValue.value = fromDate(next, timeZone);
    placeholder.value = fromDate(next, timeZone);
  }
);

const selectedDayKey = computed(() => dayjs(props.modelValue).format("YYYY-MM-DD"));

function toKey(dateValue: DateValue) {
  return dayjs(toDate(dateValue, timeZone)).format("YYYY-MM-DD");
}

function eventCountFor(dateValue: DateValue) {
  const key = toKey(dateValue);
  return props.eventsByDate.get(key)?.length ?? 0;
}

function hasFollowingFor(dateValue: DateValue) {
  const key = toKey(dateValue);
  return props.followingByDate.has(key);
}

function onUpdateModelValue(next: DateValue | undefined) {
  if (!next) return;
  internalValue.value = next;
  const asDate = toDate(next, timeZone);
  placeholder.value = next;
  emit("update:modelValue", asDate);
}

function onUpdatePlaceholder(next: DateValue | undefined) {
  if (!next) return;
  placeholder.value = next;
  internalValue.value = next;
  emit("update:modelValue", toDate(next, timeZone));
}

function dayLabel(dateValue: DateValue) {
  return dayjs(toDate(dateValue, timeZone)).format("D");
}
</script>

<template>
  <div class="group-calendar-month">
    <CalendarRoot
      v-slot="{ grid, weekDays }"
      :model-value="internalValue"
      :placeholder="placeholder"
      :prevent-deselect="true"
      :week-starts-on="weekStartsOnDay"
      class="p-4"
      @update:model-value="onUpdateModelValue"
      @update:placeholder="onUpdatePlaceholder"
    >
      <CalendarHeader class="pt-0">
        <nav class="flex items-center gap-1 absolute top-0 inset-x-0 justify-between">
          <CalendarPrevButton class="size-9" />
          <CalendarNextButton class="size-9" />
        </nav>
        <div class="flex items-center justify-center">
          <CalendarHeading class="text-base" />
        </div>
      </CalendarHeader>

      <div class="flex flex-col gap-y-4 mt-6">
        <CalendarGrid v-for="month in grid" :key="month.value.toString()" class="w-full">
          <CalendarGridHead>
            <CalendarGridRow>
              <CalendarHeadCell v-for="day in weekDays" :key="day" class="text-sm">
                {{ day }}
              </CalendarHeadCell>
            </CalendarGridRow>
          </CalendarGridHead>
          <CalendarGridBody>
            <CalendarGridRow v-for="(weekDates, index) in month.rows" :key="`weekDate-${index}`" class="mt-2 w-full">
              <CalendarCell v-for="weekDate in weekDates" :key="weekDate.toString()" :date="weekDate">
                <CalendarCellTrigger :day="weekDate" :month="month.value" class="size-12 cursor-pointer">
                  <div class="date">
                    <div
                      class="calendar-date-content"
                      :class="{
                        'has-events': eventCountFor(weekDate) > 0,
                        'is-selected': toKey(weekDate) === selectedDayKey,
                      }"
                    >
                      {{ dayLabel(weekDate) }}
                      <div
                        v-if="eventCountFor(weekDate) > 0"
                        class="calendar-event-badge bg-foreground text-accent"
                        :class="hasFollowingFor(weekDate) ? 'has-following' : 'no-following'"
                      >
                        {{ eventCountFor(weekDate) }}
                      </div>
                    </div>
                  </div>
                </CalendarCellTrigger>
              </CalendarCell>
            </CalendarGridRow>
          </CalendarGridBody>
        </CalendarGrid>
      </div>
    </CalendarRoot>
  </div>
</template>

<style scoped>
.group-calendar-month {
  height: 100%;
  width: 100%;
  display: flex;
  align-items: flex-start;
  padding: 0 12px;
}

.date {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.calendar-date-content {
  width: 80%;
  height: 80%;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-lg);
  font-size: 1.125rem;
  position: relative;
}

.calendar-event-badge {
  position: absolute;
  top: -4px;
  right: -4px;
  min-width: 14px;
  height: 16px;
  border-radius: var(--radius-lg);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.75rem;
  z-index: var(--layer-calendar-badge);
  padding: 0 6px;
  line-height: calc(14 / 12);
}
</style>
