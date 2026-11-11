<template>
  <Dialog v-model:open="isVisible">
    <DialogContent class="sm:max-w-xl">
      <DialogHeader>
        <DialogTitle>{{ t("dialog.friend_import.header") }}</DialogTitle>
      </DialogHeader>
      <div class="flex items-center justify-between">
        <div class="text-xs">{{ t("dialog.friend_import.description") }}</div>
        <div class="flex items-center">
          <div v-if="friendImportDialog.progress">
            {{ t("dialog.friend_import.process_progress") }} {{ friendImportDialog.progress }} /
            {{ friendImportDialog.progressTotal }}
            <Spinner class="inline-block ml-1 mr-1" />
          </div>
          <Button v-if="friendImportDialog.loading" size="sm" variant="secondary" @click="cancelFriendImport">
            {{ t("dialog.friend_import.cancel") }}
          </Button>
          <Button v-else size="sm" :disabled="!friendImportDialog.input" @click="processFriendImportList">
            {{ t("dialog.friend_import.process_list") }}
          </Button>
        </div>
      </div>
      <InputGroupTextareaField v-model="friendImportDialog.input" :rows="10" input-class="resize-none mt-2" />
      <div>
        <div class="mb-2">
          <div class="flex items-center gap-2">
            <Select :model-value="friendImportFavoriteGroupSelection" @update:model-value="handleFriendImportGroupSelect">
              <SelectTrigger size="sm">
                <SelectValue :placeholder="t('dialog.friend_import.select_group_placeholder')" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem
                    v-for="groupAPI in favoriteFriendGroups"
                    :key="groupAPI.name"
                    :value="groupAPI.name"
                    :disabled="groupAPI.count >= groupAPI.capacity"
                  >
                    {{ groupAPI.displayName }} ({{ groupAPI.count }}/{{ groupAPI.capacity }})
                  </SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>

            <Select class="ml-2" :model-value="friendImportLocalFavoriteGroupSelection" @update:model-value="handleFriendImportLocalGroupSelect">
              <SelectTrigger size="sm">
                <SelectValue :placeholder="t('dialog.world_import.select_local_group_placeholder')" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem v-for="group in localFriendFavoriteGroups" :key="group" :value="group">
                    {{ group }} ({{ localFriendFavGroupLength(group) }})
                  </SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
          <span v-if="friendImportDialog.friendImportFavoriteGroup" class="ml-1.5">
            {{ friendImportTable.data.length }} /
            {{ friendImportDialog.friendImportFavoriteGroup.capacity - friendImportDialog.friendImportFavoriteGroup.count }}
          </span>
        </div>
        <div>
          <Button size="sm" class="mr-2" variant="secondary" :disabled="friendImportTable.data.length === 0" @click="clearFriendImportTable">
            {{ t("dialog.friend_import.clear_table") }}
          </Button>
          <Button
            size="sm"
            :disabled="
              friendImportTable.data.length === 0 || (!friendImportDialog.friendImportFavoriteGroup && !friendImportDialog.friendImportLocalFavoriteGroup)
            "
            @click="importFriendImportTable"
          >
            {{ t("dialog.friend_import.import") }}
          </Button>
        </div>
      </div>
      <span v-if="friendImportDialog.importProgress" class="m-2">
        <Spinner class="inline-block ml-2 mr-2" />
        {{ t("dialog.friend_import.import_progress") }} {{ friendImportDialog.importProgress }}/{{ friendImportDialog.importProgressTotal }}
      </span>
      <br />
      <template v-if="friendImportDialog.errors">
        <Button size="sm" variant="secondary" @click="friendImportDialog.errors = ''">
          {{ t("dialog.friend_import.clear_errors") }}
        </Button>
        <h2 class="my-1.5 mx-0 font-bold">{{ t("dialog.friend_import.errors") }}</h2>
        <pre class="whitespace-pre-wrap text-xs" v-text="friendImportDialog.errors"></pre>
      </template>
      <DataTableLayout class="min-w-0 w-full mt-2" :table="table" :loading="friendImportDialog.loading" :table-style="tableStyle" :show-pagination="false" />
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

