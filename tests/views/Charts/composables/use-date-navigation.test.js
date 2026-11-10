import { beforeAll, describe, expect, it, vi } from "vitest";
import { ref } from "vue";

import dayjs from "dayjs";
import isSameOrAfter from "dayjs/plugin/isSameOrAfter";
import timezone from "dayjs/plugin/timezone";
import utc from "dayjs/plugin/utc";

import { useDateNavigation } from "../../../../src/views/Charts/composables/use-date-navigation";

beforeAll(() => {
  dayjs.extend(utc);
  dayjs.extend(timezone);
  dayjs.extend(isSameOrAfter);
  dayjs.tz.setDefault("UTC");
});

function makeDates(...strings) {
  return ref(new Set(strings));
}

function setup(dateStrings, reloadData = vi.fn()) {
  const allDates = makeDates(...dateStrings);
  const result = useDateNavigation(allDates, reloadData);
  return { ...result, reloadData };
}

describe("useDateNavigation", () => {
  describe("changeSelectedDateFromBtn", () => {
    it("navigates to previous date", () => {
      const dates = ["2025-01-03", "2025-01-02", "2025-01-01"];
      const { selectedDate, changeSelectedDateFromBtn, reloadData } = setup(dates);

      selectedDate.value = dayjs("2025-01-03").toDate();

      changeSelectedDateFromBtn(false);
      expect(dayjs(selectedDate.value).format("YYYY-MM-DD")).toBe("2025-01-02");
      expect(reloadData).toHaveBeenCalled();
    });

    it("navigates to next date", () => {
      const dates = ["2025-01-03", "2025-01-02", "2025-01-01"];
      const { selectedDate, changeSelectedDateFromBtn, reloadData } = setup(dates);

      selectedDate.value = dayjs("2025-01-02").toDate();

      changeSelectedDateFromBtn(true);
      expect(dayjs(selectedDate.value).format("YYYY-MM-DD")).toBe("2025-01-03");
      expect(reloadData).toHaveBeenCalled();
    });

    it("does nothing when allDateOfActivity is empty", () => {
      const { selectedDate, changeSelectedDateFromBtn, reloadData } = setup([]);
      const original = selectedDate.value;

      changeSelectedDateFromBtn(false);
      expect(selectedDate.value).toBe(original);
      expect(reloadData).not.toHaveBeenCalled();
    });

    it("finds nearest previous date when current date is not in array", () => {
      const dates = ["2025-01-05", "2025-01-03", "2025-01-01"];
      const { selectedDate, changeSelectedDateFromBtn, reloadData } = setup(dates);

      selectedDate.value = dayjs("2025-01-04").toDate();

      changeSelectedDateFromBtn(false);

      expect(dayjs(selectedDate.value).format("YYYY-MM-DD")).toBe("2025-01-03");
      expect(reloadData).toHaveBeenCalled();
    });

    it("falls back to last date when going prev at boundary", () => {
      const dates = ["2025-01-03", "2025-01-01"];
      const { selectedDate, changeSelectedDateFromBtn } = setup(dates);

      selectedDate.value = dayjs("2025-01-01").toDate();
      changeSelectedDateFromBtn(false);

      expect(dayjs(selectedDate.value).format("YYYY-MM-DD")).toBe("2025-01-01");
    });

    it("falls back to first date when going next at boundary", () => {
      const dates = ["2025-01-03", "2025-01-01"];
      const { selectedDate, changeSelectedDateFromBtn } = setup(dates);

      selectedDate.value = dayjs("2025-01-03").toDate();
      changeSelectedDateFromBtn(true);

      expect(dayjs(selectedDate.value).format("YYYY-MM-DD")).toBe("2025-01-03");
    });
  });

  describe("isNextDayBtnDisabled", () => {
    it("is true when selected date is the latest", () => {
      const dates = ["2025-01-03", "2025-01-02", "2025-01-01"];
      const { selectedDate, isNextDayBtnDisabled } = setup(dates);

      selectedDate.value = dayjs("2025-01-03").toDate();
      expect(isNextDayBtnDisabled.value).toBe(true);
    });

    it("is false when selected date is not the latest", () => {
      const dates = ["2025-01-03", "2025-01-02", "2025-01-01"];
      const { selectedDate, isNextDayBtnDisabled } = setup(dates);

      selectedDate.value = dayjs("2025-01-02").toDate();
      expect(isNextDayBtnDisabled.value).toBe(false);
    });
  });

  describe("isPrevDayBtnDisabled", () => {
    it("is true when selected date is the earliest", () => {
      const dates = ["2025-01-03", "2025-01-02", "2025-01-01"];
      const { selectedDate, isPrevDayBtnDisabled } = setup(dates);

      selectedDate.value = dayjs("2025-01-01").toDate();
      expect(isPrevDayBtnDisabled.value).toBe(true);
    });

    it("is false when selected date is not the earliest", () => {
      const dates = ["2025-01-03", "2025-01-02", "2025-01-01"];
      const { selectedDate, isPrevDayBtnDisabled } = setup(dates);

      selectedDate.value = dayjs("2025-01-02").toDate();
      expect(isPrevDayBtnDisabled.value).toBe(false);
    });
  });

  describe("getDatePickerDisabledDate", () => {
    it("disables future dates", () => {
      const dates = ["2025-01-03", "2025-01-02", "2025-01-01"];
      const { getDatePickerDisabledDate } = setup(dates);

      const futureDate = new Date(Date.now() + 86400000);
      expect(getDatePickerDisabledDate(futureDate)).toBe(true);
    });

    it("disables dates not in the activity set", () => {
      const dates = ["2025-01-03", "2025-01-01"];
      const { getDatePickerDisabledDate } = setup(dates);

      const missingDate = dayjs("2025-01-02").toDate();
      expect(getDatePickerDisabledDate(missingDate)).toBe(true);
    });

    it("enables dates that are in the activity set", () => {
      const dates = ["2025-01-03", "2025-01-02", "2025-01-01"];
      const { getDatePickerDisabledDate } = setup(dates);

      const validDate = dayjs("2025-01-02").toDate();
      expect(getDatePickerDisabledDate(validDate)).toBe(false);
    });
  });
});
