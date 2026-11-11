<template>
  <Dialog v-model:open="isDialogVisible">
    <DialogContent class="sm:max-w-xl">
      <DialogHeader>
        <DialogTitle>{{ t("dialog.world_export.header") }}</DialogTitle>
      </DialogHeader>

      <div class="flex flex-col gap-2 mb-2">
        <label v-for="option in exportSelectOptions" :key="option.value" class="inline-flex items-center gap-2">
          <Checkbox :model-value="exportSelectedOptions.includes(option.label)" @update:model-value="(val) => toggleWorldExportOption(option.label, val)" />
          <span>{{ option.label }}</span>
        </label>
      </div>

      <div class="flex items-center gap-2">
        <Select :model-value="worldExportFavoriteGroupSelection" @update:model-value="handleWorldExportGroupSelect">
          <SelectTrigger size="sm">
            <SelectValue :placeholder="t('dialog.world_export.all_favorites')" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectItem :value="WORLD_EXPORT_ALL_VALUE">{{ t("dialog.world_export.all_favorites") }}</SelectItem>
              <SelectItem v-for="groupAPI in favoriteWorldGroups" :key="groupAPI.name" :value="groupAPI.name">
                {{ groupAPI.displayName }} ({{ groupAPI.count }}/{{ groupAPI.capacity }})
              </SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>

        <Select class="ml-2" :model-value="worldExportLocalFavoriteGroupSelection" @update:model-value="handleWorldExportLocalGroupSelect">
          <SelectTrigger size="sm">
            <SelectValue :placeholder="t('dialog.world_export.select_group')" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectItem :value="WORLD_EXPORT_NONE_VALUE">{{ t("dialog.gallery_select.none") }}</SelectItem>
              <SelectItem v-for="group in localWorldFavoriteGroups" :key="group" :value="group">
                {{ group }} ({{ localWorldFavGroupLength(group) }})
              </SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>

      <br />

      <InputGroupTextareaField v-model="worldExportContent" :rows="15" readonly input-class="resize-none mt-4" @click="handleCopyWorldExportData" />
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
import Checkbox from "@/components/ui/checkbox/Checkbox.vue";
import InputGroupTextareaField from "@/components/ui/input-group/InputGroupTextareaField.vue";
import { storeToRefs } from "pinia";
import { toast } from "vue-sonner";
import { useI18n } from "vue-i18n";

import { useFavoriteStore } from "../../../stores/favorite";
import type { FavoriteGroupSlot } from "../../../stores/favorite-types";
import { useWorldStore } from "../../../stores/world";
import { formatCsvRow } from "../../../shared/utils/csv";

const props = defineProps<{
  worldExportDialogVisible: boolean;
}>();

const emit = defineEmits<{
  "update:worldExportDialogVisible": [value: boolean];
}>();

const { t } = useI18n();

const { favoriteWorlds, favoriteWorldGroups, localWorldFavorites, localWorldFavoritesList, localWorldFavoriteGroups } = storeToRefs(useFavoriteStore());
const { localWorldFavGroupLength } = useFavoriteStore();
const { cachedWorlds } = useWorldStore();

const worldExportContent = ref("");
const worldExportFavoriteGroup = ref<FavoriteGroupSlot | null>(null);
const worldExportLocalFavoriteGroup = ref<string | null>(null);

const WORLD_EXPORT_ALL_VALUE = "__all__";
const WORLD_EXPORT_NONE_VALUE = "__none__";

const worldExportFavoriteGroupSelection = ref(WORLD_EXPORT_ALL_VALUE);
const worldExportLocalFavoriteGroupSelection = ref(WORLD_EXPORT_NONE_VALUE);

const exportSelectedOptions = ref(["ID", "Name"]);
const exportSelectOptions = ref([
  { label: "ID", value: "id" },
  { label: "Name", value: "name" },
  { label: "Author ID", value: "authorId" },
  { label: "Author Name", value: "authorName" },
  { label: "Thumbnail", value: "thumbnailImageUrl" },
]);

function toggleWorldExportOption(label: string, checked: boolean | "indeterminate") {
  const selection = exportSelectedOptions.value;
  const index = selection.indexOf(label);
  if (checked && index === -1) {
    selection.push(label);
  } else if (!checked && index !== -1) {
    selection.splice(index, 1);
  }
  updateWorldExportDialog();
}