import { removeFromArray } from "../../../shared/utils/base/array";
import { useUserDisplay } from "../../../composables/use-user-display";
import { useFavoriteStore } from "../../../stores/favorite";
import type { FavoriteGroupSlot } from "../../../stores/favorite-types";
import { useGalleryStore } from "../../../stores/gallery";
import { logFailure } from "../../../stores/log-failure";
import { addLocalFriendFavorite } from "../../../coordinators/favorite-coordinator";
import { favoriteRequest } from "../../../api/favorite";
import { userRequest } from "../../../api/user";
import { createColumns } from "./friend-import-columns.tsx";
import { useVrcxVueTable } from "../../../lib/table/use-vrcx-vue-table";
import { showUserDialog } from "../../../coordinators/user-coordinator";
import type { VrcxUser } from "../../../types/vrcx";

type FriendImportDialogState = {
  loading: boolean;
  progress: number;
  progressTotal: number;
  input: string;
  userIdList: Set<string>;
  errors: string;
  friendImportFavoriteGroup: FavoriteGroupSlot | null;
  friendImportLocalFavoriteGroup: string | null;
  importProgress: number;
  importProgressTotal: number;
};

const { userImage, userImageFull } = useUserDisplay();
const { t } = useI18n();

const emit = defineEmits<{
  "update:friendImportDialogInput": [value: string];
}>();

const { favoriteFriendGroups, friendImportDialogInput, friendImportDialogVisible, localFriendFavoriteGroups } = storeToRefs(useFavoriteStore());
const { showFullscreenImageDialog } = useGalleryStore();
const { getCachedFavoritesByObjectId, localFriendFavGroupLength } = useFavoriteStore();

const friendImportDialog = ref<FriendImportDialogState>({
  loading: false,
  progress: 0,
  progressTotal: 0,
  input: "",
  userIdList: new Set<string>(),
  errors: "",
  friendImportFavoriteGroup: null,
  friendImportLocalFavoriteGroup: null,
  importProgress: 0,
  importProgressTotal: 0,
});

const friendImportFavoriteGroupSelection = ref("");
const friendImportLocalFavoriteGroupSelection = ref("");

const friendImportTable = ref<{ data: VrcxUser[]; layout: string }>({
  data: [],
  layout: "table",
});

const tableStyle = { maxHeight: "400px" };

const rows = computed(() => friendImportTable.value.data.slice());

const columns = computed(() =>
  createColumns({
    userImage,
    userImageFull,
    onShowFullscreenImage: showFullscreenImageDialog,
    onShowUser: showUserDialog,
    onDelete: deleteItemFriendImport,
  })
);

const { table } = useVrcxVueTable({
  persistKey: "friendImportDialog",
  get data() {
    return rows.value;
  },
  columns: columns.value,
  getRowId: (row) => row.id,
  enablePagination: false,
  enableSorting: false,
});

const isLoading = () => friendImportDialog.value.loading;

const isVisible = computed({
  get() {
    return friendImportDialogVisible.value;
  },
  set(isOpen: boolean) {
    friendImportDialogVisible.value = isOpen;
  },
});

watch(
  () => friendImportDialogVisible.value,
  (isOpen) => {
    if (isOpen) {
      clearFriendImportTable();
      resetFriendImport();
      friendImportFavoriteGroupSelection.value = friendImportDialog.value.friendImportFavoriteGroup?.name ?? "";
      if (friendImportDialogInput.value) {
        friendImportDialog.value.input = friendImportDialogInput.value;
        void processFriendImportList().catch(logFailure("Friend import list"));
        emit("update:friendImportDialogInput", "");
      }
    }
  }
);

function handleFriendImportGroupSelect(value: unknown) {
  const selectedValue = String(value);
  friendImportFavoriteGroupSelection.value = selectedValue;
  const group = favoriteFriendGroups.value.find((g) => g.name === selectedValue) ?? null;
  if (group) {
    selectFriendImportGroup(group);
  }
}

