<template>
  <Dialog v-model:open="isVisible">
    <DialogContent class="sm:max-w-xl">
      <DialogHeader>
        <DialogTitle>{{ t("dialog.world_import.header") }}</DialogTitle>
      </DialogHeader>
      <div class="flex items-center justify-between">
        <div class="text-xs">{{ t("dialog.world_import.description") }}</div>
        <div class="flex items-center">
          <div v-if="worldImportDialog.progress">
            {{ t("dialog.world_import.process_progress") }}
            {{ worldImportDialog.progress }} / {{ worldImportDialog.progressTotal }}
            <Spinner class="inline-block ml-2 mr-2" />
          </div>
          <Button v-if="worldImportDialog.loading" size="sm" variant="outline" @click="cancelWorldImport">
            {{ t("dialog.world_import.cancel") }}
          </Button>
          <Button v-else size="sm" :disabled="!worldImportDialog.input" @click="processWorldImportList">
            {{ t("dialog.world_import.process_list") }}
          </Button>
        </div>
      </div>
      <InputGroupTextareaField v-model="worldImportDialog.input" :rows="10" input-class="resize-none mt-2" />
      <div>
        <div class="mb-2">
          <div class="flex items-center gap-2">
            <Select :model-value="worldImportFavoriteGroupSelection" @update:model-value="handleWorldImportGroupSelect">
              <SelectTrigger size="sm">
                <SelectValue :placeholder="t('dialog.world_import.select_vrchat_group_placeholder')" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem
                    v-for="groupAPI in favoriteWorldGroups"
                    :key="groupAPI.name"
                    :value="groupAPI.name"
                    :disabled="groupAPI.count >= groupAPI.capacity"
                  >
                    {{ groupAPI.displayName }} ({{ groupAPI.count }}/{{ groupAPI.capacity }})
                  </SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>

            <Select class="ml-2" :model-value="worldImportLocalFavoriteGroupSelection" @update:model-value="handleWorldImportLocalGroupSelect">
              <SelectTrigger size="sm">
                <SelectValue :placeholder="t('dialog.world_import.select_local_group_placeholder')" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem v-for="group in localWorldFavoriteGroups" :key="group" :value="group">
                    {{ group }} ({{ localWorldFavGroupLength(group) }})
                  </SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
          <span v-if="worldImportDialog.worldImportFavoriteGroup" class="ml-1.5">
            {{ worldImportTable.data.length }} /
            {{ worldImportDialog.worldImportFavoriteGroup.capacity - worldImportDialog.worldImportFavoriteGroup.count }}
          </span>
        </div>
        <div>
          <Button size="sm" variant="secondary" class="mr-2" :disabled="worldImportTable.data.length === 0" @click="clearWorldImportTable">
            {{ t("dialog.world_import.clear_table") }}
          </Button>
          <Button
            size="sm"
            :disabled="worldImportTable.data.length === 0 || (!worldImportDialog.worldImportFavoriteGroup && !worldImportDialog.worldImportLocalFavoriteGroup)"
            @click="importWorldImportTable"
          >
            {{ t("dialog.world_import.import") }}
          </Button>
        </div>
      </div>
      <span v-if="worldImportDialog.importProgress" class="m-2">
        <Spinner class="inline-block ml-2 mr-2" />
        {{ t("dialog.world_import.import_progress") }}
        {{ worldImportDialog.importProgress }}/{{ worldImportDialog.importProgressTotal }}
      </span>
      <br />
      <template v-if="worldImportDialog.errors">
        <Button size="sm" variant="secondary" @click="worldImportDialog.errors = ''">
          {{ t("dialog.world_import.clear_errors") }}
        </Button>
        <h2 class="my-1.5 mx-0 font-bold">
          {{ t("dialog.world_import.errors") }}
        </h2>
        <pre class="whitespace-pre-wrap text-xs" v-text="worldImportDialog.errors"></pre>
      </template>
      <DataTableLayout class="min-w-0 w-full mt-2" :table="table" :loading="worldImportDialog.loading" :table-style="tableStyle" :show-pagination="false" />
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
import { showWorldDialog } from "../../../coordinators/world-coordinator";
import { addLocalWorldFavorite } from "../../../coordinators/favorite-coordinator";
import { showUserDialog } from "../../../coordinators/user-coordinator";
import { favoriteRequest } from "../../../api/favorite";
import { worldRequest } from "../../../api/world";
import { createColumns } from "./world-import-columns.tsx";
import { removeFromArray } from "../../../shared/utils/base/array";
import type { WorldRef } from "../../../shared/utils/world-transforms";
import { useVrcxVueTable } from "../../../lib/table/use-vrcx-vue-table";
import { logFailure } from "../../../stores/log-failure";

