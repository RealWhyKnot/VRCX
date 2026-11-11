<template>
  <Dialog :open="isRegistryBackupDialogVisible" @update:open="(open) => !open && closeAndClearDialog()">
    <DialogContent>
      <DialogHeader>
        <DialogTitle>{{ t("dialog.registry_backup.header") }}</DialogTitle>
      </DialogHeader>
      <div class="mt-2">
        <div class="flex items-center justify-between text-xs">
          <span class="name mr-6">{{ t("dialog.registry_backup.auto_backup") }}</span>
          <Switch :model-value="vrcRegistryAutoBackup" @update:model-value="setVrcRegistryAutoBackup" />
        </div>
        <div class="mt-1.5 flex items-center justify-between text-xs">
          <span class="name mr-6">{{ t("dialog.registry_backup.ask_to_restore") }}</span>
          <Switch :model-value="vrcRegistryAskRestore" @update:model-value="setVrcRegistryAskRestore" />
        </div>
        <DataTableLayout class="min-w-0 w-full mt-2" :table="table" :loading="false" :table-style="tableStyle" :show-pagination="false" />
        <div class="mt-2 flex items-center justify-between">
          <Button size="sm" variant="destructive" @click="deleteVrcRegistry">{{ t("dialog.registry_backup.reset") }}</Button>
          <div class="flex gap-2">
            <Button size="sm" variant="outline" @click="promptVrcRegistryBackupName">{{ t("dialog.registry_backup.backup") }}</Button>
            <Button size="sm" variant="outline" @click="restoreVrcRegistryFromFile">{{ t("dialog.registry_backup.restore_from_file") }}</Button>
          </div>
        </div>
      </div>
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
import { isLinuxHost, isWindowsHost } from "@/shared/constants/platform";
import Dialog from "@/components/ui/dialog/Dialog.vue";
import DialogContent from "@/components/ui/dialog/DialogContent.vue";
import DialogHeader from "@/components/ui/dialog/DialogHeader.vue";
import DialogTitle from "@/components/ui/dialog/DialogTitle.vue";
import { computed, ref, watch } from "vue";
import Button from "@/components/ui/button/Button.vue";
import DataTableLayout from "@/components/ui/data-table/DataTableLayout.vue";
import { storeToRefs } from "pinia";
import { toast } from "vue-sonner";
import { useI18n } from "vue-i18n";

import { useAdvancedSettingsStore } from "../../../stores/settings/advanced";
import { useModalStore } from "../../../stores/modal";
import { useVrcxStore } from "../../../stores/vrcx";
import { logError, type RegistryBackup } from "../../../stores/vrcx-messages";
import { downloadAndSaveJson } from "../../../shared/utils/app-actions";
import { removeFromArray } from "../../../shared/utils/base/array";
import Switch from "../../../components/ui/switch/Switch.vue";
import { createColumns } from "../../Settings/dialogs/registry-backup-columns.tsx";
import { useVrcxVueTable } from "../../../lib/table/use-vrcx-vue-table";

import { configRepository } from "../../../services/config";

const { backupVrcRegistry } = useVrcxStore();
const { isRegistryBackupDialogVisible } = storeToRefs(useVrcxStore());
const { vrcRegistryAutoBackup, vrcRegistryAskRestore } = storeToRefs(useAdvancedSettingsStore());
const { setVrcRegistryAutoBackup, setVrcRegistryAskRestore } = useAdvancedSettingsStore();
const modalStore = useModalStore();

const { t } = useI18n();

const registryBackups = ref<RegistryBackup[]>([]);

const tableStyle = { maxHeight: "320px" };

const rows = computed(() => registryBackups.value.slice());

const columns = computed(() =>
  createColumns({
    onRestore: restoreVrcRegistryBackup,
    onSaveToFile: saveVrcRegistryBackupToFile,
    onDelete: deleteVrcRegistryBackup,
  })
);

const { table } = useVrcxVueTable({
  persistKey: "registryBackupDialog",
  get data() {
    return rows.value;
  },
  columns: columns.value,
  getRowId: (row) => row.name,
  enablePagination: false,
  initialSorting: [{ id: "date", desc: true }],
});

watch(
  () => isRegistryBackupDialogVisible.value,
  (isVisible) => {
    if (isVisible) {
      void updateRegistryBackupDialog().catch(logError);
    }
  }
);

function isRegistryBackup(value: unknown): value is RegistryBackup {
  return (
    typeof value === "object" &&
    value !== null &&
    "name" in value &&
    typeof value.name === "string" &&
    "date" in value &&
    typeof value.date === "string" &&
    "data" in value
  );
}

