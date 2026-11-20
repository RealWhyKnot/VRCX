<template>
  <div v-if="event" class="min-w-0 rounded-xl bg-(--profile-card) p-3">
    <div class="text-[10px] font-bold uppercase tracking-wide text-muted-foreground mb-2 pb-2 border-b border-border">
      {{ t("dialog.group.info.next_event") }}
    </div>
    <GroupCalendarEventCard
      :key="event.id"
      :event="event"
      :is-following="event.userInterest?.isFollowing ?? false"
      mode="grid"
      is-compact
      card-class="max-w-full"
      @update-following-calendar-data="event = $event"
    />
  </div>
</template>

<script setup lang="ts">
import { shallowRef, watch } from "vue";
import { useI18n } from "vue-i18n";
import { groupCalendarRequest } from "@/api/group-request-calendar";
import GroupCalendarEventCard from "@/views/Tools/components/GroupCalendarEventCard.vue";
import type { Json } from "@/types/vrcx";
import type { CalendarEvent } from "vrchat";

const props = defineProps<{ groupId: string }>();
const { t } = useI18n();
const event = shallowRef<Json<CalendarEvent> | null>(null);

watch(
  () => props.groupId,
  async (groupId, _, onCleanup) => {
    const controller = new AbortController();
    onCleanup(() => controller.abort());
    event.value = null;
    try {
      const nextEvent = await groupCalendarRequest.getNextGroupCalendarEvent(groupId);
      if (!controller.signal.aborted && nextEvent && Date.parse(nextEvent.startsAt) > Date.now()) event.value = nextEvent;
    } catch (error) {
      console.error(error);
    }
  },
  { immediate: true }
);
</script>
