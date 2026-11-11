<template>
  <Dialog :open="groupEventEditDialog.visible" @update:open="handleOpenChange">
    <DialogContent class="x-dialog sm:max-w-180 max-h-[85vh] overflow-hidden p-0 gap-0 flex flex-col">
      <DialogHeader class="px-6 pt-6 pb-4">
        <DialogTitle>
          {{ isEditMode ? t("dialog.group_event_edit.edit_header") : t("dialog.group_event_edit.create_header") }}
        </DialogTitle>
      </DialogHeader>

      <div class="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-6 py-2">
        <FieldGroup class="gap-4">
          <Field>
            <FieldLabel>{{ t("dialog.group_event_edit.title") }}</FieldLabel>
            <FieldContent>
              <InputGroupField v-model="groupEventEditDialog.title" size="sm" :maxlength="64" :disabled="groupEventEditDialog.loading" show-count />
            </FieldContent>
          </Field>

          <Field>
            <FieldLabel>{{ t("dialog.group_event_edit.description") }}</FieldLabel>
            <FieldContent>
              <InputGroupTextareaField
                v-model="groupEventEditDialog.description"
                :rows="4"
                :maxlength="1024"
                :disabled="groupEventEditDialog.loading"
                show-count
              />
            </FieldContent>
          </Field>

          <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel>{{ t("dialog.group_event_edit.starts_at") }}</FieldLabel>
              <FieldContent>
                <InputGroupField v-model="startsAtLocal" type="datetime-local" size="sm" :disabled="groupEventEditDialog.loading" />
                <p v-if="hasPastStartDate" class="mt-1 text-xs text-destructive">
                  {{ t("dialog.group_event_edit.start_in_past") }}
                </p>
              </FieldContent>
            </Field>
            <Field>
              <FieldLabel>{{ t("dialog.group_event_edit.ends_at") }}</FieldLabel>
              <FieldContent>
                <InputGroupField v-model="endsAtLocal" type="datetime-local" size="sm" :disabled="groupEventEditDialog.loading" />
                <p v-if="hasInvalidDateRange" class="mt-1 text-xs text-destructive">
                  {{ t("dialog.group_event_edit.invalid_date_range") }}
                </p>
              </FieldContent>
            </Field>
          </div>

          <template v-if="!groupEventEditDialog.seriesId">
            <div class="rounded-md border p-4 space-y-4">
              <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field>
                  <FieldLabel>{{ t("dialog.group_event_edit.repeat") }}</FieldLabel>
                  <FieldContent>
                    <Select :model-value="repeatFrequencySelection" :disabled="groupEventEditDialog.loading" @update:model-value="handleRepeatFrequencyChange">
                      <SelectTrigger size="sm" class="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none" :disabled="!canReturnToNever">
                          {{ t("dialog.group_event_edit.repeat_values.none") }}
                        </SelectItem>
                        <SelectItem value="weekly">
                          {{ t("dialog.group_event_edit.repeat_values.weekly") }}
                        </SelectItem>
                        <SelectItem value="monthly">
                          {{ t("dialog.group_event_edit.repeat_values.monthly") }}
                        </SelectItem>
                        <SelectItem value="yearly">
                          {{ t("dialog.group_event_edit.repeat_values.yearly") }}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </FieldContent>
                </Field>
                <Field v-if="groupEventEditDialog.recurrence">
                  <FieldLabel>{{ t("dialog.group_event_edit.repeat_every") }}</FieldLabel>
                  <FieldContent>
                    <InputGroupField
                      v-model.number="groupEventEditDialog.recurrence.interval"
                      type="number"
                      min="1"
                      step="1"
                      size="sm"
                      :disabled="groupEventEditDialog.loading"
                    />
                  </FieldContent>
                </Field>
              </div>

              <template v-if="groupEventEditDialog.recurrence">
                <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field v-if="groupEventEditDialog.recurrence.frequency === 'weekly'">
                    <FieldLabel>{{ t("dialog.group_event_edit.weekly_pattern") }}</FieldLabel>
                    <FieldContent>
                      <Select :model-value="weeklyPatternSelection" :disabled="groupEventEditDialog.loading" @update:model-value="handleWeeklyPatternChange">
                        <SelectTrigger size="sm" class="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="everyWeek">
                            {{ t("dialog.group_event_edit.weekly_pattern_values.every_week") }}
                          </SelectItem>
                          <SelectItem value="weekdays">
                            {{ t("dialog.group_event_edit.weekly_pattern_values.weekdays") }}
                          </SelectItem>
                          <SelectItem value="weekend">
                            {{ t("dialog.group_event_edit.weekly_pattern_values.weekend") }}
                          </SelectItem>
                          <SelectItem value="custom">
                            {{ t("dialog.group_event_edit.weekly_pattern_values.custom") }}
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </FieldContent>
                  </Field>
                  <Field v-if="groupEventEditDialog.recurrence.frequency === 'weekly' && weeklyPatternSelection === 'custom'">
                    <FieldLabel>{{ t("dialog.group_event_edit.custom_days") }}</FieldLabel>
                    <FieldContent>
                      <Select
                        multiple
                        :model-value="groupEventEditDialog.recurrence.daysOfWeek"
                        :disabled="groupEventEditDialog.loading"
                        @update:model-value="handleCustomDaysChange"
                      >
                        <SelectTrigger size="sm" class="w-full">
                          <SelectValue>
                            <span class="truncate">
                              {{ selectedCustomDaysSummary || t("dialog.group_event_edit.none_selected") }}
                            </span>
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem v-for="day in weekDayOptions" :key="day.value" :value="day.value">
                            {{ day.label }}
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </FieldContent>
                  </Field>
                </div>

                <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field>
                    <FieldLabel>{{ t("dialog.group_event_edit.ends") }}</FieldLabel>
                    <FieldContent>
                      <Select v-model="recurrenceEndType" :disabled="groupEventEditDialog.loading">
                        <SelectTrigger size="sm" class="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="never">
                            {{ t("dialog.group_event_edit.ends_values.never") }}
                          </SelectItem>
                          <SelectItem value="afterOccurrences">
                            {{ t("dialog.group_event_edit.ends_values.after_occurrences") }}
                          </SelectItem>
                          <SelectItem value="afterDate">
                            {{ t("dialog.group_event_edit.ends_values.after_date") }}
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </FieldContent>
                  </Field>
                  <Field v-if="recurrenceEndType === 'afterOccurrences'">
                    <FieldLabel>{{ t("dialog.group_event_edit.occurrence_count") }}</FieldLabel>
                    <FieldContent>
                      <InputGroupField v-model.number="recurrenceEndCount" type="number" min="1" step="1" size="sm" :disabled="groupEventEditDialog.loading" />
                    </FieldContent>
                  </Field>

                  <Field v-if="recurrenceEndType === 'afterDate'">
                    <FieldLabel>{{ t("dialog.group_event_edit.end_date") }}</FieldLabel>
                    <FieldContent>
                      <InputGroupField v-model="recurrenceEndDate" type="datetime-local" size="sm" :disabled="groupEventEditDialog.loading" />
                    </FieldContent>
                  </Field>
                </div>
              </template>
            </div>
          </template>

          <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel>{{ t("dialog.group_event_edit.access_type") }}</FieldLabel>
              <FieldContent>
                <Select
                  v-model="groupEventEditDialog.accessType"
                  :disabled="groupEventEditDialog.loading || groupEventEditDialog.groupRef.privacy === 'private'"
                >
                  <SelectTrigger size="sm" class="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="group">
                      {{ t("dialog.group_event_edit.access_group") }}
                    </SelectItem>
                    <SelectItem value="public">
                      {{ t("dialog.group_event_edit.access_public") }}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </FieldContent>
            </Field>
            <Field>
              <FieldLabel>{{ t("dialog.group_event_edit.category") }}</FieldLabel>
              <FieldContent>
                <Select v-model="groupEventEditDialog.category" :disabled="groupEventEditDialog.loading">
                  <SelectTrigger size="sm" class="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem v-for="category in categoryOptions" :key="category" :value="category">
                      {{ t(`dialog.group_event_edit.categories.${category}`) }}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </FieldContent>
            </Field>
          </div>

          <Field>
            <FieldLabel>{{ t("dialog.group_event_edit.tags") }}</FieldLabel>
            <FieldContent>
              <InputGroupField v-model="tagsText" size="sm" :disabled="groupEventEditDialog.loading" />
              <p class="mt-1 text-xs text-muted-foreground">
                {{ t("dialog.group_event_edit.tags_help") }}
              </p>
            </FieldContent>
          </Field>

          <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel>{{ t("dialog.group_event_edit.languages") }}</FieldLabel>
              <FieldContent>
                <Select
                  multiple
                  :model-value="groupEventEditDialog.languages"
                  :disabled="groupEventEditDialog.loading"
                  @update:model-value="handleLanguagesChange"
                >
                  <SelectTrigger size="sm" class="w-full">
                    <SelectValue>
                      <span class="truncate">
                        {{ selectedLanguageSummary || t("dialog.group_event_edit.none_selected") }}
                      </span>
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem v-for="language in languageOptions" :key="language.value" :value="language.value">
                      {{ language.label }}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </FieldContent>
            </Field>
            <Field>
              <FieldLabel>{{ t("dialog.group_event_edit.platforms") }}</FieldLabel>
              <FieldContent>
                <Select
                  multiple
                  :model-value="groupEventEditDialog.platforms"
                  :disabled="groupEventEditDialog.loading"
                  @update:model-value="handlePlatformsChange"
                >
                  <SelectTrigger size="sm" class="w-full">
                    <SelectValue>
                      <span class="truncate">
                        {{ selectedPlatformSummary || t("dialog.group_event_edit.none_selected") }}
                      </span>
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem v-for="platform in platformOptions" :key="platform" :value="platform">
                      {{ t(`dialog.group_event_edit.platform_values.${platform}`) }}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </FieldContent>
            </Field>
          </div>

          <Field>
            <FieldLabel>{{ t("dialog.group_event_edit.roles") }}</FieldLabel>
            <FieldContent>
              <Select multiple :model-value="groupEventEditDialog.roleIds" :disabled="groupEventEditDialog.loading" @update:model-value="handleRoleIdsChange">
                <SelectTrigger size="sm" class="w-full">
                  <SelectValue>
                    <span class="truncate">
                      {{ selectedRoleSummary || t("dialog.group_event_edit.all_members") }}
                    </span>
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem v-for="role in selectableRoles" :key="role.id" :value="role.id">
                    {{ role.name }}
                  </SelectItem>
                </SelectContent>
              </Select>
            </FieldContent>
          </Field>

          <Field>
            <FieldLabel>{{ t("dialog.group_event_edit.image") }}</FieldLabel>
            <FieldContent>
              <div class="flex items-start gap-2">
                <img v-if="groupEventEditDialog.imageUrl" :src="groupEventEditDialog.imageUrl" class="size-20 rounded-md object-cover" loading="lazy" />
                <div class="flex gap-2">
                  <Button size="sm" variant="outline" :disabled="groupEventEditDialog.loading" @click="showGallerySelectDialog">
                    {{ t("dialog.group_event_edit.select_image") }}
                  </Button>
                  <Button v-if="groupEventEditDialog.imageUrl" size="sm" variant="destructive" :disabled="groupEventEditDialog.loading" @click="clearImage">
                    {{ t("dialog.group_event_edit.clear_image") }}
                  </Button>
                </div>
              </div>
            </FieldContent>
          </Field>

          <div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Field>
              <FieldLabel>{{ t("dialog.group_event_edit.host_early_join") }}</FieldLabel>
              <FieldContent>
                <InputGroupField
                  v-model.number="groupEventEditDialog.hostEarlyJoinMinutes"
                  type="number"
                  min="0"
                  max="60"
                  step="1"
                  size="sm"
                  :disabled="groupEventEditDialog.loading || isEditMode"
                />
              </FieldContent>
            </Field>
            <Field>
              <FieldLabel>{{ t("dialog.group_event_edit.guest_early_join") }}</FieldLabel>
              <FieldContent>
                <InputGroupField
                  v-model.number="groupEventEditDialog.guestEarlyJoinMinutes"
                  type="number"
                  min="0"
                  max="60"
                  step="1"
                  size="sm"
                  :disabled="groupEventEditDialog.loading || isEditMode"
                />
              </FieldContent>
            </Field>
            <Field>
              <FieldLabel>{{ t("dialog.group_event_edit.close_after_end") }}</FieldLabel>
              <FieldContent>
                <InputGroupField
                  v-model.number="groupEventEditDialog.closeInstanceAfterEndMinutes"
                  type="number"
                  min="0"
                  max="60"
                  step="1"
                  size="sm"
                  :disabled="groupEventEditDialog.loading || isEditMode"
                />
              </FieldContent>
            </Field>
          </div>

          <div class="flex items-center gap-2">
            <label v-if="!isEditMode" class="inline-flex items-center gap-2">
              <Checkbox v-model="groupEventEditDialog.sendCreationNotification" :disabled="groupEventEditDialog.loading" />
              <span>{{ t("dialog.group_event_edit.send_notification") }}</span>
            </label>
          </div>
        </FieldGroup>
      </div>

      <DialogFooter class="px-6 py-4">
        <div v-if="isEditMode" class="mr-auto flex gap-2">
          <Button variant="destructive" :disabled="groupEventEditDialog.loading" @click="deleteEvent">
            <Trash2 />
            {{ t("common.actions.delete") }}
          </Button>
          <Button v-if="groupEventEditDialog.seriesId" variant="outline" :disabled="groupEventEditDialog.loading" @click="editParentEvent">
            <Repeat />
            {{ t("dialog.group_event_edit.edit_parent") }}
          </Button>
        </div>
        <Button variant="secondary" :disabled="groupEventEditDialog.loading" @click="closeDialog">
          {{ t("common.actions.cancel") }}
        </Button>
        <Button :disabled="!canSubmit" @click="saveEvent">
          {{
            groupEventEditDialog.loading
              ? t("dialog.group_event_edit.saving")
              : isEditMode
                ? t("dialog.group_event_edit.save")
                : t("dialog.group_event_edit.create")
          }}
        </Button>
      </DialogFooter>

      <GallerySelectDialog :gallery-select-dialog="gallerySelectDialog" @select-image="handleGalleryImageSelect" />
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { storeToRefs } from "pinia";
import { Repeat, Trash2 } from "lucide-vue-next";
import { toast } from "vue-sonner";
import { useI18n } from "vue-i18n";
import type { AcceptableValue } from "reka-ui";

