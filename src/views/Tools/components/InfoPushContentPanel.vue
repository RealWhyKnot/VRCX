<template>
  <div class="min-w-0 space-y-2" :aria-busy="isLoading">
    <Spinner v-if="isLoading && !rowCount" />
    <Button v-else-if="hasError && !rowCount" size="sm" variant="outline" @click="loadContent()">{{ t("common.actions.retry") }}</Button>
    <template v-else-if="rowCount">
      <ul v-if="visibleInstances.length" class="divide-y rounded-md border">
        <li v-for="instance in visibleInstances" :key="instance.location" class="flex min-w-0 items-center justify-between gap-2 px-2">
          <Button
            size="sm"
            variant="ghost"
            class="min-w-0 flex-1 basis-0 justify-start px-0"
            :title="instance.displayName || instance.world?.name || instance.worldId"
            @click="showWorldDialog(instance.worldId)"
          >
            <span class="truncate">{{ instance.displayName || instance.world?.name || instance.worldId }}</span>
          </Button>
          <span class="max-w-24 shrink-0 truncate text-xs tabular-nums text-muted-foreground" :title="`${instance.userCount}/${instance.capacity}`"
            >{{ instance.userCount }}/{{ instance.capacity }}</span
          >
        </li>
      </ul>
      <div v-else class="grid min-w-0 grid-cols-[repeat(auto-fit,minmax(min(100%,12rem),1fr))] gap-2">
        <GroupCalendarEventCard
          v-for="event in visibleEvents"
          :key="event.id"
          :event="event"
          :is-following="event.userInterest?.isFollowing ?? false"
          mode="grid"
          is-compact
          @click-action="event.ownerId && showGroupDialog(event.ownerId)"
          @update-following-calendar-data="updateEvent"
        />
      </div>
      <div v-if="page || canLoadNext || hasError" class="flex flex-wrap justify-end gap-2">
        <Button size="sm" variant="outline" :disabled="page === 0 || isLoading" @click="page--">{{ t("table.pagination.previous") }}</Button>
        <Button size="sm" variant="outline" :disabled="!canLoadNext || isLoading" @click="showNext">
          {{ t(hasError ? "common.actions.retry" : "table.pagination.next") }}
        </Button>
      </div>
    </template>
    <span v-else class="text-xs text-muted-foreground">{{ t("common.no_data") }}</span>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, shallowRef } from "vue";
import { useI18n } from "vue-i18n";
import { miscRequest } from "@/api/misc";
import Button from "@/components/ui/button/Button.vue";
import Spinner from "@/components/ui/spinner/Spinner.vue";
import { showGroupDialog } from "@/coordinators/group-dialog-coordinator";
import { showWorldDialog } from "@/coordinators/world-coordinator";
import GroupCalendarEventCard from "./GroupCalendarEventCard.vue";
import type { CalendarEvent, LimitedInstance } from "vrchat";
import type { Json } from "@/types/vrcx";

const props = defineProps<{ entryId: string }>();
const { t } = useI18n();
const pageSize = 8;
const page = ref(0);
const events = shallowRef<Json<CalendarEvent>[]>([]);
const instances = shallowRef<Json<LimitedInstance>[]>([]);
const nextCursor = ref<string>();
const isLoading = ref(false);
const hasError = ref(false);
const usedCursors = new Set<string>();
const rowCount = computed(() => events.value.length || instances.value.length);
const pageStart = computed(() => page.value * pageSize);
const canLoadNext = computed(() => pageStart.value + pageSize < rowCount.value || Boolean(nextCursor.value));
const visibleEvents = computed(() => events.value.slice(pageStart.value, pageStart.value + pageSize));
const visibleInstances = computed(() => instances.value.slice(pageStart.value, pageStart.value + pageSize));

onMounted(() => void loadContent().catch(console.error));

async function loadContent(cursor?: string) {
  isLoading.value = true;
  hasError.value = false;
  try {
    const content = await miscRequest.getInfoPushContent(props.entryId, cursor);
    if (content.responseType === "instance") {
      instances.value = [...instances.value, ...content.results];
    } else {
      events.value = [...events.value, ...content.results];
    }
    if (cursor) usedCursors.add(cursor);
    nextCursor.value = typeof content.nextCursor === "string" && !usedCursors.has(content.nextCursor) ? content.nextCursor : undefined;
  } catch (error) {
    hasError.value = true;
    console.error(error);
  } finally {
    isLoading.value = false;
  }
}

async function showNext() {
  if (pageStart.value + pageSize >= rowCount.value && nextCursor.value) await loadContent(nextCursor.value);
  if (pageStart.value + pageSize < rowCount.value) page.value++;
}

function updateEvent(event: Json<CalendarEvent>) {
  events.value = events.value.map((existing) => (existing.id === event.id ? event : existing));
}
</script>