const isDialogVisible = computed({
  get() {
    return props.worldExportDialogVisible;
  },
  set(isOpen: boolean) {
    emit("update:worldExportDialogVisible", isOpen);
  },
});

watch(
  () => props.worldExportDialogVisible,
  (isOpen) => {
    if (isOpen) {
      showWorldExportDialog();
    }
  }
);

function showWorldExportDialog() {
  worldExportFavoriteGroup.value = null;
  worldExportLocalFavoriteGroup.value = null;
  worldExportFavoriteGroupSelection.value = WORLD_EXPORT_ALL_VALUE;
  worldExportLocalFavoriteGroupSelection.value = WORLD_EXPORT_NONE_VALUE;
  updateWorldExportDialog();
}

function handleWorldExportGroupSelect(value: unknown) {
  const selectedValue = String(value);
  worldExportFavoriteGroupSelection.value = selectedValue;
  if (selectedValue === WORLD_EXPORT_ALL_VALUE) {
    selectWorldExportGroup(null);
    return;
  }
  const group = favoriteWorldGroups.value.find((g) => g.name === selectedValue) ?? null;
  selectWorldExportGroup(group);
}

function handleWorldExportLocalGroupSelect(value: unknown) {
  const selectedValue = String(value);
  worldExportLocalFavoriteGroupSelection.value = selectedValue;
  if (selectedValue === WORLD_EXPORT_NONE_VALUE) {
    selectWorldExportLocalGroup(null);
    return;
  }
  selectWorldExportLocalGroup(selectedValue);
}

function handleCopyWorldExportData(event: MouseEvent) {
  if (event.target instanceof HTMLTextAreaElement) {
    event.target.select();
  }
  void navigator.clipboard
    .writeText(worldExportContent.value)
    .then(() => {
      toast.success("Copied successfully!", { duration: 2000 });
    })
    .catch((err: unknown) => {
      console.error("Copy failed:", err);
      toast.error("Copy failed!");
    });
}

function updateWorldExportDialog() {
  const propsForQuery = exportSelectOptions.value.filter((option) => exportSelectedOptions.value.includes(option.label)).map((option) => option.value);

  const lines = [exportSelectedOptions.value.join(",")];

  if (worldExportFavoriteGroup.value) {
    favoriteWorldGroups.value.forEach((group) => {
      if (worldExportFavoriteGroup.value === group) {
        favoriteWorlds.value.forEach((ref) => {
          if (group.key === ref.groupKey) {
            lines.push(formatCsvRow(ref.ref, propsForQuery));
          }
        });
      }
    });
  } else if (worldExportLocalFavoriteGroup.value) {
    const favoriteGroup = localWorldFavorites.value[worldExportLocalFavoriteGroup.value];
    if (!favoriteGroup) {
      return;
    }
    for (const ref of favoriteGroup) {
      lines.push(formatCsvRow(ref, propsForQuery));
    }
  } else {
    favoriteWorlds.value.forEach((ref) => {
      lines.push(formatCsvRow(ref.ref, propsForQuery));
    });
    for (const worldId of localWorldFavoritesList.value) {
      const ref = cachedWorlds.get(worldId);
      if (typeof ref !== "undefined") {
        lines.push(formatCsvRow(ref, propsForQuery));
      }
    }
  }
  worldExportContent.value = lines.reverse().join("\n");
}

function selectWorldExportGroup(group: FavoriteGroupSlot | null) {
  worldExportFavoriteGroup.value = group;
  worldExportLocalFavoriteGroup.value = null;
  worldExportFavoriteGroupSelection.value = group?.name ?? WORLD_EXPORT_ALL_VALUE;
  worldExportLocalFavoriteGroupSelection.value = WORLD_EXPORT_NONE_VALUE;
  updateWorldExportDialog();
}

function selectWorldExportLocalGroup(group: string | null) {
  worldExportLocalFavoriteGroup.value = group;
  worldExportFavoriteGroup.value = null;
  worldExportLocalFavoriteGroupSelection.value = group ?? WORLD_EXPORT_NONE_VALUE;
  worldExportFavoriteGroupSelection.value = WORLD_EXPORT_ALL_VALUE;
  updateWorldExportDialog();
}
</script>