import Button from "@/components/ui/button/Button.vue";
import Checkbox from "@/components/ui/checkbox/Checkbox.vue";
import Dialog from "@/components/ui/dialog/Dialog.vue";
import DialogContent from "@/components/ui/dialog/DialogContent.vue";
import DialogFooter from "@/components/ui/dialog/DialogFooter.vue";
import DialogHeader from "@/components/ui/dialog/DialogHeader.vue";
import DialogTitle from "@/components/ui/dialog/DialogTitle.vue";
import Field from "@/components/ui/field/Field.vue";
import FieldContent from "@/components/ui/field/FieldContent.vue";
import FieldGroup from "@/components/ui/field/FieldGroup.vue";
import FieldLabel from "@/components/ui/field/FieldLabel.vue";
import InputGroupField from "@/components/ui/input-group/InputGroupField.vue";
import InputGroupTextareaField from "@/components/ui/input-group/InputGroupTextareaField.vue";
import Select from "@/components/ui/select/Select.vue";
import SelectContent from "@/components/ui/select/SelectContent.vue";
import SelectItem from "@/components/ui/select/SelectItem.vue";
import SelectTrigger from "@/components/ui/select/SelectTrigger.vue";
import SelectValue from "@/components/ui/select/SelectValue.vue";

import { groupRequest } from "../../../api/group";
import { queryRequest } from "../../../api/query-request";
import { useGroupStore } from "../../../stores/group";
import { useModalStore } from "../../../stores/modal";
import { useUserStore } from "../../../stores/user";
import GallerySelectDialog from "./GallerySelectDialog.vue";
import type { GallerySelectDialogState, GallerySelectionPayload } from "./group-dialog-types";

