<template>
  <Dialog v-model:open="isDialogVisible">
    <DialogContent class="sm:max-w-xl">
      <DialogHeader>
        <DialogTitle>{{ t("dialog.friend_export.header") }}</DialogTitle>
      </DialogHeader>
      <Select :model-value="friendExportFavoriteGroupSelection" @update:model-value="handleFriendExportGroupSelect">
        <SelectTrigger size="sm">
          <SelectValue :placeholder="t('dialog.friend_export.all_favorites')" />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectItem :value="FRIEND_EXPORT_ALL_VALUE">{{ t("dialog.friend_export.all_favorites") }}</SelectItem>
            <SelectItem v-for="groupAPI in favoriteFriendGroups" :key="groupAPI.name" :value="groupAPI.name">
              {{ groupAPI.displayName }} ({{ groupAPI.count }}/{{ groupAPI.capacity }})
            </SelectItem>
          </SelectGroup>
        </SelectContent>
      </Select>

      <Select class="mt-4" :model-value="friendExportLocalFavoriteGroupSelection" @update:model-value="handleFriendExportLocalGroupSelect">
        <SelectTrigger size="sm">
          <SelectValue :placeholder="t('dialog.friend_export.select_group')" />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectItem :value="FRIEND_EXPORT_NONE_VALUE">{{ t("dialog.gallery_select.none") }}</SelectItem>
            <SelectItem v-for="group in localFriendFavoriteGroups" :key="group" :value="group">
              {{ group }} ({{ localFriendFavGroupLength(group) }})
            </SelectItem>
          </SelectGroup>
        </SelectContent>
      </Select>
      <br />

      <InputGroupTextareaField v-model="friendExportContent" :rows="15" readonly input-class="resize-none mt-4" @click="handleCopyFriendExportData" />
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
import InputGroupTextareaField from "@/components/ui/input-group/InputGroupTextareaField.vue";
import { storeToRefs } from "pinia";
import { toast } from "vue-sonner";
import { useI18n } from "vue-i18n";

import { useFavoriteStore } from "../../../stores/favorite";
import type { FavoriteGroupSlot } from "../../../stores/favorite-types";
import { useUserStore } from "../../../stores/user";
import { formatCsvField } from "../../../shared/utils/csv";

const { t } = useI18n();

const props = defineProps<{
  friendExportDialogVisible: boolean;
}>();

const emit = defineEmits<{
  "update:friendExportDialogVisible": [value: boolean];
}>();

const { favoriteFriends, favoriteFriendGroups, localFriendFavorites, localFriendFavoriteGroups, localFriendFavoritesList } = storeToRefs(useFavoriteStore());
const { localFriendFavGroupLength } = useFavoriteStore();
const { cachedUsers } = storeToRefs(useUserStore());

const friendExportContent = ref("");
const friendExportFavoriteGroup = ref<FavoriteGroupSlot | null>(null);
const friendExportLocalFavoriteGroup = ref<string | null>(null);

const FRIEND_EXPORT_ALL_VALUE = "__all__";
const FRIEND_EXPORT_NONE_VALUE = "__none__";

const friendExportFavoriteGroupSelection = ref(FRIEND_EXPORT_ALL_VALUE);
const friendExportLocalFavoriteGroupSelection = ref(FRIEND_EXPORT_NONE_VALUE);

const isDialogVisible = computed({
  get() {
    return props.friendExportDialogVisible;
  },
  set(isOpen: boolean) {
    emit("update:friendExportDialogVisible", isOpen);
  },
});

watch(
  () => props.friendExportDialogVisible,
  (isOpen) => {
    if (isOpen) {
      showFriendExportDialog();
    }
  }
);

function showFriendExportDialog() {
  friendExportFavoriteGroup.value = null;
  friendExportFavoriteGroupSelection.value = FRIEND_EXPORT_ALL_VALUE;
  updateFriendExportDialog();
}

function handleFriendExportGroupSelect(value: unknown) {
  const selectedValue = String(value);
  friendExportFavoriteGroupSelection.value = selectedValue;
  if (selectedValue === FRIEND_EXPORT_ALL_VALUE) {
    selectFriendExportGroup(null);
    return;
  }
  const group = favoriteFriendGroups.value.find((g) => g.name === selectedValue) ?? null;
  selectFriendExportGroup(group);
}

function handleFriendExportLocalGroupSelect(value: unknown) {
  const selectedValue = String(value);
  friendExportLocalFavoriteGroupSelection.value = selectedValue;
  if (selectedValue === FRIEND_EXPORT_NONE_VALUE) {
    selectFriendExportLocalGroup(null);
    return;
  }
  selectFriendExportLocalGroup(selectedValue);
}

function handleCopyFriendExportData(event: MouseEvent) {
  if (event.target instanceof HTMLTextAreaElement) {
    event.target.select();
  }
  void navigator.clipboard
    .writeText(friendExportContent.value)
    .then(() => {
      toast.success("Copied successfully!", { duration: 2000 });
    })
    .catch((err: unknown) => {
      console.error("Copy failed:", err);
      toast.error("Copy failed!");
    });
}

function updateFriendExportDialog() {
  const lines = ["UserID,Name"];

  if (friendExportFavoriteGroup.value) {
    favoriteFriendGroups.value.forEach((group) => {
      if (friendExportFavoriteGroup.value === group) {
        favoriteFriends.value.forEach((ref) => {
          if (group.key === ref.groupKey) {
            lines.push(`${formatCsvField(ref.id)},${formatCsvField(ref.name)}`);
          }
        });
      }
    });
  } else if (friendExportLocalFavoriteGroup.value) {
    const favoriteGroup = localFriendFavorites.value[friendExportLocalFavoriteGroup.value];
    if (!favoriteGroup) {
      return;
    }
    favoriteGroup.forEach((userId) => {
      const ref = cachedUsers.value.get(userId);
      if (typeof ref !== "undefined") {
        lines.push(`${formatCsvField(ref.id)},${formatCsvField(ref.displayName)}`);
      }
    });
  } else {
    favoriteFriends.value.forEach((ref) => {
      lines.push(`${formatCsvField(ref.id)},${formatCsvField(ref.name)}`);
    });
    for (const userId of localFriendFavoritesList.value) {
      const ref = cachedUsers.value.get(userId);
      if (typeof ref !== "undefined") {
        lines.push(`${formatCsvField(ref.id)},${formatCsvField(ref.displayName)}`);
      }
    }
  }
  friendExportContent.value = lines.reverse().join("\n");
}

function selectFriendExportGroup(group: FavoriteGroupSlot | null) {
  friendExportFavoriteGroup.value = group;
  friendExportLocalFavoriteGroup.value = null;
  friendExportFavoriteGroupSelection.value = group?.name ?? FRIEND_EXPORT_ALL_VALUE;
  friendExportLocalFavoriteGroupSelection.value = FRIEND_EXPORT_NONE_VALUE;
  updateFriendExportDialog();
}

function selectFriendExportLocalGroup(groupName: string | null) {
  friendExportLocalFavoriteGroup.value = groupName;
  friendExportFavoriteGroup.value = null;
  friendExportFavoriteGroupSelection.value = FRIEND_EXPORT_ALL_VALUE;
  friendExportLocalFavoriteGroupSelection.value = groupName ?? FRIEND_EXPORT_NONE_VALUE;
  updateFriendExportDialog();
}
</script>
