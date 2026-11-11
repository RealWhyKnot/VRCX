import { computed, type Ref } from "vue";
import type { GroupDialogState } from "../../../stores/group-types";

type CalendarEvent = GroupDialogState["calendar"][number];

type CalendarSource = {
  calendar?: GroupDialogState["calendar"] | null | undefined;
};

export function useGroupCalendarEvents(groupDialog: Ref<CalendarSource>) {
  const pastCalenderEvents = computed(() => {
    if (!groupDialog.value.calendar) {
      return [];
    }
    const now = Date.now();
    const series = new Set<string>();
    const sortedEvents = [...groupDialog.value.calendar].sort((a, b) => a.startsAt.localeCompare(b.startsAt));
    return sortedEvents
      .filter((event) => {
        const eventEnd = new Date(event.endsAt).getTime();
        if (event.seriesId) {
          if (series.has(event.seriesId)) {
            return false;
          }
          if (eventEnd < now) {
            series.add(event.seriesId);
          }
        }
        return eventEnd < now;
      })
      .reverse();
  });

  const upcomingCalenderEvents = computed(() => {
    if (!groupDialog.value.calendar) {
      return [];
    }
    const now = Date.now();
    const series = new Set<string>();
    const sortedEvents = [...groupDialog.value.calendar].sort((a, b) => a.startsAt.localeCompare(b.startsAt));
    return sortedEvents
      .filter((event) => {
        const eventEnd = new Date(event.endsAt).getTime();
        if (event.seriesId) {
          if (series.has(event.seriesId)) {
            return false;
          }
          if (eventEnd >= now) {
            series.add(event.seriesId);
          }
        }
        return eventEnd >= now;
      })
      .reverse();
  });

  function updateFollowingCalendarData(event: Partial<CalendarEvent> & Pick<CalendarEvent, "id">) {
    const calendar = groupDialog.value.calendar;
    if (!calendar) {
      return;
    }
    for (const [i, item] of calendar.entries()) {
      if (item.id === event.id) {
        calendar[i] = {
          ...item,
          ...event,
        };
        break;
      }
    }
  }

  return {
    pastCalenderEvents,
    upcomingCalenderEvents,
    updateFollowingCalendarData,
  };
}
