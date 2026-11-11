import { computed } from "vue";
import type { Ref } from "vue";
import type { AcceptableValue } from "reka-ui";
import type { GroupEventEditDialogState } from "../../../stores/group-types";
import { isFrequency, isWeekDay } from "./group-event-edit-values";
import type { CalendarDayOfWeek } from "./group-event-edit-values";

type GroupEventRecurrenceDeps = {
  t: (key: string) => string;
  groupEventEditDialog: Ref<GroupEventEditDialogState>;
  canReturnToNever: Readonly<Ref<boolean>>;
};

const weekdayDays: CalendarDayOfWeek[] = ["MO", "TU", "WE", "TH", "FR"];
const weekendDays: CalendarDayOfWeek[] = ["SA", "SU"];

export function useGroupEventRecurrence({ t, groupEventEditDialog, canReturnToNever }: GroupEventRecurrenceDeps) {
  const repeatFrequencySelection = computed(() => groupEventEditDialog.value.recurrence?.frequency ?? "none");
  const recurrenceEndType = computed({
    get: () => groupEventEditDialog.value.recurrence?.end?.type ?? "never",
    set: (value: AcceptableValue) => {
      const recurrence = groupEventEditDialog.value.recurrence;
      if (!recurrence) {
        return;
      }
      if (value === "never") {
        delete recurrence.end;
      } else if (value === "afterOccurrences") {
        const count = recurrence.end?.type === value ? recurrence.end.count : undefined;
        recurrence.end = {
          type: value,
          count: count ?? 1,
        };
      } else if (value === "afterDate") {
        const date = recurrence.end?.type === value ? recurrence.end.date : undefined;
        recurrence.end = {
          type: value,
          date: date ?? "",
        };
      }
    },
  });
  const recurrenceEndCount = computed({
    get: () => groupEventEditDialog.value.recurrence?.end?.count ?? "",
    set: (value: string | number) => {
      const end = groupEventEditDialog.value.recurrence?.end;
      if (!end) {
        return;
      }
      if (value === "") {
        delete end.count;
      } else {
        end.count = Number(value);
      }
    },
  });
  const recurrenceEndDate = computed({
    get: () => groupEventEditDialog.value.recurrence?.end?.date ?? "",
    set: (value: string) => {
      const end = groupEventEditDialog.value.recurrence?.end;
      if (end) {
        end.date = value;
      }
    },
  });
  const weekDayOptions = [
    { value: "MO", label: t("dialog.group_event_edit.weekday_values.MO") },
    { value: "TU", label: t("dialog.group_event_edit.weekday_values.TU") },
    { value: "WE", label: t("dialog.group_event_edit.weekday_values.WE") },
    { value: "TH", label: t("dialog.group_event_edit.weekday_values.TH") },
    { value: "FR", label: t("dialog.group_event_edit.weekday_values.FR") },
    { value: "SA", label: t("dialog.group_event_edit.weekday_values.SA") },
    { value: "SU", label: t("dialog.group_event_edit.weekday_values.SU") },
  ];
  const weeklyPatternSelection = computed(() => {
    const days = groupEventEditDialog.value.recurrence?.daysOfWeek ?? [];
    if (days.length === 5 && weekdayDays.every((day) => days.includes(day))) {
      return "weekdays";
    }
    if (days.length === 2 && weekendDays.every((day) => days.includes(day))) {
      return "weekend";
    }
    if (days.length > 0) {
      return "custom";
    }
    return "everyWeek";
  });
  const selectedCustomDaysSummary = computed(() =>
    (groupEventEditDialog.value.recurrence?.daysOfWeek ?? []).map((day) => weekDayOptions.find((option) => option.value === day)?.label ?? day).join(", ")
  );

  function handleRepeatFrequencyChange(value: AcceptableValue) {
    if (value === "none") {
      if (!canReturnToNever.value) {
        return;
      }
      groupEventEditDialog.value.recurrence = null;
      return;
    }
    if (!isFrequency(value)) {
      return;
    }
    groupEventEditDialog.value.recurrence ??= {
      interval: 1,
      frequency: value,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    };
    const recurrence = groupEventEditDialog.value.recurrence;
    recurrence.frequency = value;
    if (value !== "weekly") {
      recurrence.daysOfWeek = [];
    }
  }

  function handleWeeklyPatternChange(value: AcceptableValue) {
    const recurrence = groupEventEditDialog.value.recurrence;
    if (!recurrence) {
      return;
    }
    if (value === "weekdays") {
      recurrence.daysOfWeek = ["MO", "TU", "WE", "TH", "FR"];
      return;
    }
    if (value === "weekend") {
      recurrence.daysOfWeek = ["SA", "SU"];
      return;
    }
    if (value === "custom") {
      recurrence.daysOfWeek = ["SA"];
      return;
    }
    recurrence.daysOfWeek = [];
  }

  function handleCustomDaysChange(value: AcceptableValue | AcceptableValue[]) {
    const recurrence = groupEventEditDialog.value.recurrence;
    if (!recurrence) {
      return;
    }
    const days: CalendarDayOfWeek[] = [];
    if (Array.isArray(value)) {
      for (const day of value) {
        if (isWeekDay(day)) {
          days.push(day);
        }
      }
    }
    recurrence.daysOfWeek = days;
  }

  return {
    repeatFrequencySelection,
    recurrenceEndType,
    recurrenceEndCount,
    recurrenceEndDate,
    weekDayOptions,
    weeklyPatternSelection,
    selectedCustomDaysSummary,
    handleRepeatFrequencyChange,
    handleWeeklyPatternChange,
    handleCustomDaysChange,
  };
}
