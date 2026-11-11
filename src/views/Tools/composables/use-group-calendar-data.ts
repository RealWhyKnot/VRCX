import { ref, type Ref } from "vue";
import dayjs from "dayjs";
import type { CalendarEvent } from "vrchat";
import type { Json, VrcxGroup } from "../../../types/vrcx";
import { groupRequest } from "../../../api/group";
import { queryRequest } from "../../../api/query-request";
import { processBulk } from "../../../services/request";
import { useGroupStore } from "../../../stores/group";
import { logError } from "../../../stores/vrcx-messages";
import { replaceBioSymbols } from "../../../shared/utils/base/string";

export type CalendarEventEntry = Json<CalendarEvent>;

type CalendarPage = Awaited<ReturnType<typeof groupRequest.getGroupCalendars>>;

export function ownerIdOf(event: CalendarEventEntry): string {
  return event.ownerId ?? "";
}

export function useGroupCalendarData(selectedDay: Ref<Date>, showFeaturedEvents: Ref<boolean>) {
  const { applyGroupEvent } = useGroupStore();

  const calendar = ref<CalendarEventEntry[]>([]);
  const followingCalendar = ref<CalendarEventEntry[]>([]);
  const featuredCalendar = ref<CalendarEventEntry[]>([]);
  const isLoading = ref(false);
  const groupNamesCache = new Map<string, string>();
  const groupRefsCache = new Map<string, VrcxGroup>();

  async function updateCalenderData() {
    isLoading.value = true;
    const fetchPromises: Promise<void>[] = [getCalendarData(), getFollowingCalendarData()];
    if (showFeaturedEvents.value) {
      fetchPromises.push(getFeaturedCalendarData());
    }
    await Promise.all(fetchPromises)
      .catch((error: unknown) => {
        console.error("Error fetching calendar data:", error);
      })
      .finally(() => {
        isLoading.value = false;
      });
  }

  async function getGroupNameFromCache(groupId: string) {
    if (!groupNamesCache.has(groupId)) {
      try {
        const args = await queryRequest.fetch("group.dialog", { groupId, includeRoles: true });
        groupNamesCache.set(groupId, args.ref.name ?? "");
        groupRefsCache.set(groupId, args.ref);
      } catch (error) {
        console.error("Failed to load calendar event group:", error);
        groupNamesCache.set(groupId, "");
      }
    }
  }

  async function appendCalendarPage(args: CalendarPage) {
    const results = args.results ?? [];
    for (const event of results) {
      event.title = replaceBioSymbols(event.title);
      event.description = replaceBioSymbols(event.description);
      applyGroupEvent(event);
      await getGroupNameFromCache(ownerIdOf(event));
    }
    calendar.value.push(...results);
  }

  async function appendFollowingCalendarPage(args: CalendarPage) {
    const results = args.results ?? [];
    for (const event of results) {
      applyGroupEvent(event);
      await getGroupNameFromCache(ownerIdOf(event));
    }
    followingCalendar.value.push(...results);
  }

  async function appendFeaturedCalendarPage(args: CalendarPage) {
    const results = args.results ?? [];
    for (const event of results) {
      applyGroupEvent(event);
      await getGroupNameFromCache(ownerIdOf(event));
    }
    featuredCalendar.value.push(...results);
  }

  async function getCalendarData() {
    calendar.value = [];
    try {
      await processBulk({
        fn: (bulkParams) => groupRequest.getGroupCalendars(bulkParams),
        N: -1,
        params: {
          n: 100,
          offset: 0,
          date: dayjs(selectedDay.value).format("YYYY-MM-DDTHH:mm:ss[Z]"),
        },
        handle: (args) => {
          void appendCalendarPage(args).catch(logError);
        },
      });
    } catch (error) {
      console.error("Error fetching calendars:", error);
    }
  }

  async function getFollowingCalendarData() {
    followingCalendar.value = [];
    try {
      await processBulk({
        fn: (bulkParams) => groupRequest.getFollowingGroupCalendars(bulkParams),
        N: -1,
        params: {
          n: 100,
          offset: 0,
          date: dayjs(selectedDay.value).format("YYYY-MM-DDTHH:mm:ss[Z]"),
        },
        handle: (args) => {
          void appendFollowingCalendarPage(args).catch(logError);
        },
      });
    } catch (error) {
      console.error("Error fetching following calendars:", error);
    }
  }

  async function getFeaturedCalendarData() {
    featuredCalendar.value = [];
    try {
      await processBulk({
        fn: (bulkParams) => groupRequest.getFeaturedGroupCalendars(bulkParams),
        N: -1,
        params: {
          n: 100,
          offset: 0,
          date: dayjs(selectedDay.value).format("YYYY-MM-DDTHH:mm:ss[Z]"),
        },
        handle: (args) => {
          void appendFeaturedCalendarPage(args).catch(logError);
        },
      });
    } catch (error) {
      console.error("Error fetching featured calendars:", error);
    }
  }

  function updateFollowingCalendarData(updatedEvent: CalendarEventEntry) {
    const index = followingCalendar.value.findIndex((item) => item.id === updatedEvent.id);
    if (index !== -1) {
      followingCalendar.value.splice(index, 1);
    }
    if (updatedEvent.userInterest?.isFollowing) {
      followingCalendar.value.push(updatedEvent);
    }
  }

  async function prepareSearchEvent(event: CalendarEventEntry) {
    event.title = replaceBioSymbols(event.title);
    event.description = replaceBioSymbols(event.description);
    await getGroupNameFromCache(ownerIdOf(event));
  }

  return {
    prepareSearchEvent,
    calendar,
    followingCalendar,
    featuredCalendar,
    isLoading,
    groupRefsCache,
    groupNamesCache,
    updateCalenderData,
    updateFollowingCalendarData,
  };
}
