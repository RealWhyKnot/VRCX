<template>
  <Dialog v-model:open="isVisible">
    <DialogContent class="sm:max-w-xl">
      <DialogHeader>
        <DialogTitle>{{ t("dialog.avatar_import.header") }}</DialogTitle>
      </DialogHeader>
      <div class="flex items-center justify-between">
        <div class="text-xs">{{ t("dialog.avatar_import.description") }}</div>
        <div class="flex items-center">
          <div v-if="avatarImportDialog.progress">
            {{ t("dialog.avatar_import.process_progress") }} {{ avatarImportDialog.progress }} /
            {{ avatarImportDialog.progressTotal }}
            <Spinner class="inline-block ml-2 mr-2" />
          </div>
          <Button v-if="avatarImportDialog.loading" size="sm" variant="secondary" @click="cancelAvatarImport">
            {{ t("dialog.avatar_import.cancel") }}
          </Button>
          <Button v-else size="sm" :disabled="!avatarImportDialog.input" @click="processAvatarImportList">
            {{ t("dialog.avatar_import.process_list") }}
          </Button>
        </div>
      </div>
      <InputGroupTextareaField v-model="avatarImportDialog.input" :rows="10" input-class="resize-none mt-2" />
      <div class="mt-1.5 flex items-center justify-between">
        <div>
          <div class="flex items-center gap-2">
            <Select class="mr-1.5" :model-value="avatarImportFavoriteGroupSelection" @update:model-value="handleAvatarImportGroupSelect">
              <SelectTrigger size="sm">
                <SelectValue :placeholder="t('dialog.avatar_import.select_group_placeholder')" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem
                    v-for="groupAPI in favoriteAvatarGroups"
                    :key="groupAPI.name"
                    :value="groupAPI.name"
                    :disabled="groupAPI.count >= groupAPI.capacity"
                  >
                    {{ groupAPI.displayName }} ({{ groupAPI.count }}/{{ groupAPI.capacity }})
                  </SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>

            <Select class="ml-2" :model-value="avatarImportLocalFavoriteGroupSelection" @update:model-value="handleAvatarImportLocalGroupSelect">
              <SelectTrigger size="sm">
                <SelectValue :placeholder="t('dialog.avatar_import.select_group_placeholder')" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem v-for="group in localAvatarFavoriteGroups" :key="group" :value="group">
                    {{ group }} ({{ localAvatarFavGroupLength(group) }})
                  </SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
          <span v-if="avatarImportDialog.avatarImportFavoriteGroup" class="ml-1.5">
            {{ avatarImportTable.data.length }} /
            {{ avatarImportDialog.avatarImportFavoriteGroup.capacity - avatarImportDialog.avatarImportFavoriteGroup.count }}
          </span>
        </div>
        <div>
          <Button size="sm" variant="secondary" class="mr-2" @click="clearAvatarImportTable">
            {{ t("dialog.avatar_import.clear_table") }}
          </Button>
          <Button
            size="sm"
            :disabled="
              avatarImportTable.data.length === 0 || (!avatarImportDialog.avatarImportFavoriteGroup && !avatarImportDialog.avatarImportLocalFavoriteGroup)
            "
            @click="importAvatarImportTable"
          >
            {{ t("dialog.avatar_import.import") }}
          </Button>
        </div>
      </div>
      <span v-if="avatarImportDialog.importProgress" class="m-2">
        <Spinner class="inline-block ml-2 mr-2" />
        {{ t("dialog.avatar_import.import_progress") }}
        {{ avatarImportDialog.importProgress }}/{{ avatarImportDialog.importProgressTotal }}
      </span>
      <br />
      <template v-if="avatarImportDialog.errors">
        <Button size="sm" variant="secondary" @click="avatarImportDialog.errors = ''">
          {{ t("dialog.avatar_import.clear_errors") }}
        </Button>
        <h2 class="my-1.5 mx-0 font-bold">
          {{ t("dialog.avatar_import.errors") }}
        </h2>
        <pre class="whitespace-pre-wrap text-xs" v-text="avatarImportDialog.errors"></pre>
      </template>
      <DataTableLayout class="min-w-0 w-full mt-2" :table="table" :loading="avatarImportDialog.loading" :table-style="tableStyle" :show-pagination="false" />
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
import Select from "@/components/ui/select/Select.vue";
import SelectContent from "@/components/ui/select/SelectContent.vue";
import SelectGroup from "@/components/ui/select/SelectGroup.vue";
import SelectItem from "@/components/ui/select/SelectItem.vue";
import SelectTrigger from "@/components/ui/select/SelectTrigger.vue";
import SelectValue from "@/components/ui/select/SelectValue.vue";
import Dialog from "@/components/ui/dialog/Dialog.vue";
import DialogContent from "@/components/ui/dialog/DialogContent.vue";
import DialogHeader from "@/components/ui/dialog/DialogHeader.vue";
import DialogTitle from "@/components/ui/dialog/DialogTitle.vue";
import { computed, ref, watch } from "vue";
import Button from "@/components/ui/button/Button.vue";
import DataTableLayout from "@/components/ui/data-table/DataTableLayout.vue";
import InputGroupTextareaField from "@/components/ui/input-group/InputGroupTextareaField.vue";
import Spinner from "@/components/ui/spinner/Spinner.vue";
import { storeToRefs } from "pinia";
import { useI18n } from "vue-i18n";

