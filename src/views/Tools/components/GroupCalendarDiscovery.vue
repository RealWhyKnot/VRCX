<template>
  <div class="flex h-full min-h-0 min-w-0 flex-col gap-2">
    <div class="flex shrink-0 flex-wrap items-center justify-between gap-2">
      <ToggleGroup type="single" variant="outline" size="sm" :model-value="scope" @update:model-value="selectScope">
        <ToggleGroupItem value="live">{{ t("dialog.group_calendar.live") }}</ToggleGroupItem>
        <ToggleGroupItem value="upcoming">{{ t("dialog.group_calendar.upcoming") }}</ToggleGroupItem>
      </ToggleGroup>
      <slot />
    </div>
    <div class="min-h-0 flex-1 overflow-y-auto" :aria-busy="isLoading">
      <Spinner v-if="isLoading" class="mx-auto mt-4" />
      <Button v-else-if="hasError" variant="outline" size="sm" @click="loadPage(page)">{{ t("common.actions.retry") }}</Button>
      <div v-else-if="events.length" class="grid grid-cols-[repeat(auto-fit,minmax(min(100%,12rem),1fr))] gap-2">
        <GroupCalendarEventCard
          v-for="event in events"
          :key="event.id"
          :event="event"
          mode="grid"
          is-compact
          :is-following="event.userInterest?.isFollowing ?? false"
          card-class="min-w-0 w-full"
          @update-following-calendar-data="updateEvent"
          @click-action="event.ownerId && showGroupDialog(event.ownerId)"
        />
      </div>
      <div v-else class="py-4 text-center text-sm text-muted-foreground">{{ t("dialog.group_calendar.no_events") }}</div>
    </div>
    <div v-if="page > 0 || nextCursor" class="flex shrink-0 justify-end gap-2">
      <Button size="sm" variant="outline" :disabled="page === 0 || isLoading" @click="loadPage(page - 1)">{{ t("table.pagination.previous") }}</Button>
      <Button size="sm" variant="outline" :disabled="!nextCursor || isLoading" @click="loadPage(page + 1)">{{ t("table.pagination.next") }}</Button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref, shallowRef } from "vue";
import { useI18n } from "vue-i18n";
import { groupCalendarRequest } from "@/api/group-request-calendar";
import Button from "@/components/ui/button/Button.vue";
import Spinner from "@/components/ui/spinner/Spinner.vue";
import ToggleGroup from "@/components/ui/toggle-group/ToggleGroup.vue";
import ToggleGroupItem from "@/components/ui/toggle-group/ToggleGroupItem.vue";
import { showGroupDialog } from "@/coordinators/group-dialog-coordinator";
import GroupCalendarEventCard from "./GroupCalendarEventCard.vue";
import type { CalendarEventEntry } from "../composables/use-group-calendar-data";

const { t } = useI18n();
const scope = ref<"live" | "upcoming">("live");
const events = shallowRef<CalendarEventEntry[]>([]);
const page = ref(0);
const nextCursor = ref<string>();
const isLoading = ref(false);
const hasError = ref(false);
const cursorHistory: (string | undefined)[] = [undefined];
let generation = 0;

onMounted(() => void loadPage(0).catch(console.error));

function selectScope(value: unknown) {
  if ((value !== "live" && value !== "upcoming") || value === scope.value) return;
  scope.value = value;
  cursorHistory.length = 1;
  nextCursor.value = undefined;
  page.value = 0;
  void loadPage(0).catch(console.error);
}

async function loadPage(index: number) {
  const requestGeneration = ++generation;
  page.value = index;
  isLoading.value = true;
  hasError.value = false;
  const cursor = cursorHistory[index];
  try {
    const response = await groupCalendarRequest.discoverGroupCalendars(scope.value, cursor);
    if (requestGeneration !== generation) return;
    events.value = response.results.slice(0, 12);
    nextCursor.value = response.nextCursor !== cursor && !cursorHistory.slice(0, index).includes(response.nextCursor) ? response.nextCursor : undefined;
    cursorHistory[index + 1] = nextCursor.value;
  } catch (error) {
    if (requestGeneration === generation) {
      hasError.value = true;
      nextCursor.value = undefined;
    }
    console.error(error);
  } finally {
    if (requestGeneration === generation) isLoading.value = false;
  }
}

function updateEvent(event: CalendarEventEntry) {
  events.value = events.value.map((existing) => (existing.id === event.id ? event : existing));
}
</script>