type WorldImportDialogState = {
  loading: boolean;
  progress: number;
  progressTotal: number;
  input: string;
  worldIdList: Set<string>;
  errors: string;
  worldImportFavoriteGroup: FavoriteGroupSlot | null;
  worldImportLocalFavoriteGroup: string | null;
  importProgress: number;
  importProgressTotal: number;
};

const { favoriteWorldGroups, worldImportDialogInput, worldImportDialogVisible, localWorldFavoriteGroups } = storeToRefs(useFavoriteStore());
const { localWorldFavGroupLength, getCachedFavoritesByObjectId } = useFavoriteStore();

const { showFullscreenImageDialog } = useGalleryStore();

const emit = defineEmits<{
  "update:worldImportDialogInput": [value: string];
}>();

const { t } = useI18n();

const worldImportDialog = ref<WorldImportDialogState>({
  loading: false,
  progress: 0,
  progressTotal: 0,
  input: "",
  worldIdList: new Set<string>(),
  errors: "",
  worldImportFavoriteGroup: null,
  worldImportLocalFavoriteGroup: null,
  importProgress: 0,
  importProgressTotal: 0,
});

const worldImportFavoriteGroupSelection = ref("");
const worldImportLocalFavoriteGroupSelection = ref("");

const worldImportTable = ref<{ data: WorldRef[]; layout: string }>({
  data: [],
  layout: "table",
});

const tableStyle = { maxHeight: "400px" };

const rows = computed(() => worldImportTable.value.data.slice());

const columns = computed(() =>
  createColumns({
    onShowWorld: showWorldDialog,
    onShowUser: showUserDialog,
    onShowFullscreenImage: showFullscreenImageDialog,
    onDelete: deleteItemWorldImport,
  })
);

const { table } = useVrcxVueTable({
  persistKey: "worldImportDialog",
  get data() {
    return rows.value;
  },
  columns: columns.value,
  getRowId: (row) => row.id,
  enablePagination: false,
  enableSorting: false,
});

const isLoading = () => worldImportDialog.value.loading;

const isVisible = computed({
  get() {
    return worldImportDialogVisible.value;
  },
  set(isOpen: boolean) {
    worldImportDialogVisible.value = isOpen;
  },
});

watch(
  () => worldImportDialogVisible.value,
  (isOpen) => {
    if (isOpen) {
      clearWorldImportTable();
      resetWorldImport();
      if (worldImportDialogInput.value) {
        worldImportDialog.value.input = worldImportDialogInput.value;
        void processWorldImportList().catch(logFailure("World import list"));
        emit("update:worldImportDialogInput", "");
      }
    }
  }
);

function resetWorldImport() {
  worldImportDialog.value.input = "";
  worldImportDialog.value.errors = "";
}

