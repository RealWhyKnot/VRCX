<template>
  <div class="flex items-baseline justify-between gap-3 text-xs">
    <div class="text-[13px] font-semibold">{{ event.title }}</div>
    <div class="whitespace-nowrap">
      {{ relativeTime ? formatRelativeTimeRange(event.startsAt, event.endsAt) : formatTimeRange(event.startsAt, event.endsAt) }}
    </div>
  </div>
  <div class="mt-2 grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
    <div class="flex min-w-0 flex-col gap-1">
      <Button variant="outline" size="sm" @click="openCalendarEvent(event)">
        <Calendar />
        {{ t("dialog.group_calendar.event_card.export_to_calendar") }}
      </Button>
    </div>
    <div class="flex min-w-0 flex-col gap-1">
      <Button variant="outline" size="sm" @click="downloadEventIcs(event)">
        <Download />
        {{ t("dialog.group_calendar.event_card.download_ics") }}
      </Button>
    </div>
    <div class="flex min-w-0 flex-col gap-1">
      <div>
        {{ t("dialog.group_calendar.event_card.category") }}
      </div>
      <div class="font-medium">{{ capitalizeFirst(event.category) }}</div>
    </div>
    <div class="flex min-w-0 flex-col gap-1">
      <div>
        {{ t("dialog.group_calendar.event_card.interested_user") }}
      </div>
      <div class="font-medium">{{ event.interestedUserCount }}</div>
    </div>
    <div v-if="friendsInterested !== undefined" class="flex min-w-0 flex-col gap-1">
      <div>
        {{ t("dialog.group_calendar.event_card.interested_friends") }}
      </div>
      <div class="font-medium">{{ friendsInterested }}</div>
    </div>
    <div v-if="linkedInstances !== undefined" class="flex min-w-0 flex-col gap-1">
      <div>
        {{ t("dialog.group_calendar.event_card.linked_instances") }}
      </div>
      <div class="font-medium">{{ linkedInstances }}</div>
    </div>
    <div class="flex min-w-0 flex-col gap-1">
      <div>
        {{ t("dialog.group_calendar.event_card.close_time") }}
      </div>
      <div class="font-medium">
        {{ event.closeInstanceAfterEndMinutes + " min" }}
      </div>
    </div>
    <div class="flex min-w-0 flex-col gap-1">
      <div>
        {{ t("dialog.group_calendar.event_card.created") }}
      </div>
      <div class="font-medium">
        {{ formatDateFilter(event.createdAt, "long") }}
      </div>
    </div>
    <div class="col-span-2 flex min-w-0 flex-col gap-1">
      <div>
        {{ t("dialog.group_calendar.event_card.description") }}
      </div>
      <div class="whitespace-pre-wrap break-words font-normal leading-snug">
        {{ event.description }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Calendar, Download } from "lucide-vue-next";
import Button from "@/components/ui/button/Button.vue";
import dayjs from "dayjs";
import type {} from "dayjs/plugin/relativeTime";
import { toast } from "vue-sonner";
import { useI18n } from "vue-i18n";
import { computed } from "vue";

import { AppDebug } from "../../../services/app-config";
import { webApiService } from "../../../services/webapi";
import { formatDateFilter } from "../../../coordinators/date-coordinator";
import type { CalendarEvent } from "vrchat";
import type { Json } from "../../../types/vrcx";

type CalendarEventEntry = Omit<Json<CalendarEvent>, "userInterest"> & {
  userInterest?: { createdAt?: string | null; isFollowing?: boolean; updatedAt?: string | null } | undefined;
};

const { t } = useI18n();

function countField(event: object, key: string): number | undefined {
  const value: unknown = Reflect.get(event, key);
  return typeof value === "number" ? value : undefined;
}

const props = withDefaults(
  defineProps<{
    event: CalendarEventEntry;
    relativeTime?: boolean | undefined;
  }>(),
  {
    relativeTime: false,
  }
);

const friendsInterested = computed(() => countField(props.event, "interestedFriendCount"));
const linkedInstances = computed(() => countField(props.event, "linkedInstanceCount"));

async function openCalendarEvent(event: CalendarEventEntry) {
  const content = await getCalendarIcs(event);
  if (!content) return;
  await window.AppApi.OpenCalendarFile(content);
}

async function getCalendarIcs(event: CalendarEventEntry): Promise<string | undefined> {
  const url = `${AppDebug.endpointDomain}/calendar/${event.ownerId}/${event.id}.ics`;
  try {
    const response = await webApiService.execute({
      url,
      method: "GET",
    });
    if (response.status !== 200) {
      throw new Error(`Error: ${response.data}`);
    }
    return response.data;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    toast.error(`Failed to download .ics file, ${message}`);
    console.error("Failed to download .ics file:", error);
    return undefined;
  }
}

async function downloadEventIcs(event: CalendarEventEntry) {
  const content = await getCalendarIcs(event);
  if (!content) return;
  const blob = new Blob([content], { type: "text/calendar" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `${event.id}.ics`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);
}

const formatTimeRange = (startsAt: string, endsAt: string) => `${formatDateFilter(startsAt, "time")} - ${formatDateFilter(endsAt, "time")}`;

const formatRelativeTimeRange = (startsAt: string, endsAt: string) => `${dayjs(startsAt).fromNow()} - ${dayjs(endsAt).fromNow()}`;

const capitalizeFirst = (str: string) => str.charAt(0).toUpperCase() + str.slice(1);
</script>
