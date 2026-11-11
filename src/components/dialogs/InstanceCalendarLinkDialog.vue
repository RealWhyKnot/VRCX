<template>
  <Dialog :open="open" @update:open="handleOpenChange">
    <DialogContent class="sm:max-w-162.5">
      <DialogHeader>
        <DialogTitle>{{ t("dialog.instance_calendar_link.header") }}</DialogTitle>
      </DialogHeader>

      <div v-if="fetching" class="flex justify-center py-4">
        <Loader2 class="h-4 w-4 animate-spin" />
      </div>
      <div v-else-if="linkableEvents.length === 0" class="text-sm text-muted-foreground">
        {{ t("dialog.instance_calendar_link.no_events") }}
      </div>
      <FieldGroup v-else class="gap-4">
        <Field>
          <FieldLabel>{{ t("dialog.instance_calendar_link.event") }}</FieldLabel>
          <FieldContent>
            <Select v-model="selectedEventId" :disabled="loading">
              <SelectTrigger size="sm" class="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem v-for="event in linkableEvents" :key="event.id" :value="event.id"> {{ event.title }} ({{ formatTimeRange(event) }}) </SelectItem>
              </SelectContent>
            </Select>
          </FieldContent>
        </Field>
        <div v-if="selectedEvent" class="rounded-md border p-3">
          <GroupCalendarEventDetails :event="selectedEvent" relative-time />
        </div>
      </FieldGroup>

      <DialogFooter>
        <Button variant="secondary" :disabled="loading" @click="closeDialog">
          {{ t("common.actions.cancel") }}
        </Button>
        <Button v-if="currentEventId" variant="destructive" :disabled="loading" @click="updateLink(null)">
          {{ t("dialog.instance_calendar_link.remove") }}
        </Button>
        <Button :disabled="!canAssign" @click="updateLink(selectedEventId)">
          {{ loading ? t("dialog.instance_calendar_link.saving") : t("dialog.instance_calendar_link.assign") }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { Loader2 } from "lucide-vue-next";
import { toast } from "vue-sonner";
import { useI18n } from "vue-i18n";

import Button from "@/components/ui/button/Button.vue";
import Dialog from "@/components/ui/dialog/Dialog.vue";
import DialogContent from "@/components/ui/dialog/DialogContent.vue";
import DialogFooter from "@/components/ui/dialog/DialogFooter.vue";
import DialogHeader from "@/components/ui/dialog/DialogHeader.vue";
import DialogTitle from "@/components/ui/dialog/DialogTitle.vue";
import Field from "@/components/ui/field/Field.vue";
import FieldContent from "@/components/ui/field/FieldContent.vue";
import FieldGroup from "@/components/ui/field/FieldGroup.vue";
import FieldLabel from "@/components/ui/field/FieldLabel.vue";
import Select from "@/components/ui/select/Select.vue";
import SelectContent from "@/components/ui/select/SelectContent.vue";
import SelectItem from "@/components/ui/select/SelectItem.vue";
import SelectTrigger from "@/components/ui/select/SelectTrigger.vue";
import SelectValue from "@/components/ui/select/SelectValue.vue";

import { groupRequest } from "../../api/group";
import { instanceRequest } from "../../api/instance";
import { useGroupStore } from "../../stores/group";
import { formatDateFilter } from "../../coordinators/date-coordinator";
import { parseLocation } from "../../shared/utils/location-parser";
import GroupCalendarEventDetails from "../../views/Tools/components/GroupCalendarEventDetails.vue";

const LINK_WINDOW_MS = 6 * 60 * 60 * 1000;
const FETCH_LOOKBACK_MS = 24 * 60 * 60 * 1000;

const props = defineProps({
  open: {
    type: Boolean,
    default: false,
  },
  location: {
    type: String,
    required: true,
  },
  currentEventId: {
    type: String,
    default: "",
  },
});

const emit = defineEmits(["update:open"]);
const { t } = useI18n();
const groupStore = useGroupStore();

const events = ref([]);
const selectedEventId = ref("");
const fetching = ref(false);
const loading = ref(false);

const linkableEvents = computed(() => {
  const now = Date.now();
  return events.value
    .filter((event) => new Date(event.startsAt).getTime() <= now + LINK_WINDOW_MS && new Date(event.endsAt).getTime() >= now - LINK_WINDOW_MS)
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
});

const selectedEvent = computed(() => linkableEvents.value.find((event) => event.id === selectedEventId.value));

const canAssign = computed(() => !loading.value && !!selectedEvent.value && selectedEventId.value !== props.currentEventId);

watch(
  () => props.open,
  (open) => {
    if (open) {
      selectedEventId.value = props.currentEventId;
      fetchEvents();
    }
  },
  { immediate: true }
);

async function fetchEvents() {
  const { groupId } = parseLocation(props.location);
  if (!groupId) return;
  fetching.value = true;
  try {
    const args = await groupRequest.getGroupCalendar(groupId, {
      n: 100,
      after: new Date(Date.now() - FETCH_LOOKBACK_MS).toISOString(),
    });
    events.value = (args.json?.results ?? []).map((event) => groupStore.applyGroupEvent(event));
    if (!selectedEventId.value && linkableEvents.value.length) {
      selectedEventId.value = linkableEvents.value[0].id;
    }
  } finally {
    fetching.value = false;
  }
}

function formatTimeRange(event) {
  return `${formatDateFilter(event.startsAt, "short")} - ${formatDateFilter(event.endsAt, "time")}`;
}

function closeDialog() {
  if (!loading.value) {
    emit("update:open", false);
  }
}

function handleOpenChange(open) {
  if (!open) {
    closeDialog();
  }
}

async function updateLink(calendarEntryId) {
  loading.value = true;
  try {
    await instanceRequest.updateInstance({ location: props.location, calendarEntryId });
    toast.success(calendarEntryId ? t("message.instance.calendar_linked") : t("message.instance.calendar_unlinked"));
    emit("update:open", false);
  } finally {
    loading.value = false;
  }
}
</script>
