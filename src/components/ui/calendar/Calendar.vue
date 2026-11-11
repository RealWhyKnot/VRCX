<script setup lang="ts">
import type { DateValue } from "reka-ui";
import type { ClassValue } from "clsx";
import type { CalendarRootProps, PrimitiveProps } from "reka-ui";
import { CalendarRoot, useDateFormatter, useForwardPropsEmits } from "reka-ui";
import { createReusableTemplate, reactiveOmit, useVModel } from "@vueuse/core";
import { createYear, createYearRange, toDate } from "reka-ui/date";
import NativeSelect from "@/components/ui/native-select/NativeSelect.vue";
import NativeSelectOption from "@/components/ui/native-select/NativeSelectOption.vue";
import { computed, toRaw } from "vue";
import { CalendarDate, CalendarDateTime, ZonedDateTime, getLocalTimeZone, today } from "@internationalized/date";
import { cn } from "@/lib/utils";

import CalendarCell from "./CalendarCell.vue";
import CalendarCellTrigger from "./CalendarCellTrigger.vue";
import CalendarGrid from "./CalendarGrid.vue";
import CalendarGridBody from "./CalendarGridBody.vue";
import CalendarGridHead from "./CalendarGridHead.vue";
import CalendarGridRow from "./CalendarGridRow.vue";
import CalendarHeadCell from "./CalendarHeadCell.vue";
import CalendarHeader from "./CalendarHeader.vue";
import CalendarHeading from "./CalendarHeading.vue";
import CalendarNextButton from "./CalendarNextButton.vue";
import CalendarPrevButton from "./CalendarPrevButton.vue";

defineOptions({ name: "UiCalendar" });

const props = withDefaults(
  defineProps<{
    defaultValue?: DateValue | undefined;
    defaultPlaceholder?: DateValue | undefined;
    placeholder?: DateValue | undefined;
    pagedNavigation?: boolean;
    preventDeselect?: boolean;
    weekStartsOn?: number | undefined;
    weekdayFormat?: CalendarRootProps["weekdayFormat"] | undefined;
    calendarLabel?: string | undefined;
    fixedWeeks?: boolean;
    maxValue?: DateValue | undefined;
    minValue?: DateValue | undefined;
    locale?: string | undefined;
    numberOfMonths?: number | undefined;
    disabled?: boolean;
    readonly?: boolean;
    initialFocus?: boolean;
    isDateDisabled?: CalendarRootProps["isDateDisabled"] | undefined;
    isDateUnavailable?: CalendarRootProps["isDateUnavailable"] | undefined;
    dir?: CalendarRootProps["dir"] | undefined;
    nextPage?: CalendarRootProps["nextPage"] | undefined;
    prevPage?: CalendarRootProps["prevPage"] | undefined;
    modelValue?: DateValue | DateValue[] | undefined;
    multiple?: boolean;
    disableDaysOutsideCurrentView?: boolean;
    asChild?: boolean;
    as?: PrimitiveProps["as"] | undefined;
    class?: ClassValue | undefined;
    layout?: string | undefined;
    yearRange?: DateValue[] | undefined;
  }>(),
  {
    defaultValue: undefined,
    defaultPlaceholder: undefined,
    placeholder: undefined,
    weekStartsOn: undefined,
    weekdayFormat: undefined,
    calendarLabel: undefined,
    maxValue: undefined,
    minValue: undefined,
    locale: undefined,
    numberOfMonths: undefined,
    isDateDisabled: undefined,
    isDateUnavailable: undefined,
    dir: undefined,
    nextPage: undefined,
    prevPage: undefined,
    modelValue: undefined,
    as: undefined,
    class: undefined,
    layout: undefined,
    yearRange: undefined,
  }
);

const emits = defineEmits<{
  "update:modelValue": [value: DateValue | DateValue[] | undefined];
  "update:placeholder": [value: DateValue];
}>();

const delegatedProps: Record<string, unknown> = reactiveOmit(props, "class", "layout", "placeholder");

const placeholder = useVModel(props, "placeholder", emits, {
  passive: true,
  defaultValue: props.defaultPlaceholder ?? today(getLocalTimeZone()),
});

const formatter = useDateFormatter(props.locale ?? "en");

const yearRange = computed(() => {
  return (
    props.yearRange ??
    createYearRange({
      start: props.minValue ?? (toRaw(props.placeholder) ?? props.defaultPlaceholder ?? today(getLocalTimeZone())).cycle("year", -100),

      end: props.maxValue ?? (toRaw(props.placeholder) ?? props.defaultPlaceholder ?? today(getLocalTimeZone())).cycle("year", 10),
    })
  );
});

const [DefineMonthTemplate, ReuseMonthTemplate] = createReusableTemplate();
const [DefineYearTemplate, ReuseYearTemplate] = createReusableTemplate();

const forwarded = useForwardPropsEmits(delegatedProps, emits);