type CalendarEventParams = Parameters<typeof groupRequest.createGroupEvent>[0];
type CalendarEventRecurrence = NonNullable<CalendarEventParams["recurrence"]>;
type CalendarEventFrequency = CalendarEventRecurrence["frequency"];
type CalendarDayOfWeek = NonNullable<CalendarEventRecurrence["daysOfWeek"]>[number];
type CalendarEventAccess = CalendarEventParams["accessType"];
type CalendarEventCategory = CalendarEventParams["category"];
type CalendarEventPlatform = NonNullable<CalendarEventParams["platforms"]>[number];

const categoryOptions: CalendarEventCategory[] = [
  "arts",
  "avatars",
  "dance",
  "education",
  "exploration",
  "film_media",
  "gaming",
  "hangout",
  "music",
  "other",
  "performance",
  "roleplaying",
  "wellness",
];
const platformOptions: CalendarEventPlatform[] = ["android", "ios", "standalonewindows"];
const weekDays: CalendarDayOfWeek[] = ["MO", "TU", "WE", "TH", "FR", "SA", "SU"];
const weekdayDays: CalendarDayOfWeek[] = ["MO", "TU", "WE", "TH", "FR"];
const weekendDays: CalendarDayOfWeek[] = ["SA", "SU"];

const { t } = useI18n();
const groupStore = useGroupStore();
const { groupEventEditDialog } = storeToRefs(groupStore);
const { subsetOfLanguages } = storeToRefs(useUserStore());
const modalStore = useModalStore();