function handleFriendImportLocalGroupSelect(value: unknown) {
  const selectedValue = String(value);
  friendImportLocalFavoriteGroupSelection.value = selectedValue;
  selectFriendImportLocalGroup(selectedValue || null);
}

function cancelFriendImport() {
  friendImportDialog.value.loading = false;
}

function deleteItemFriendImport(item: VrcxUser) {
  removeFromArray(friendImportTable.value.data, item);
  friendImportDialog.value.userIdList.delete(item.id);
}

function clearFriendImportTable() {
  friendImportTable.value.data = [];
  friendImportDialog.value.userIdList = new Set<string>();
}

function selectFriendImportGroup(group: FavoriteGroupSlot | null) {
  friendImportDialog.value.friendImportLocalFavoriteGroup = null;
  friendImportDialog.value.friendImportFavoriteGroup = group;
  friendImportFavoriteGroupSelection.value = group?.name ?? "";
  friendImportLocalFavoriteGroupSelection.value = "";
}

function selectFriendImportLocalGroup(group: string | null) {
  friendImportDialog.value.friendImportFavoriteGroup = null;
  friendImportDialog.value.friendImportLocalFavoriteGroup = group;
  friendImportFavoriteGroupSelection.value = "";
  friendImportLocalFavoriteGroupSelection.value = group ?? "";
}

async function importFriendImportTable() {
  const D = friendImportDialog.value;
  if (!D.friendImportFavoriteGroup && !D.friendImportLocalFavoriteGroup) {
    return;
  }
  D.loading = true;
  const data = [...friendImportTable.value.data];
  D.importProgressTotal = data.length;
  let current: VrcxUser | null = null;
  try {
    for (const item of data) {
      if (!isLoading() || !isVisible.value) {
        break;
      }
      current = item;
      if (D.friendImportFavoriteGroup) {
        if (getCachedFavoritesByObjectId(item.id)) {
          throw new Error("Friend is already in favorites");
        }
        await addFavoriteUser(item, D.friendImportFavoriteGroup);
      } else if (D.friendImportLocalFavoriteGroup) {
        addLocalFriendFavorite(item.id, D.friendImportLocalFavoriteGroup);
      }
      removeFromArray(friendImportTable.value.data, item);
      D.userIdList.delete(item.id);
      D.importProgress++;
    }
  } catch (err) {
    D.errors = `Name: ${current?.displayName ?? ""}\nUserId: ${current?.id}\n${String(err)}\n\n`;
  } finally {
    D.importProgress = 0;
    D.importProgressTotal = 0;
    D.loading = false;
  }
}

function addFavoriteUser(user: VrcxUser, group: FavoriteGroupSlot) {
  return favoriteRequest.addFavorite({
    type: group.type,
    favoriteId: user.id,
    tags: group.name,
  });
}

async function processFriendImportList() {
  const D = friendImportDialog.value;
  D.loading = true;
  const regexFriendId = /usr_[0-9A-Fa-f]{8}-([0-9A-Fa-f]{4}-){3}[0-9A-Fa-f]{12}/g;
  const userIdList = new Set<string>();
  let match = regexFriendId.exec(D.input);
  while (match !== null) {
    userIdList.add(match[0]);
    match = regexFriendId.exec(D.input);
  }
  D.input = "";
  D.errors = "";
  D.progress = 0;
  D.progressTotal = userIdList.size;
  const data = Array.from(userIdList);
  for (const userId of data) {
    if (!isVisible.value) {
      resetFriendImport();
    }
    if (!isLoading() || !isVisible.value) {
      break;
    }
    if (!D.userIdList.has(userId)) {
      try {
        const args = await userRequest.getUser({
          userId,
        });
        friendImportTable.value.data.push(args.ref);
        D.userIdList.add(userId);
      } catch (err) {
        D.errors = D.errors.concat(`UserId: ${userId}\n${String(err)}\n\n`);
      }
    }
    D.progress++;
  }
  D.loading = false;
  D.progress = 0;
  D.progressTotal = 0;
}

function resetFriendImport() {
  friendImportDialog.value.input = "";
  friendImportDialog.value.errors = "";
}
</script>
