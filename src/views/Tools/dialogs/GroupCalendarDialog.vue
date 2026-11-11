<template>
  <Dialog :open="visible" @update:open="(open) => (open ? null : closeDialog())">
    <DialogContent class="x-dialog sm:max-w-[50vw] h-[70vh] overflow-hidden">
      <DialogHeader>
        <div class="dialog-title-container">
          <DialogTitle>{{ t("dialog.group_calendar.header") }}</DialogTitle>
        </div>
        <div class="featured-switch">
          <span class="featured-switch-text">{{ t("dialog.group_calendar.featured_events") }}</span>
          <Switch v-model="showFeaturedEvents" class="mr-2" @update:model-value="toggleFeaturedEvents" />
          <Button size="sm" variant="outline" class="view-toggle-btn" @click="toggleViewMode">
            {{ viewMode === "timeline" ? t("dialog.group_calendar.list_view") : t("dialog.group_calendar.calendar_view") }}
          </Button>
        </div>
      </DialogHeader>
      <div class="top-content">
        <div v-if="viewMode === 'timeline'" key="timeline" class="timeline-view">
          <div class="timeline-container">
            <div v-if="groupedTimelineEvents.length" class="timeline-list">
              <div v-for="(timeGroup, key) of groupedTimelineEvents" :key="key" class="timeline-group">
                <div class="timeline-timestamp">{{ dayjs(timeGroup.startsAt).format("MM-DD ddd") }} {{ timeGroup.startTime }}</div>
                <div class="time-group-container">
                  <GroupCalendarEventCard
                    v-for="value in timeGroup.events"
                    :key="value.id"
                    :event="value"
                    :group-ref="groupRefsCache.get(ownerIdOf(value))"
                    mode="timeline"
                    :is-following="isEventFollowing(value.id)"
                    :card-class="{ 'grouped-card': timeGroup.events.length > 1 }"
                    @update-following-calendar-data="updateFollowingCalendarData"
                    @click-action="showGroupDialog(ownerIdOf(value))"
                  />
                </div>
              </div>
            </div>
            <div v-else class="timeline-empty">{{ t("dialog.group_calendar.no_events") }}</div>
          </div>

          <div class="calendar-container">
            <GroupCalendarMonth v-model="selectedDay" :is-loading="isLoading" :events-by-date="filteredCalendar" :following-by-date="followingCalendarDate" />
          </div>
        </div>
        <div v-else key="grid" class="grid-view">
          <div class="search-container">
            <InputGroupSearch v-model="searchQuery" size="sm" :placeholder="t('dialog.group_calendar.search_placeholder')" class="search-input" />
          </div>

          <div class="groups-grid">
            <div v-if="filteredGroupEvents.length" class="groups-container">
              <div v-for="group in filteredGroupEvents" :key="group.groupId" class="group-row">
                <div class="group-header" @click="toggleGroup(group.groupId)">
                  <ChevronDown class="rotation-transition" :data-rotated="groupCollapsed[group.groupId] ? '' : undefined" />
                  {{ group.groupName }}
                </div>
                <div v-show="!groupCollapsed[group.groupId]" class="events-row">
                  <GroupCalendarEventCard
                    v-for="event in group.events"
                    :key="event.id"
                    :event="event"
                    :group-ref="groupRefsCache.get(ownerIdOf(event))"
                    mode="grid"
                    :is-following="isEventFollowing(event.id)"
                    card-class="grid-card"
                    @update-following-calendar-data="updateFollowingCalendarData"
                    @click-action="showGroupDialog(ownerIdOf(event))"
                  />
                </div>
              </div>
            </div>
            <div v-else class="no-events">
              {{ searchQuery ? t("dialog.group_calendar.search_no_matching") : t("dialog.group_calendar.search_no_this_month") }}
            </div>
          </div>
        </div>
      </div>
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
import Dialog from "@/components/ui/dialog/Dialog.vue";
import DialogContent from "@/components/ui/dialog/DialogContent.vue";
import DialogHeader from "@/components/ui/dialog/DialogHeader.vue";
import DialogTitle from "@/components/ui/dialog/DialogTitle.vue";
import { computed, onMounted, ref, watch } from "vue";
import { storeToRefs } from "pinia";
import Button from "@/components/ui/button/Button.vue";
import { ChevronDown } from "lucide-vue-next";
import InputGroupSearch from "@/components/ui/input-group/InputGroupSearch.vue";
import { useI18n } from "vue-i18n";

import dayjs from "dayjs";

import { formatDateFilter } from "../../../coordinators/date-coordinator";
import { replaceBioSymbols } from "../../../shared/utils/base/string";
import Switch from "../../../components/ui/switch/Switch.vue";
import { groupRequest } from "../../../api/group";
import { queryRequest } from "../../../api/query-request";
import { processBulk } from "../../../services/request";
import { useGroupStore } from "../../../stores/group";
import { logError } from "../../../stores/vrcx-messages";
import { showGroupDialog } from "@/coordinators/group-dialog-coordinator";

