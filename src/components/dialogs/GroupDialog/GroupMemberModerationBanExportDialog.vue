<template>
  <Dialog
    :open="isGroupBansExportDialogVisible"
    @update:open="
      (open) => {
        if (!open) setIsGroupBansExportDialogVisible();
      }
    "
  >
    <DialogContent class="x-dialog sm:max-w-162.5">
      <DialogHeader>
        <DialogTitle>{{ t("dialog.group_member_moderation.export_bans") }}</DialogTitle>
      </DialogHeader>

      <div class="flex flex-col gap-2 mb-2">
        <label v-for="option in exportBansOptions" :key="option.label" class="inline-flex items-center gap-2">
          <Checkbox
            :model-value="checkedExportBansOptions.includes(option.label)"
            @update:model-value="(val) => toggleExportOption(option.label, val === true)"
          />
          <span>{{ t(option.text) }}</span>
        </label>
      </div>
      <br />
      <InputGroupTextareaField v-model="exportContent" :rows="15" readonly input-class="resize-none mt-4" @click="handleCopyExportContent" />
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
import Dialog from "@/components/ui/dialog/Dialog.vue";
import DialogContent from "@/components/ui/dialog/DialogContent.vue";
import DialogHeader from "@/components/ui/dialog/DialogHeader.vue";
import DialogTitle from "@/components/ui/dialog/DialogTitle.vue";
import { ref, watch } from "vue";
import Checkbox from "@/components/ui/checkbox/Checkbox.vue";
import InputGroupTextareaField from "@/components/ui/input-group/InputGroupTextareaField.vue";
import { useI18n } from "vue-i18n";

import { copyToClipboard } from "../../../shared/utils/app-actions";
import { formatCsvField } from "../../../shared/utils/csv";
import type { ModerationRow } from "./group-moderation-types";
import type { GroupMemberModerationTable } from "../../../stores/group-types";

type BanExportKey = "userId" | "displayName" | "roles" | "managerNotes" | "joinedAt" | "bannedAt";

const { t } = useI18n();

const props = withDefaults(
  defineProps<{
    isGroupBansExportDialogVisible?: boolean;
    groupBansModerationTable: GroupMemberModerationTable<ModerationRow>;
  }>(),
  {
    isGroupBansExportDialogVisible: false,
  }
);

const emit = defineEmits<{
  "update:isGroupBansExportDialogVisible": [value: boolean];
}>();

watch(
  () => props.isGroupBansExportDialogVisible,
  (isVisible) => {
    if (isVisible) {
      updateExportContent();
    }
  }
);

const exportContent = ref("");

const exportBansOptions: { label: BanExportKey; text: string }[] = [
  { label: "userId", text: "dialog.group_member_moderation.user_id" },
  { label: "displayName", text: "dialog.group_member_moderation.display_name" },
  { label: "roles", text: "dialog.group_member_moderation.roles" },
  { label: "managerNotes", text: "dialog.group_member_moderation.notes" },
  { label: "joinedAt", text: "dialog.group_member_moderation.joined_at" },
  { label: "bannedAt", text: "dialog.group_member_moderation.banned_at" },
];

const checkedExportBansOptions = ref<BanExportKey[]>(["userId", "displayName", "roles", "managerNotes", "joinedAt", "bannedAt"]);

function toggleExportOption(label: BanExportKey, isChecked: boolean) {
  const selection = checkedExportBansOptions.value;
  const index = selection.indexOf(label);
  if (isChecked && index === -1) {
    selection.push(label);
  } else if (!isChecked && index !== -1) {
    selection.splice(index, 1);
  }
  updateExportContent();
}

function getRowValue(item: ModerationRow, key: BanExportKey): string {
  switch (key) {
    case "displayName":
      return item.user?.displayName ?? item.$displayName ?? "";
    case "roles":
      return (item.roleIds ?? []).join(";");
    case "userId":
      return item.userId ?? "";
    case "managerNotes":
      return item.managerNotes ?? "";
    case "joinedAt":
      return item.joinedAt ?? "";
    case "bannedAt":
      return item.bannedAt ?? "";
  }
}

function updateExportContent() {
  const sortedCheckedOptions = exportBansOptions.filter((option) => checkedExportBansOptions.value.includes(option.label)).map((option) => option.label);

  const header = `${sortedCheckedOptions.join(",")}\n`;

  const content = props.groupBansModerationTable.data
    .map((item) => sortedCheckedOptions.map((key) => formatCsvField(getRowValue(item, key))).join(","))
    .join("\n");

  exportContent.value = header + content;
}

function handleCopyExportContent() {
  copyToClipboard(exportContent.value);
}

function setIsGroupBansExportDialogVisible() {
  emit("update:isGroupBansExportDialogVisible", false);
}
</script>