import { useFavoriteStore } from "../../../stores/favorite";
import type { FavoriteGroupSlot } from "../../../stores/favorite-types";
import { useGalleryStore } from "../../../stores/gallery";
import { addLocalAvatarFavorite } from "../../../coordinators/favorite-coordinator";
import { showAvatarDialog, applyAvatar } from "../../../coordinators/avatar-coordinator";
import { showUserDialog } from "../../../coordinators/user-coordinator";
import { avatarRequest } from "../../../api/avatar";
import { favoriteRequest } from "../../../api/favorite";
import { createColumns } from "./avatar-import-columns.tsx";
import { removeFromArray } from "../../../shared/utils/base/array";
import type { AvatarRef } from "../../../shared/utils/avatar-transforms";
import { useVrcxVueTable } from "../../../lib/table/use-vrcx-vue-table";
import { logFailure } from "../../../stores/log-failure";

type AvatarImportDialogState = {
  loading: boolean;
  progress: number;
  progressTotal: number;
  input: string;
  avatarIdList: Set<string>;
  errors: string;
  avatarImportFavoriteGroup: FavoriteGroupSlot | null;
  avatarImportLocalFavoriteGroup: string | null;
  importProgress: number;
  importProgressTotal: number;
};

const emit = defineEmits<{
  "update:avatarImportDialogInput": [value: string];
}>();
const { t } = useI18n();

const { favoriteAvatarGroups, avatarImportDialogInput, avatarImportDialogVisible, localAvatarFavoriteGroups } = storeToRefs(useFavoriteStore());
const { localAvatarFavGroupLength, getCachedFavoritesByObjectId } = useFavoriteStore();
const { showFullscreenImageDialog } = useGalleryStore();

const avatarImportDialog = ref<AvatarImportDialogState>({
  loading: false,
  progress: 0,
  progressTotal: 0,
  input: "",
  avatarIdList: new Set<string>(),
  errors: "",
  avatarImportFavoriteGroup: null,
  avatarImportLocalFavoriteGroup: null,
  importProgress: 0,
  importProgressTotal: 0,
});

const avatarImportFavoriteGroupSelection = ref("");
const avatarImportLocalFavoriteGroupSelection = ref("");

const avatarImportTable = ref<{ data: AvatarRef[]; layout: string }>({
  data: [],
  layout: "table",
});

const tableStyle = { maxHeight: "400px" };

const rows = computed(() => avatarImportTable.value.data.slice());

const columns = computed(() =>
  createColumns({
    onShowAvatar: showAvatarDialog,
    onShowUser: showUserDialog,
    onShowFullscreenImage: showFullscreenImageDialog,
    onDelete: deleteItemAvatarImport,
  })
);

const { table } = useVrcxVueTable({
  persistKey: "avatarImportDialog",
  get data() {
    return rows.value;
  },
  columns: columns.value,
  getRowId: (row) => row.id,
  enablePagination: false,
  enableSorting: false,
});

const isLoading = () => avatarImportDialog.value.loading;

const isVisible = computed({
  get() {
    return avatarImportDialogVisible.value;
  },
  set(isOpen: boolean) {
    avatarImportDialogVisible.value = isOpen;
  },
});

watch(
  () => avatarImportDialogVisible.value,
  (isOpen) => {
    if (isOpen) {
      clearAvatarImportTable();
      resetAvatarImport();
      if (avatarImportDialogInput.value) {
        avatarImportDialog.value.input = avatarImportDialogInput.value;
        void processAvatarImportList().catch(logFailure("Avatar import list"));
        emit("update:avatarImportDialogInput", "");
      }
    }
  }
);