import GroupCalendarEventCard from "../components/GroupCalendarEventCard.vue";
import GroupCalendarMonth from "../components/GroupCalendarMonth.vue";
import { configRepository } from "../../../services/config";
import type { CalendarEvent } from "vrchat";
import type { Json, VrcxGroup } from "../../../types/vrcx";

type CalendarEventEntry = Json<CalendarEvent>;

const groupStore = useGroupStore();
const { applyGroupEvent } = groupStore;
const { groupEventRevision } = storeToRefs(groupStore);

const { t } = useI18n();

const props = defineProps<{
  visible: boolean;
}>();

const emit = defineEmits<{
  close: [];
}>();

const calendar = ref<CalendarEventEntry[]>([]);
const followingCalendar = ref<CalendarEventEntry[]>([]);
const featuredCalendar = ref<CalendarEventEntry[]>([]);
const selectedDay = ref(new Date());
const isLoading = ref(false);
const viewMode = ref<"timeline" | "grid">("timeline");
const searchQuery = ref("");
const groupCollapsed = ref<Record<string, boolean>>({});
const showFeaturedEvents = ref(false);
const groupNamesCache = new Map<string, string>();
const groupRefsCache = new Map<string, VrcxGroup>();

function ownerIdOf(event: CalendarEventEntry): string {
  return event.ownerId ?? "";
}

function addToDateGroup<T>(groups: Map<string, T[]>, dateKey: string, item: T) {
  const bucket = groups.get(dateKey) ?? [];
  bucket.push(item);
  groups.set(dateKey, bucket);
}

function formatDateKey(date: dayjs.ConfigType) {
  return dayjs(date).format("YYYY-MM-DD");
}

onMounted(() => {
  void configRepository
    .getBool("VRCX_groupCalendarShowFeaturedEvents", false)
    .then((isFeatured) => {
      showFeaturedEvents.value = isFeatured;
    })
    .catch(logError);
});

function toggleFeaturedEvents() {
  void configRepository.setBool("VRCX_groupCalendarShowFeaturedEvents", showFeaturedEvents.value).catch(logError);
  void updateCalenderData().catch(logError);
}

watch(
  () => props.visible,
  (isVisible) => {
    if (isVisible) {
      selectedDay.value = new Date();
      void updateCalenderData().catch(logError);
    }
  }
);

watch(
  () => selectedDay.value,
  (newDate: Date, oldDate: Date | undefined) => {
    if (props.visible && oldDate) {
      const newMonth = dayjs(newDate).format("YYYY-MM");
      const oldMonth = dayjs(oldDate).format("YYYY-MM");

      if (newMonth !== oldMonth) {
        void updateCalenderData().catch(logError);
      }
    }
  }
);

watch(groupEventRevision, () => {
  if (props.visible) {
    void updateCalenderData().catch(logError);
  }
});

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

const groupedByGroupEvents = computed(() => {
  const currentMonth = dayjs(selectedDay.value).month();
  const currentYear = dayjs(selectedDay.value).year();

  let currentMonthEvents = calendar.value.filter((event) => {
    const eventDate = dayjs(event.startsAt);
    return eventDate.month() === currentMonth && eventDate.year() === currentYear;
  });
  if (showFeaturedEvents.value) {
    const featuredMonthEvents = featuredCalendar.value.filter((event) => {
      const eventDate = dayjs(event.startsAt);
      return eventDate.month() === currentMonth && eventDate.year() === currentYear;
    });
    currentMonthEvents = currentMonthEvents.concat(featuredMonthEvents);
  }

  const groupMap = new Map<string, CalendarEventEntry[]>();
  currentMonthEvents.forEach((event) => {
    const groupId = ownerIdOf(event);
    const bucket = groupMap.get(groupId) ?? [];
    bucket.push(event);
    groupMap.set(groupId, bucket);
  });

  Array.from(groupMap.values()).forEach((events) => {
    events.sort((a, b) => (dayjs(a.startsAt).isBefore(dayjs(b.startsAt)) ? -1 : 1));
  });

  return Array.from(groupMap.entries()).map(([groupId, events]) => ({
    groupId,
    groupName: groupNamesCache.get(groupId),
    events: events,
  }));
});

const filteredGroupEvents = computed(() => {
  const hasSearch = searchQuery.value.trim();
  return !hasSearch
    ? groupedByGroupEvents.value
    : groupedByGroupEvents.value.filter((group) => {
        if ((group.groupName ?? "").toLowerCase().includes(searchQuery.value.toLowerCase())) return true;

        return group.events.some(
          (event) =>
            event.title.toLowerCase().includes(searchQuery.value.toLowerCase()) || event.description.toLowerCase().includes(searchQuery.value.toLowerCase())
        );
      });
});

