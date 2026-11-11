import type { ComputedRef, Ref } from "vue";
import { toast } from "vue-sonner";
import type { useGroupStore } from "../../../stores/group";
import type { useModalStore } from "../../../stores/modal";
import type { GroupEventEditDialogState } from "../../../stores/group-types";
import { groupRequest } from "../../../api/group";
import { queryRequest } from "../../../api/query-request";
import { isAccessType, isCategory, isPlatform, toLocalDateTime } from "./group-event-edit-values";
import type { CalendarEventParams, CalendarEventRecurrence } from "./group-event-edit-values";

type GroupEventActionsDeps = {
  t: (key: string) => string;
  groupStore: Pick<ReturnType<typeof useGroupStore>, "showEditGroupEventDialog" | "markGroupEventMutation">;
  modalStore: Pick<ReturnType<typeof useModalStore>, "confirm">;
  groupEventEditDialog: Ref<GroupEventEditDialogState>;
  isEditMode: ComputedRef<boolean>;
  canSubmit: ComputedRef<boolean>;
};

export function useGroupEventActions({ t, groupStore, modalStore, groupEventEditDialog, isEditMode, canSubmit }: GroupEventActionsDeps) {
  async function editParentEvent() {
    const D = groupEventEditDialog.value;
    if (!isEditMode.value || !D.seriesId || D.loading) {
      return;
    }

    const groupRef = D.groupRef;
    D.loading = true;
    let args;
    try {
      args = await queryRequest.fetch("groupCalendarEvent", {
        groupId: D.groupId,
        eventId: D.seriesId,
      });
    } catch (error) {
      D.loading = false;
      console.error("Failed to load parent group event for editing:", error);
      toast.error(t("dialog.group_event_edit.load_error"));
      return;
    }

    groupStore.showEditGroupEventDialog(args.json, groupRef);
  }

  async function saveEvent() {
    const D = groupEventEditDialog.value;
    if (!canSubmit.value || !isAccessType(D.accessType) || !isCategory(D.category)) {
      return;
    }
    D.loading = true;
    const params: CalendarEventParams = {
      startsAt: D.startsAt,
      endsAt: D.endsAt,
      title: D.title.trim(),
      accessType: D.accessType,
      description: D.description.trim(),
      category: D.category,
      tags: D.tags.map((tag) => tag.trim()),
      imageId: D.imageId || null,
      roleIds: [...D.roleIds],
      platforms: D.platforms.filter(isPlatform),
      languages: D.languages.slice(0, 3),
      sendCreationNotification: D.sendCreationNotification,
      hostEarlyJoinMinutes: Number(D.hostEarlyJoinMinutes),
      guestEarlyJoinMinutes: Number(D.guestEarlyJoinMinutes),
      closeInstanceAfterEndMinutes: Number(D.closeInstanceAfterEndMinutes),
      groupId: D.groupId,
    };
    const recurrence = D.recurrence;
    if (!D.seriesId && recurrence) {
      const series: CalendarEventRecurrence = {
        frequency: recurrence.frequency,
        interval: recurrence.interval || 1,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      };
      params.occurrenceKind = "series";
      params.recurrence = series;
      const daysOfWeek = recurrence.daysOfWeek ?? [];
      if (recurrence.frequency === "weekly" && daysOfWeek.length) {
        series.daysOfWeek = [...daysOfWeek];
      }
      if (recurrence.end?.type === "afterOccurrences") {
        series.end = {
          type: "afterOccurrences",
          count: Number(recurrence.end.count) || 1,
        };
      } else if (recurrence.end?.type === "afterDate") {
        series.end = {
          type: "afterDate",
          date: toLocalDateTime(recurrence.end.date),
        };
      }
    }
    console.log("Saving group event with params:", params);
    try {
      if (isEditMode.value) {
        await groupRequest.editGroupEvent({ ...params, eventId: D.eventId });
      } else {
        await groupRequest.createGroupEvent(params);
      }
      D.visible = false;
      groupStore.markGroupEventMutation();
      toast.success(t(isEditMode.value ? "dialog.group_event_edit.edit_success" : "dialog.group_event_edit.create_success"));
    } catch (error) {
      console.error("Failed to save group event:", error);
      toast.error(t("dialog.group_event_edit.save_error"));
    } finally {
      D.loading = false;
    }
  }

  async function deleteEvent() {
    if (!isEditMode.value || groupEventEditDialog.value.loading) {
      return;
    }
    const { ok } = await modalStore.confirm({
      title: t("confirm.title"),
      description: t("dialog.group_event_edit.delete_confirm"),
      destructive: true,
    });
    if (!ok) {
      return;
    }

    const D = groupEventEditDialog.value;
    D.loading = true;
    try {
      await groupRequest.deleteGroupEvent({
        groupId: D.groupId,
        eventId: D.eventId,
      });
      D.visible = false;
      groupStore.markGroupEventMutation();
      toast.success(t("dialog.group_event_edit.delete_success"));
    } catch (error) {
      console.error("Failed to delete group event:", error);
      toast.error(t("dialog.group_event_edit.delete_error"));
    } finally {
      D.loading = false;
    }
  }
  return { editParentEvent, saveEvent, deleteEvent };
}