function isDateValue(value: unknown): value is DateValue {
  return value instanceof CalendarDate || value instanceof CalendarDateTime || value instanceof ZonedDateTime;
}

function placeholderBinding(): { placeholder?: DateValue } {
  const current: unknown = placeholder.value;
  return isDateValue(current) ? { placeholder: current } : {};
}

function selectMonth(event: Event) {
  if (event.target instanceof HTMLSelectElement && placeholder.value) {
    placeholder.value = placeholder.value.set({ month: Number(event.target.value) });
  }
}

function selectYear(event: Event) {
  if (event.target instanceof HTMLSelectElement && placeholder.value) {
    placeholder.value = placeholder.value.set({ year: Number(event.target.value) });
  }
}
</script>

<template>
  <DefineMonthTemplate v-slot="{ date }">
    <div class="**:data-[slot=native-select-icon]:right-1">
      <div class="relative">
        <div class="absolute inset-0 flex h-full items-center text-sm pl-2 pointer-events-none">
          {{ formatter.custom(toDate(date), { month: "short" }) }}
        </div>
        <NativeSelect class="text-xs h-8 pr-6 pl-2 text-transparent relative" @change="selectMonth">
          <NativeSelectOption
            v-for="month in createYear({ dateObj: date })"
            :key="month.toString()"
            :value="month.month"
            :selected="date.month === month.month"
          >
            {{ formatter.custom(toDate(month), { month: "short" }) }}
          </NativeSelectOption>
        </NativeSelect>
      </div>
    </div>
  </DefineMonthTemplate>

  <DefineYearTemplate v-slot="{ date }">
    <div class="**:data-[slot=native-select-icon]:right-1">
      <div class="relative">
        <div class="absolute inset-0 flex h-full items-center text-sm pl-2 pointer-events-none">
          {{ formatter.custom(toDate(date), { year: "numeric" }) }}
        </div>
        <NativeSelect class="text-xs h-8 pr-6 pl-2 text-transparent relative" @change="selectYear">
          <NativeSelectOption v-for="year in yearRange" :key="year.toString()" :value="year.year" :selected="date.year === year.year">
            {{ formatter.custom(toDate(year), { year: "numeric" }) }}
          </NativeSelectOption>
        </NativeSelect>
      </div>
    </div>
  </DefineYearTemplate>

  <CalendarRoot
    v-slot="{ grid, weekDays, date }"
    v-bind="{ ...forwarded, ...placeholderBinding() }"
    data-slot="calendar"
    :class="cn('p-3', props.class)"
    @update:placeholder="placeholder = $event"
  >
    <CalendarHeader class="pt-0">
      <nav class="flex items-center gap-1 absolute top-0 inset-x-0 justify-between">
        <CalendarPrevButton>
          <slot name="calendar-prev-icon" />
        </CalendarPrevButton>
        <CalendarNextButton>
          <slot name="calendar-next-icon" />
        </CalendarNextButton>
      </nav>

      <slot name="calendar-heading" :date="date" :month="ReuseMonthTemplate" :year="ReuseYearTemplate">
        <template v-if="layout === 'month-and-year'">
          <div class="flex items-center justify-center gap-1">
            <ReuseMonthTemplate :date="date" />
            <ReuseYearTemplate :date="date" />
          </div>
        </template>
        <template v-else-if="layout === 'month-only'">
          <div class="flex items-center justify-center gap-1">
            <ReuseMonthTemplate :date="date" />
            {{ formatter.custom(toDate(date), { year: "numeric" }) }}
          </div>
        </template>
        <template v-else-if="layout === 'year-only'">
          <div class="flex items-center justify-center gap-1">
            {{ formatter.custom(toDate(date), { month: "short" }) }}
            <ReuseYearTemplate :date="date" />
          </div>
        </template>
        <template v-else>
          <CalendarHeading />
        </template>
      </slot>
    </CalendarHeader>

    <div class="flex flex-col gap-y-4 mt-4 sm:flex-row sm:gap-x-4 sm:gap-y-0">
      <CalendarGrid v-for="month in grid" :key="month.value.toString()">
        <CalendarGridHead>
          <CalendarGridRow>
            <CalendarHeadCell v-for="day in weekDays" :key="day">
              {{ day }}
            </CalendarHeadCell>
          </CalendarGridRow>
        </CalendarGridHead>
        <CalendarGridBody>
          <CalendarGridRow v-for="(weekDates, index) in month.rows" :key="`weekDate-${index}`" class="mt-2 w-full">
            <CalendarCell v-for="weekDate in weekDates" :key="weekDate.toString()" :date="weekDate">
              <CalendarCellTrigger :day="weekDate" :month="month.value" />
            </CalendarCell>
          </CalendarGridRow>
        </CalendarGridBody>
      </CalendarGrid>
    </div>
  </CalendarRoot>
</template>