watch(
  [filteredGroupEvents, searchQuery],
  ([groups, search]) => {
    const newCollapsed = { ...groupCollapsed.value };
    let hasChanged = false;
    const hasSearch = search.trim();

    for (const group of groups) {
      if (!(group.groupId in newCollapsed)) {
        newCollapsed[group.groupId] = false;
        hasChanged = true;
      } else if (hasSearch) {
        newCollapsed[group.groupId] = false;
        hasChanged = true;
      }
    }

    if (hasChanged) {
      groupCollapsed.value = newCollapsed;
    }
  },
  { immediate: true }
);

const filteredCalendar = computed(() => {
  const result = new Map<string, CalendarEventEntry[]>();
  calendar.value.forEach((item) => {
    addToDateGroup(result, formatDateKey(item.startsAt), item);
  });
  if (showFeaturedEvents.value) {
    featuredCalendar.value.forEach((item) => {
      addToDateGroup(result, formatDateKey(item.startsAt), item);
    });
  }

  result.forEach((events) => {
    events.sort((a, b) => dayjs(a.startsAt).diff(dayjs(b.startsAt)));
  });
  return result;
});

const followingCalendarDate = computed(() => {
  const result = new Map<string, string[]>();

  const followingIds = new Set(followingCalendar.value.map((item) => item.id));

  calendar.value.forEach((event) => {
    if (followingIds.has(event.id)) {
      addToDateGroup(result, formatDateKey(event.startsAt), event.id);
    }
  });
  return result;
});

const formattedSelectedDay = computed(() => {
  return formatDateKey(selectedDay.value);
});

const groupedTimelineEvents = computed(() => {
  const eventsForDay = filteredCalendar.value.get(formattedSelectedDay.value) ?? [];
  const timeGroups = new Map<string, CalendarEventEntry[]>();

  eventsForDay.forEach((event) => {
    addToDateGroup(timeGroups, formatDateFilter(event.startsAt, "time"), event);
  });

  return Array.from(timeGroups.entries())
    .map(([startTime, events]) => ({
      startTime,
      events,
      startsAt: events[0]?.startsAt ?? "",
      hasFollowing: events.some((event) => isEventFollowing(event.id)),
    }))
    .sort((a, b) => dayjs(a.startsAt).diff(dayjs(b.startsAt)));
});

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

type CalendarPage = Awaited<ReturnType<typeof groupRequest.getGroupCalendars>>;

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

function isEventFollowing(eventId: string) {
  return followingCalendar.value.some((item) => item.id === eventId);
}

function toggleViewMode() {
  viewMode.value = viewMode.value === "timeline" ? "grid" : "timeline";
}

function toggleGroup(groupId: string) {
  groupCollapsed.value = {
    ...groupCollapsed.value,
    [groupId]: !groupCollapsed.value[groupId],
  };
}

function closeDialog() {
  emit("close");
}
</script>

<style scoped>
.top-content {
  height: 640px;
  position: relative;
  overflow: hidden;
}

.timeline-container {
  min-width: 200px;
  padding-left: 4px;
  padding-right: 16px;
  margin-left: 8px;
  margin-right: 8px;
  overflow: auto;
  height: 50vh;
}

.timeline-view {
  display: flex;
  align-items: center;

  .timeline-container {
    flex: 1;
  }
}

.timeline-list {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.timeline-group {
  padding: 0 20px 8px 8px;
}

.timeline-timestamp {
  font-size: 0.8125rem;
  font-weight: 600;
  margin-bottom: 8px;
}

.timeline-empty {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.time-group-container {
  display: flex;
  flex-direction: column;
  gap: 8px;
  overflow: visible;
}

.dialog-title-container {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
}

.dialog-title-container .view-toggle-btn {
  font-size: 0.75rem;
  padding: 8px 12px;
}

.featured-switch {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  margin-top: 8px;

  .featured-switch-text {
    font-size: 0.8125rem;
    margin-right: 6px;
  }
}

.grid-view {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
}

.search-container {
  padding: 2px 20px 12px;
  display: flex;
  justify-content: flex-end;
}

.search-input {
  width: 300px;
}

.groups-grid {
  flex: 1;
  overflow-y: auto;
  padding: 16px 20px;
}

.groups-container {
  overflow: visible;
}

.group-row {
  margin-bottom: 18px;
  overflow: visible;
}

.group-header {
  font-size: 1rem;
  font-weight: bold;
  padding: 4px 12px 8px;
  cursor: pointer;
  border-radius: var(--radius-md);
  margin: 0 -12px 8px;
  display: flex;
  align-items: center;
}

.rotation-transition {
  font-size: 0.875rem;
  margin-right: 8px;
  transition: transform 0.3s;
}

.rotation-transition[data-rotated] {
  transform: rotate(-90deg);
}

.events-row {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  overflow: visible;
}

.no-events {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 200px;
  font-size: 1rem;
}
</style>
