import { computed, ref } from "vue";
import type { Ref } from "vue";

import dayjs from "dayjs";
import type { Dayjs } from "dayjs";

export function useDateNavigation(allDateOfActivity: Ref<Set<string>>, reloadData: () => void) {
  const selectedDate = ref(dayjs().toDate());

  const allDateOfActivityArray = computed(() => {
    return Array.from(allDateOfActivity.value)
      .map((item) => dayjs(item))
      .sort((a, b) => b.valueOf() - a.valueOf());
  });

  const isNextDayBtnDisabled = computed(() => {
    return dayjs(selectedDate.value).isSameOrAfter(allDateOfActivityArray.value[0], "day");
  });

  const isPrevDayBtnDisabled = computed(() => {
    return dayjs(selectedDate.value).isSame(allDateOfActivityArray.value[allDateOfActivityArray.value.length - 1], "day");
  });

  function selectDate(date: Dayjs | undefined): boolean {
    if (!date) {
      return false;
    }
    selectedDate.value = date.toDate();
    reloadData();
    return true;
  }

  function changeSelectedDateFromBtn(isNext = false) {
    const dates = allDateOfActivityArray.value;
    const newestDate = dates[0];
    const oldestDate = dates[dates.length - 1];
    if (!newestDate || !oldestDate) {
      return;
    }

    const idx = dates.findIndex((date) => date.isSame(selectedDate.value, "day"));

    if (idx === -1 && !isNext) {
      const newIdx = dates.findIndex((date) => date.isBefore(selectedDate.value, "day"));
      if (selectDate(dates[newIdx])) {
        return;
      }
    }

    if (idx !== -1) {
      const newIdx = isNext ? idx - 1 : idx + 1;
      if (newIdx >= 0 && newIdx < dates.length && selectDate(dates[newIdx])) {
        return;
      }
    }

    selectDate(isNext ? newestDate : oldestDate);
  }

  function getDatePickerDisabledDate(time: Date) {
    if (time.getTime() > Date.now() || allDateOfActivityArray.value[allDateOfActivityArray.value.length - 1]?.add(-1, "day").isAfter(time, "day")) {
      return true;
    }
    return !allDateOfActivity.value.has(dayjs(time).format("YYYY-MM-DD"));
  }

  return {
    selectedDate,
    isNextDayBtnDisabled,
    isPrevDayBtnDisabled,
    changeSelectedDateFromBtn,
    getDatePickerDisabledDate,
  };
}