const gallerySelectDialog = ref<GallerySelectDialogState>({
  visible: false,
  selectedFileId: "",
  selectedImageUrl: "",
  isIconGallerySelectDialog: false,
});
const canReturnToNever = ref(true);

watch(
  () => groupEventEditDialog.value,
  (dialog) => {
    if (dialog.visible) {
      canReturnToNever.value = !dialog.recurrence;
    }
  },
  { immediate: true }
);

const isEditMode = computed(() => groupEventEditDialog.value.mode === "edit");
const startsAtLocal = computed({
  get: () => toLocalDateTime(groupEventEditDialog.value.startsAt),
  set: (value: string) => {
    groupEventEditDialog.value.startsAt = toIsoDateTime(value);
  },
});
const endsAtLocal = computed({
  get: () => toLocalDateTime(groupEventEditDialog.value.endsAt),
  set: (value: string) => {
    groupEventEditDialog.value.endsAt = toIsoDateTime(value);
  },
});
const tagsText = computed({
  get: () => groupEventEditDialog.value.tags.join(", "),
  set: (value: string) => {
    groupEventEditDialog.value.tags = value
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean)
      .slice(0, 5);
  },
});
const languageOptions = computed(() =>
  Object.entries(subsetOfLanguages.value).map(([value, label]) => ({
    value,
    label,
  }))
);
const selectedLanguageSummary = computed(() =>
  groupEventEditDialog.value.languages.map((language) => subsetOfLanguages.value[language] ?? language).join(", ")
);
const selectedPlatformSummary = computed(() =>
  groupEventEditDialog.value.platforms.map((platform) => t(`dialog.group_event_edit.platform_values.${platform}`)).join(", ")
);
const selectableRoles = computed(() =>
  (groupEventEditDialog.value.groupRef.roles ?? []).filter((role): role is typeof role & { id: string } => typeof role.id === "string")
);
const selectedRoleSummary = computed(() => {
  const roles = selectableRoles.value;
  return groupEventEditDialog.value.roleIds.map((roleId) => roles.find((role) => role.id === roleId)?.name ?? roleId).join(", ");
});
const weekDayOptions = [
  { value: "MO", label: t("dialog.group_event_edit.weekday_values.MO") },
  { value: "TU", label: t("dialog.group_event_edit.weekday_values.TU") },
  { value: "WE", label: t("dialog.group_event_edit.weekday_values.WE") },
  { value: "TH", label: t("dialog.group_event_edit.weekday_values.TH") },
  { value: "FR", label: t("dialog.group_event_edit.weekday_values.FR") },
  { value: "SA", label: t("dialog.group_event_edit.weekday_values.SA") },
  { value: "SU", label: t("dialog.group_event_edit.weekday_values.SU") },
];
const hasInvalidDateRange = computed(() => {
  const startsAt = Date.parse(groupEventEditDialog.value.startsAt);
  const endsAt = Date.parse(groupEventEditDialog.value.endsAt);
  return Number.isFinite(startsAt) && Number.isFinite(endsAt) && endsAt <= startsAt;
});
const hasPastStartDate = computed(() => {
  const startsAt = Date.parse(groupEventEditDialog.value.startsAt);
  return !isEditMode.value && Number.isFinite(startsAt) && startsAt <= Date.now();
});
const repeatFrequencySelection = computed(() => groupEventEditDialog.value.recurrence?.frequency ?? "none");
const recurrenceEndType = computed({
  get: () => groupEventEditDialog.value.recurrence?.end?.type ?? "never",
  set: (value: AcceptableValue) => {
    const recurrence = groupEventEditDialog.value.recurrence;
    if (!recurrence) {
      return;
    }
    if (value === "never") {
      delete recurrence.end;
    } else if (value === "afterOccurrences") {
      const count = recurrence.end?.type === value ? recurrence.end.count : undefined;
      recurrence.end = {
        type: value,
        count: count ?? 1,
      };
    } else if (value === "afterDate") {
      const date = recurrence.end?.type === value ? recurrence.end.date : undefined;
      recurrence.end = {
        type: value,
        date: date ?? "",
      };
    }
  },
});
const recurrenceEndCount = computed({
  get: () => groupEventEditDialog.value.recurrence?.end?.count ?? "",
  set: (value: string | number) => {
    const end = groupEventEditDialog.value.recurrence?.end;
    if (!end) {
      return;
    }
    if (value === "") {
      delete end.count;
    } else {
      end.count = Number(value);
    }
  },
});
const recurrenceEndDate = computed({
  get: () => groupEventEditDialog.value.recurrence?.end?.date ?? "",
  set: (value: string) => {
    const end = groupEventEditDialog.value.recurrence?.end;
    if (end) {
      end.date = value;
    }
  },
});
const weeklyPatternSelection = computed(() => {
  const days = groupEventEditDialog.value.recurrence?.daysOfWeek ?? [];
  if (days.length === 5 && weekdayDays.every((day) => days.includes(day))) {
    return "weekdays";
  }
  if (days.length === 2 && weekendDays.every((day) => days.includes(day))) {
    return "weekend";
  }
  if (days.length > 0) {
    return "custom";
  }
  return "everyWeek";
});
const selectedCustomDaysSummary = computed(() =>
  (groupEventEditDialog.value.recurrence?.daysOfWeek ?? []).map((day) => weekDayOptions.find((option) => option.value === day)?.label ?? day).join(", ")
);
const canSubmit = computed(() => {
  const D = groupEventEditDialog.value;
  return (
    !D.loading &&
    isAccessType(D.accessType) &&
    isCategory(D.category) &&
    D.title.trim().length >= 1 &&
    D.description.trim().length >= 1 &&
    Number.isFinite(Date.parse(D.startsAt)) &&
    Number.isFinite(Date.parse(D.endsAt)) &&
    !hasInvalidDateRange.value &&
    !hasPastStartDate.value &&
    [D.hostEarlyJoinMinutes, D.guestEarlyJoinMinutes, D.closeInstanceAfterEndMinutes].every((value) => Number.isInteger(Number(value)) && Number(value) >= 0)
  );
});