function isRegistryEntry(value: unknown): value is { type: number; data: unknown } {
  return (
    typeof value === "object" && value !== null && "type" in value && typeof value.type === "number" && "data" in value && typeof value.data !== "undefined"
  );
}

async function updateRegistryBackupDialog() {
  const backupsJson = await configRepository.getString("VRCX_VRChatRegistryBackups");
  const parsed: unknown = JSON.parse(backupsJson === null || backupsJson === "" ? "[]" : backupsJson);
  registryBackups.value = Array.isArray(parsed) ? parsed.filter(isRegistryBackup) : [];
}

function restoreVrcRegistryBackup(row: RegistryBackup) {
  modalStore
    .confirm({
      description: t("confirm.restore_backup"),
      title: t("confirm.title"),
    })
    .then(({ ok }) => {
      if (!ok) {
        return;
      }
      const data = JSON.stringify(row.data);
      window.AppApi.SetVRChatRegistry(data)
        .then(() => {
          toast.success(t("message.registry.restored"));
        })
        .catch((e: unknown) => {
          console.error(e);
          toast.error(t("message.registry.restore_failed", { error: String(e) }));
        });
    })
    .catch(logError);
}

function saveVrcRegistryBackupToFile(row: RegistryBackup) {
  downloadAndSaveJson(row.name, row.data);
}

function deleteVrcRegistryBackup(row: RegistryBackup) {
  removeFromArray(registryBackups.value, row);
  void configRepository
    .setString("VRCX_VRChatRegistryBackups", JSON.stringify(registryBackups.value))
    .then(() => updateRegistryBackupDialog())
    .catch(logError);
}

function deleteVrcRegistry() {
  modalStore
    .confirm({
      description: t("confirm.delete_vrc_registry"),
      title: t("confirm.title"),
    })
    .then(({ ok }) => {
      if (!ok) {
        return;
      }
      window.AppApi.DeleteVRChatRegistryFolder()
        .then(() => {
          toast.success(t("message.registry.deleted"));
        })
        .catch(logError);
    })
    .catch(logError);
}

async function handleBackupVrcRegistry(name: string) {
  await backupVrcRegistry(name);
  await updateRegistryBackupDialog();
}

function promptVrcRegistryBackupName() {
  modalStore
    .prompt({
      title: t("prompt.backup_name.header"),
      description: t("prompt.backup_name.description"),
      inputValue: "Backup",
      pattern: /\S+/,
      errorMessage: t("prompt.backup_name.input_error"),
    })
    .then(({ ok, value }) => {
      if (!ok) return;
      void handleBackupVrcRegistry(value).catch(logError);
    })
    .catch(logError);
}

function openJsonFileSelectorDialogElectron() {
  return new Promise<string | null>((resolve) => {
    const fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.accept = ".json";
    fileInput.style.display = "none";
    document.body.appendChild(fileInput);

    fileInput.onchange = () => {
      const file = fileInput.files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = () => {
          fileInput.remove();
          resolve(typeof reader.result === "string" ? reader.result : null);
        };
        reader.readAsText(file);
      } else {
        fileInput.remove();
        resolve(null);
      }
    };

    fileInput.click();
  });
}

async function restoreVrcRegistryFromFile() {
  const filePath = await window.AppApi.OpenFileSelectorDialog(null, ".json", "JSON Files (*.json)|*.json");
  if (isWindowsHost()) {
    if (filePath === "") {
      return;
    }
  }

  const json = isLinuxHost() ? await openJsonFileSelectorDialogElectron() : await window.AppApi.ReadVrcRegJsonFile(filePath);
  if (json === null) {
    toast.error(t("message.registry.invalid_json"));
    return;
  }

  try {
    const data: unknown = JSON.parse(json);
    if (typeof data !== "object" || data === null) {
      throw new Error("Invalid JSON");
    }

    for (const value of Object.values(data)) {
      if (!isRegistryEntry(value)) {
        throw new Error("Invalid JSON");
      }
    }
    window.AppApi.SetVRChatRegistry(json)
      .then(() => {
        toast.success(t("message.registry.restored"));
      })
      .catch((e: unknown) => {
        console.error(e);
        toast.error(t("message.registry.restore_failed", { error: String(e) }));
      });
  } catch {
    toast.error(t("message.registry.invalid_json"));
  }
}

function clearVrcRegistryDialog() {
  registryBackups.value = [];
}

function closeAndClearDialog() {
  closeDialog();

  clearVrcRegistryDialog();
}

function closeDialog() {
  isRegistryBackupDialogVisible.value = false;
}
</script>
