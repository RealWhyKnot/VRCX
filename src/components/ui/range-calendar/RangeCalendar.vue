<script setup lang="ts">
import type { PrimitiveProps, RangeCalendarRootEmits, RangeCalendarRootProps } from "reka-ui";
import { RangeCalendarRoot, useForwardPropsEmits } from "reka-ui";
import type { ClassValue } from "clsx";
import { cn } from "@/lib/utils";
import { computed } from "vue";

import RangeCalendarCell from "./RangeCalendarCell.vue";
import RangeCalendarCellTrigger from "./RangeCalendarCellTrigger.vue";
import RangeCalendarGrid from "./RangeCalendarGrid.vue";
import RangeCalendarGridBody from "./RangeCalendarGridBody.vue";
import RangeCalendarGridHead from "./RangeCalendarGridHead.vue";
import RangeCalendarGridRow from "./RangeCalendarGridRow.vue";
import RangeCalendarHeadCell from "./RangeCalendarHeadCell.vue";
import RangeCalendarHeader from "./RangeCalendarHeader.vue";
import RangeCalendarHeading from "./RangeCalendarHeading.vue";
import RangeCalendarNextButton from "./RangeCalendarNextButton.vue";
import RangeCalendarPrevButton from "./RangeCalendarPrevButton.vue";

const props = defineProps<{
  defaultPlaceholder?: RangeCalendarRootProps["defaultPlaceholder"] | undefined;
  defaultValue?: RangeCalendarRootProps["defaultValue"] | undefined;
  modelValue?: RangeCalendarRootProps["modelValue"] | undefined;
  placeholder?: RangeCalendarRootProps["placeholder"] | undefined;
  allowNonContiguousRanges?: boolean;
  pagedNavigation?: boolean;
  preventDeselect?: boolean;
  maximumDays?: number | undefined;
  weekStartsOn?: RangeCalendarRootProps["weekStartsOn"] | undefined;
  weekdayFormat?: RangeCalendarRootProps["weekdayFormat"] | undefined;
  calendarLabel?: string | undefined;
  fixedWeeks?: boolean;
  maxValue?: RangeCalendarRootProps["maxValue"] | undefined;
  minValue?: RangeCalendarRootProps["minValue"] | undefined;
  locale?: string | undefined;
  numberOfMonths?: number | undefined;
  disabled?: boolean;
  readonly?: boolean;
  initialFocus?: boolean;
  isDateDisabled?: RangeCalendarRootProps["isDateDisabled"] | undefined;
  isDateUnavailable?: RangeCalendarRootProps["isDateUnavailable"] | undefined;
  isDateHighlightable?: RangeCalendarRootProps["isDateHighlightable"] | undefined;
  dir?: RangeCalendarRootProps["dir"] | undefined;
  nextPage?: RangeCalendarRootProps["nextPage"] | undefined;
  prevPage?: RangeCalendarRootProps["prevPage"] | undefined;
  disableDaysOutsideCurrentView?: boolean;
  fixedDate?: RangeCalendarRootProps["fixedDate"] | undefined;
  asChild?: boolean;
  as?: PrimitiveProps["as"] | undefined;
  class?: ClassValue | undefined;
}>();

const emits = defineEmits<RangeCalendarRootEmits>();

const delegatedProps = computed(() => ({
  ...(props.defaultPlaceholder === undefined ? {} : { defaultPlaceholder: props.defaultPlaceholder }),
  ...(props.defaultValue === undefined ? {} : { defaultValue: props.defaultValue }),
  ...(props.modelValue === undefined ? {} : { modelValue: props.modelValue }),
  ...(props.placeholder === undefined ? {} : { placeholder: props.placeholder }),
  allowNonContiguousRanges: props.allowNonContiguousRanges,
  pagedNavigation: props.pagedNavigation,
  preventDeselect: props.preventDeselect,
  ...(props.maximumDays === undefined ? {} : { maximumDays: props.maximumDays }),
  ...(props.weekStartsOn === undefined ? {} : { weekStartsOn: props.weekStartsOn }),
  ...(props.weekdayFormat === undefined ? {} : { weekdayFormat: props.weekdayFormat }),
  ...(props.calendarLabel === undefined ? {} : { calendarLabel: props.calendarLabel }),
  fixedWeeks: props.fixedWeeks,
  ...(props.maxValue === undefined ? {} : { maxValue: props.maxValue }),
  ...(props.minValue === undefined ? {} : { minValue: props.minValue }),
  ...(props.locale === undefined ? {} : { locale: props.locale }),
  ...(props.numberOfMonths === undefined ? {} : { numberOfMonths: props.numberOfMonths }),
  disabled: props.disabled,
  readonly: props.readonly,
  initialFocus: props.initialFocus,
  ...(props.isDateDisabled === undefined ? {} : { isDateDisabled: props.isDateDisabled }),
  ...(props.isDateUnavailable === undefined ? {} : { isDateUnavailable: props.isDateUnavailable }),
  ...(props.isDateHighlightable === undefined ? {} : { isDateHighlightable: props.isDateHighlightable }),
  ...(props.dir === undefined ? {} : { dir: props.dir }),
  ...(props.nextPage === undefined ? {} : { nextPage: props.nextPage }),
  ...(props.prevPage === undefined ? {} : { prevPage: props.prevPage }),
  disableDaysOutsideCurrentView: props.disableDaysOutsideCurrentView,
  ...(props.fixedDate === undefined ? {} : { fixedDate: props.fixedDate }),
  asChild: props.asChild,
  ...(props.as === undefined ? {} : { as: props.as }),
}));

const forwarded = useForwardPropsEmits(delegatedProps, emits);
</script>

<template>
  <RangeCalendarRoot v-slot="{ grid, weekDays }" data-slot="range-calendar" :class="cn('p-3', props.class)" v-bind="forwarded">
    <RangeCalendarHeader>
      <RangeCalendarHeading />

      <div class="flex items-center gap-1">
        <RangeCalendarPrevButton />
        <RangeCalendarNextButton />
      </div>
    </RangeCalendarHeader>

    <div class="flex flex-col gap-y-4 mt-4 sm:flex-row sm:gap-x-4 sm:gap-y-0">
      <RangeCalendarGrid v-for="month in grid" :key="month.value.toString()">
        <RangeCalendarGridHead>
          <RangeCalendarGridRow>
            <RangeCalendarHeadCell v-for="day in weekDays" :key="day">
              {{ day }}
            </RangeCalendarHeadCell>
          </RangeCalendarGridRow>
        </RangeCalendarGridHead>
        <RangeCalendarGridBody>
          <RangeCalendarGridRow v-for="(weekDates, index) in month.rows" :key="`weekDate-${index}`" class="mt-2 w-full">
            <RangeCalendarCell v-for="weekDate in weekDates" :key="weekDate.toString()" :date="weekDate">
              <RangeCalendarCellTrigger :day="weekDate" :month="month.value" />
            </RangeCalendarCell>
          </RangeCalendarGridRow>
        </RangeCalendarGridBody>
      </RangeCalendarGrid>
    </div>
  </RangeCalendarRoot>
</template>