function isAccessType(value: string): value is CalendarEventAccess {
  return value === "group" || value === "public";
}

function isCategory(value: string): value is CalendarEventCategory {
  return categoryOptions.some((category) => category === value);
}

function isPlatform(value: string): value is CalendarEventPlatform {
  return platformOptions.some((platform) => platform === value);
}

function isWeekDay(value: unknown): value is CalendarDayOfWeek {
  return weekDays.some((day) => day === value);
}

function isFrequency(value: AcceptableValue): value is CalendarEventFrequency {
  return value === "daily" || value === "weekly" || value === "monthly" || value === "yearly";
}

function toLocalDateTime(value: string | undefined) {
  const date = new Date(value ?? "");
  if (!Number.isFinite(date.getTime())) {
    return "";
  }
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function toIsoDateTime(value: string) {
  if (!value) {
    return "";
  }
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : "";
}

function handleLanguagesChange(value: AcceptableValue | AcceptableValue[]) {
  const languages: string[] = [];
  if (Array.isArray(value)) {
    for (const language of value) {
      if (typeof language === "string") {
        languages.push(language);
      }
    }
  }
  groupEventEditDialog.value.languages = languages.slice(0, 3);
}

function handlePlatformsChange(value: AcceptableValue | AcceptableValue[]) {
  const platforms: CalendarEventPlatform[] = [];
  if (Array.isArray(value)) {
    for (const platform of value) {
      if (typeof platform === "string" && isPlatform(platform)) {
        platforms.push(platform);
      }
    }
  }
  groupEventEditDialog.value.platforms = platforms;
}

function handleRoleIdsChange(value: AcceptableValue | AcceptableValue[]) {
  const roleIds: string[] = [];
  if (Array.isArray(value)) {
    for (const roleId of value) {
      if (typeof roleId === "string") {
        roleIds.push(roleId);
      }
    }
  }
  groupEventEditDialog.value.roleIds = roleIds;
}

function handleRepeatFrequencyChange(value: AcceptableValue) {
  if (value === "none") {
    if (!canReturnToNever.value) {
      return;
    }
    groupEventEditDialog.value.recurrence = null;
    return;
  }
  if (!isFrequency(value)) {
    return;
  }
  groupEventEditDialog.value.recurrence ??= {
    interval: 1,
    frequency: value,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  };
  const recurrence = groupEventEditDialog.value.recurrence;
  recurrence.frequency = value;
  if (value !== "weekly") {
    recurrence.daysOfWeek = [];
  }
}

function handleWeeklyPatternChange(value: AcceptableValue) {
  const recurrence = groupEventEditDialog.value.recurrence;
  if (!recurrence) {
    return;
  }
  if (value === "weekdays") {
    recurrence.daysOfWeek = ["MO", "TU", "WE", "TH", "FR"];
    return;
  }
  if (value === "weekend") {
    recurrence.daysOfWeek = ["SA", "SU"];
    return;
  }
  if (value === "custom") {
    recurrence.daysOfWeek = ["SA"];
    return;
  }
  recurrence.daysOfWeek = [];
}

function handleCustomDaysChange(value: AcceptableValue | AcceptableValue[]) {
  const recurrence = groupEventEditDialog.value.recurrence;
  if (!recurrence) {
    return;
  }
  const days: CalendarDayOfWeek[] = [];
  if (Array.isArray(value)) {
    for (const day of value) {
      if (isWeekDay(day)) {
        days.push(day);
      }
    }
  }
  recurrence.daysOfWeek = days;
}

function showGallerySelectDialog() {
  const D = groupEventEditDialog.value;
  gallerySelectDialog.value = {
    visible: true,
    selectedFileId: D.imageId,
    selectedImageUrl: D.imageUrl,
    isIconGallerySelectDialog: false,
  };
}

function handleGalleryImageSelect(image: GallerySelectionPayload) {
  groupEventEditDialog.value.imageId = image.fileId;
  groupEventEditDialog.value.imageUrl = image.imageUrl;
}

function clearImage() {
  groupEventEditDialog.value.imageId = "";
  groupEventEditDialog.value.imageUrl = "";
}

function closeDialog() {
  if (!groupEventEditDialog.value.loading) {
    groupEventEditDialog.value.visible = false;
  }
}

function handleOpenChange(isOpen: boolean) {
  if (!isOpen) {
    closeDialog();
  }
}

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
</script>