async function processAvatarImportList() {
  const D = avatarImportDialog.value;
  D.loading = true;
  const regexAvatarId = /avtr_[0-9A-Fa-f]{8}-([0-9A-Fa-f]{4}-){3}[0-9A-Fa-f]{12}/g;
  const avatarIdList = new Set<string>();
  let match = regexAvatarId.exec(D.input);
  while (match !== null) {
    avatarIdList.add(match[0]);
    match = regexAvatarId.exec(D.input);
  }
  D.input = "";
  D.errors = "";
  D.progress = 0;
  D.progressTotal = avatarIdList.size;
  const data = Array.from(avatarIdList);
  for (const avatarId of data) {
    if (!isVisible.value) {
      resetAvatarImport();
    }
    if (!isLoading() || !isVisible.value) {
      break;
    }
    if (!D.avatarIdList.has(avatarId)) {
      try {
        const args = await avatarRequest.getAvatar({
          avatarId,
        });
        const avatarRef = applyAvatar(args.json);
        avatarImportTable.value.data.push(avatarRef);
        D.avatarIdList.add(avatarId);
      } catch (err) {
        D.errors = D.errors.concat(`AvatarId: ${avatarId}\n${String(err)}\n\n`);
      }
    }
    D.progress++;
  }
  D.loading = false;
  D.progress = 0;
  D.progressTotal = 0;
}

function deleteItemAvatarImport(item: AvatarRef) {
  removeFromArray(avatarImportTable.value.data, item);
  avatarImportDialog.value.avatarIdList.delete(item.id);
}

function resetAvatarImport() {
  avatarImportDialog.value.input = "";
  avatarImportDialog.value.errors = "";
}

function clearAvatarImportTable() {
  avatarImportTable.value.data = [];
  avatarImportDialog.value.avatarIdList = new Set<string>();
}

function selectAvatarImportGroup(group: FavoriteGroupSlot | null) {
  avatarImportDialog.value.avatarImportLocalFavoriteGroup = null;
  avatarImportDialog.value.avatarImportFavoriteGroup = group;
  avatarImportFavoriteGroupSelection.value = group?.name ?? "";
  avatarImportLocalFavoriteGroupSelection.value = "";
}

function selectAvatarImportLocalGroup(group: string | null) {
  avatarImportDialog.value.avatarImportFavoriteGroup = null;
  avatarImportDialog.value.avatarImportLocalFavoriteGroup = group;
  avatarImportFavoriteGroupSelection.value = "";
  avatarImportLocalFavoriteGroupSelection.value = group ?? "";
}

function handleAvatarImportGroupSelect(value: unknown) {
  const selectedValue = String(value);
  avatarImportFavoriteGroupSelection.value = selectedValue;
  const group = favoriteAvatarGroups.value.find((g) => g.name === selectedValue) ?? null;
  selectAvatarImportGroup(group);
}

function handleAvatarImportLocalGroupSelect(value: unknown) {
  const selectedValue = String(value);
  avatarImportLocalFavoriteGroupSelection.value = selectedValue;
  selectAvatarImportLocalGroup(selectedValue || null);
}

function cancelAvatarImport() {
  avatarImportDialog.value.loading = false;
}

function addFavoriteAvatar(avatar: AvatarRef, group: FavoriteGroupSlot) {
  return favoriteRequest.addFavorite({
    type: group.type,
    favoriteId: avatar.id,
    tags: group.name,
  });
}

async function importAvatarImportTable() {
  const D = avatarImportDialog.value;
  if (!D.avatarImportFavoriteGroup && !D.avatarImportLocalFavoriteGroup) {
    return;
  }
  D.loading = true;
  const data = [...avatarImportTable.value.data];
  D.importProgressTotal = data.length;
  let current: AvatarRef | null = null;
  try {
    for (const item of data) {
      if (!isLoading() || !isVisible.value) {
        break;
      }
      current = item;
      if (D.avatarImportFavoriteGroup) {
        if (getCachedFavoritesByObjectId(item.id)) {
          throw new Error("Avatar is already in favorites");
        }
        await addFavoriteAvatar(item, D.avatarImportFavoriteGroup);
      } else if (D.avatarImportLocalFavoriteGroup) {
        addLocalAvatarFavorite(item.id, D.avatarImportLocalFavoriteGroup);
      }
      removeFromArray(avatarImportTable.value.data, item);
      D.avatarIdList.delete(item.id);
      D.importProgress++;
    }
  } catch (err) {
    D.errors = `Name: ${current?.name}\nAvatarId: ${current?.id}\n${String(err)}\n\n`;
  } finally {
    D.importProgress = 0;
    D.importProgressTotal = 0;
    D.loading = false;
  }
}
</script>
