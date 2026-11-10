import { computed } from "vue";

export function useGroupCalendarEvents(groupDialog) {
  const pastCalenderEvents = computed(() => {
    if (!groupDialog.value.calendar) {
      return [];
    }
    const now = Date.now();
    const series = new Set();
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
    const series = new Set();
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

  function updateFollowingCalendarData(event) {
    const calendar = groupDialog.value.calendar;
    for (let i = 0; i < calendar.length; i++) {
      if (calendar[i].id === event.id) {
        calendar[i] = {
          ...calendar[i],
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