async function processWorldImportList() {
  const D = worldImportDialog.value;
  D.loading = true;
  const regexWorldId = /wrld_[0-9A-Fa-f]{8}-([0-9A-Fa-f]{4}-){3}[0-9A-Fa-f]{12}/g;
  const worldIdList = new Set<string>();
  let match = regexWorldId.exec(D.input);
  while (match !== null) {
    worldIdList.add(match[0]);
    match = regexWorldId.exec(D.input);
  }
  D.input = "";
  D.errors = "";
  D.progress = 0;
  D.progressTotal = worldIdList.size;
  const data = Array.from(worldIdList);
  for (const worldId of data) {
    if (!isVisible.value) {
      resetWorldImport();
    }
    if (!isLoading() || !isVisible.value) {
      break;
    }
    if (!D.worldIdList.has(worldId)) {
      try {
        const args = await worldRequest.getWorld({
          worldId,
        });
        worldImportTable.value.data.push(args.ref);
        D.worldIdList.add(worldId);
      } catch (err) {
        D.errors = D.errors.concat(`WorldId: ${worldId}\n${String(err)}\n\n`);
      }
    }
    D.progress++;
  }
  D.loading = false;
  D.progress = 0;
  D.progressTotal = 0;
}

function deleteItemWorldImport(item: WorldRef) {
  removeFromArray(worldImportTable.value.data, item);
  worldImportDialog.value.worldIdList.delete(item.id);
}

function clearWorldImportTable() {
  worldImportTable.value.data = [];
  worldImportDialog.value.worldIdList = new Set<string>();
}

function selectWorldImportGroup(group: FavoriteGroupSlot | null) {
  worldImportDialog.value.worldImportLocalFavoriteGroup = null;
  worldImportDialog.value.worldImportFavoriteGroup = group;
  worldImportFavoriteGroupSelection.value = group?.name ?? "";
  worldImportLocalFavoriteGroupSelection.value = "";
}

function selectWorldImportLocalGroup(group: string | null) {
  worldImportDialog.value.worldImportFavoriteGroup = null;
  worldImportDialog.value.worldImportLocalFavoriteGroup = group;
  worldImportFavoriteGroupSelection.value = "";
  worldImportLocalFavoriteGroupSelection.value = group ?? "";
}

function handleWorldImportGroupSelect(value: unknown) {
  const selectedValue = String(value);
  worldImportFavoriteGroupSelection.value = selectedValue;
  const group = favoriteWorldGroups.value.find((g) => g.name === selectedValue) ?? null;
  selectWorldImportGroup(group);
}

function handleWorldImportLocalGroupSelect(value: unknown) {
  const selectedValue = String(value);
  worldImportLocalFavoriteGroupSelection.value = selectedValue;
  selectWorldImportLocalGroup(selectedValue || null);
}

function cancelWorldImport() {
  worldImportDialog.value.loading = false;
}

async function importWorldImportTable() {
  const D = worldImportDialog.value;
  if (!D.worldImportFavoriteGroup && !D.worldImportLocalFavoriteGroup) {
    return;
  }
  D.loading = true;
  const data = [...worldImportTable.value.data];
  D.importProgressTotal = data.length;
  let current: WorldRef | null = null;
  try {
    for (const item of data) {
      if (!isLoading() || !isVisible.value) {
        break;
      }
      current = item;
      if (D.worldImportFavoriteGroup) {
        if (getCachedFavoritesByObjectId(item.id)) {
          throw new Error("World is already in favorites");
        }
        await addFavoriteWorld(item, D.worldImportFavoriteGroup);
      } else if (D.worldImportLocalFavoriteGroup) {
        addLocalWorldFavorite(item.id, D.worldImportLocalFavoriteGroup);
      }
      removeFromArray(worldImportTable.value.data, item);
      D.worldIdList.delete(item.id);
      D.importProgress++;
    }
  } catch (err) {
    D.errors = `Name: ${current?.name}\nWorldId: ${current?.id}\n${String(err)}\n\n`;
  } finally {
    D.importProgress = 0;
    D.importProgressTotal = 0;
    D.loading = false;
  }
}

function addFavoriteWorld(world: WorldRef, group: FavoriteGroupSlot) {
  return favoriteRequest.addFavorite({
    type: group.type,
    favoriteId: world.id,
    tags: group.name,
  });
}
</script>
