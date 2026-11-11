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

          <GroupEventRecurrenceFields v-if="!groupEventEditDialog.seriesId" :can-return-to-never="canReturnToNever" />

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

import { useGroupStore } from "../../../stores/group";
import { useModalStore } from "../../../stores/modal";
import { useUserStore } from "../../../stores/user";
import GallerySelectDialog from "./GallerySelectDialog.vue";
import GroupEventRecurrenceFields from "./GroupEventRecurrenceFields.vue";
import type { GallerySelectDialogState, GallerySelectionPayload } from "./group-dialog-types";
import { categoryOptions, isAccessType, isCategory, isPlatform, platformOptions, toIsoDateTime, toLocalDateTime } from "./group-event-edit-values";
import type { CalendarEventPlatform } from "./group-event-edit-values";
import { useGroupEventActions } from "./use-group-event-actions";

const { t } = useI18n();
const groupStore = useGroupStore();
const { groupEventEditDialog } = storeToRefs(groupStore);
const { subsetOfLanguages } = storeToRefs(useUserStore());
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
const modalStore = useModalStore();

const gallerySelectDialog = ref<GallerySelectDialogState>({
  visible: false,
  selectedFileId: "",
  selectedImageUrl: "",
  isIconGallerySelectDialog: false,
});

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
const hasInvalidDateRange = computed(() => {
  const startsAt = Date.parse(groupEventEditDialog.value.startsAt);
  const endsAt = Date.parse(groupEventEditDialog.value.endsAt);
  return Number.isFinite(startsAt) && Number.isFinite(endsAt) && endsAt <= startsAt;
});
const hasPastStartDate = computed(() => {
  const startsAt = Date.parse(groupEventEditDialog.value.startsAt);
  return !isEditMode.value && Number.isFinite(startsAt) && startsAt <= Date.now();
});
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

const { editParentEvent, saveEvent, deleteEvent } = useGroupEventActions({
  t,
  groupStore,
  modalStore,
  groupEventEditDialog,
  isEditMode,
  canSubmit,
});

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
</script>
