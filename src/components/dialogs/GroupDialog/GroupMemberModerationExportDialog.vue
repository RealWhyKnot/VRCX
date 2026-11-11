<template>
  <Dialog
    :open="isGroupLogsExportDialogVisible"
    @update:open="
      (open) => {
        if (!open) setIsGroupLogsExportDialogVisible();
      }
    "
  >
    <DialogContent class="x-dialog sm:max-w-162.5">
      <DialogHeader>
        <DialogTitle>{{ t("dialog.group_member_moderation.export_logs") }}</DialogTitle>
      </DialogHeader>

      <div class="flex flex-col gap-2 mb-2">
        <label v-for="option in checkGroupsLogsExportLogsOptions" :key="option.label" class="inline-flex items-center gap-2">
          <Checkbox
            :model-value="checkedGroupLogsExportLogsOptions.includes(option.label)"
            @update:model-value="(val) => toggleGroupLogsExportOption(option.label, val === true)"
          />
          <span>{{ t(option.text) }}</span>
        </label>
      </div>
      <br />
      <InputGroupTextareaField v-model="groupLogsExportContent" :rows="15" readonly input-class="resize-none mt-4" @click="handleCopyGroupLogsExportContent" />
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
import type { ModerationLogRow } from "./group-moderation-types";
import type { GroupMemberModerationTable } from "../../../stores/group-types";

type LogExportKey = "created_at" | "eventType" | "actorDisplayName" | "description" | "data";

const { t } = useI18n();

const props = withDefaults(
  defineProps<{
    isGroupLogsExportDialogVisible?: boolean;
    groupLogsModerationTable: GroupMemberModerationTable<ModerationLogRow>;
  }>(),
  {
    isGroupLogsExportDialogVisible: false,
  }
);

const emit = defineEmits<{
  "update:isGroupLogsExportDialogVisible": [value: boolean];
}>();
watch(
  () => props.isGroupLogsExportDialogVisible,
  (isVisible) => {
    if (isVisible) {
      updateGroupLogsExportContent();
    }
  }
);

const groupLogsExportContent = ref("");

const checkGroupsLogsExportLogsOptions: { label: LogExportKey; text: string }[] = [
  { label: "created_at", text: "dialog.group_member_moderation.created_at" },
  { label: "eventType", text: "dialog.group_member_moderation.type" },
  { label: "actorDisplayName", text: "dialog.group_member_moderation.display_name" },
  { label: "description", text: "dialog.group_member_moderation.description" },
  { label: "data", text: "dialog.group_member_moderation.data" },
];
const checkedGroupLogsExportLogsOptions = ref<LogExportKey[]>(["created_at", "eventType", "actorDisplayName", "description", "data"]);

function toggleGroupLogsExportOption(label: LogExportKey, isChecked: boolean) {
  const selection = checkedGroupLogsExportLogsOptions.value;
  const index = selection.indexOf(label);
  if (isChecked && index === -1) {
    selection.push(label);
  } else if (!isChecked && index !== -1) {
    selection.splice(index, 1);
  }
  updateGroupLogsExportContent();
}

function getLogValue(item: ModerationLogRow, key: LogExportKey): unknown {
  const value: unknown = Reflect.get(item, key);
  return key === "data" ? JSON.stringify(value) : value;
}

function updateGroupLogsExportContent() {
  const sortedCheckedOptions = checkGroupsLogsExportLogsOptions
    .filter((option) => checkedGroupLogsExportLogsOptions.value.includes(option.label))
    .map((option) => option.label);

  const header = `${sortedCheckedOptions.join(",")}\n`;

  const content = props.groupLogsModerationTable.data
    .map((item) => sortedCheckedOptions.map((key) => formatCsvField(getLogValue(item, key))).join(","))
    .join("\n");

  groupLogsExportContent.value = header + content;
}

function handleCopyGroupLogsExportContent() {
  copyToClipboard(groupLogsExportContent.value);
}

function setIsGroupLogsExportDialogVisible() {
  emit("update:isGroupLogsExportDialogVisible", false);
}
</script>
