<template>
  <Dialog
    :open="setAvatarTagsDialog.visible"
    @update:open="
      (open) => {
        if (!open) closeSetAvatarTagsDialog();
      }
    "
  >
    <DialogContent class="x-dialog sm:max-w-195 gap-1">
      <DialogHeader>
        <DialogTitle>{{ t("dialog.set_avatar_tags.header") }}</DialogTitle>
      </DialogHeader>

      <template v-if="setAvatarTagsDialog.visible">
        <label class="inline-flex items-center gap-2 mt-2">
          <Checkbox :model-value="setAvatarTagsDialog.contentHorror" @update:model-value="(checked) => setContentFlag('contentHorror', checked)" />
          <span>{{ t("dialog.set_avatar_tags.content_horror") }}</span>
        </label>
        <label class="inline-flex items-center gap-2">
          <Checkbox :model-value="setAvatarTagsDialog.contentGore" @update:model-value="(checked) => setContentFlag('contentGore', checked)" />
          <span>{{ t("dialog.set_avatar_tags.content_gore") }}</span>
        </label>
        <label class="inline-flex items-center gap-2">
          <Checkbox :model-value="setAvatarTagsDialog.contentViolence" @update:model-value="(checked) => setContentFlag('contentViolence', checked)" />
          <span>{{ t("dialog.set_avatar_tags.content_violence") }}</span>
        </label>
        <label class="inline-flex items-center gap-2">
          <Checkbox :model-value="setAvatarTagsDialog.contentAdult" @update:model-value="(checked) => setContentFlag('contentAdult', checked)" />
          <span>{{ t("dialog.set_avatar_tags.content_adult") }}</span>
        </label>
        <label class="inline-flex items-center gap-2">
          <Checkbox :model-value="setAvatarTagsDialog.contentSex" @update:model-value="(checked) => setContentFlag('contentSex', checked)" />
          <span>{{ t("dialog.set_avatar_tags.content_sex") }}</span>
        </label>
        <InputGroupTextareaField
          :model-value="setAvatarTagsDialog.selectedTagsCsv"
          :rows="2"
          :placeholder="t('dialog.set_avatar_tags.custom_tags_placeholder')"
          class="mt-2"
          input-class="resize-none"
          @update:model-value="(value) => setSelectedTagsCsv(value)"
          @input="updateInputAvatarTags"
        />
        <template v-if="setAvatarTagsDialog.ownAvatars.length === setAvatarTagsDialog.selectedAvatarIds.length">
          <Button size="sm" variant="outline" @click="setAvatarTagsSelectToggle">{{ t("dialog.set_avatar_tags.select_none") }}</Button>
        </template>
        <template v-else>
          <Button size="sm" variant="outline" @click="setAvatarTagsSelectToggle">{{ t("dialog.set_avatar_tags.select_all") }}</Button>
        </template>
        <span style="margin-left: 6px">{{ setAvatarTagsDialog.selectedAvatarIds.length }} / {{ setAvatarTagsDialog.ownAvatars.length }}</span>
        <Spinner v-if="setAvatarTagsDialog.loading" class="inline-block ml-2" />
        <div class="flex flex-wrap items-start max-h-[300px] overflow-auto" style="margin-top: 8px; min-height: 60px">
          <div
            v-for="avatar in setAvatarTagsDialog.ownAvatars"
            :key="avatar.id"
            :class="['w-[335px]', 'box-border flex items-center p-1.5 text-[13px] cursor-pointer hover:rounded-[25px_5px_5px_25px]']"
            @click="showAvatarDialog(avatar.id)"
          >
            <div class="relative inline-block flex-none size-9 mr-2.5">
              <img v-if="avatar.thumbnailImageUrl" class="size-full rounded-full object-cover" :src="avatar.thumbnailImageUrl" loading="lazy" />
            </div>
            <div class="flex-1 overflow-hidden">
              <span class="block truncate font-medium leading-[18px]" v-text="avatar.name"></span>
              <span v-if="avatar.releaseStatus === 'public'" class="block truncate text-xs" v-text="avatar.releaseStatus"></span>
              <span v-else-if="avatar.releaseStatus === 'private'" class="block truncate text-xs" v-text="avatar.releaseStatus"></span>
              <span v-else class="block truncate text-xs" v-text="avatar.releaseStatus"></span>
              <span class="block truncate text-xs" v-text="avatarTagStrings.get(avatar.id)"></span>
            </div>
            <Button size="sm" variant="ghost" style="margin-left: 6px" @click.stop>
              <Checkbox
                :model-value="setAvatarTagsDialog.selectedAvatarIds.includes(avatar.id)"
                @update:model-value="(checked) => toggleAvatarSelection(avatar.id, checked)"
              />
            </Button>
          </div>
        </div>
      </template>

      <DialogFooter>
        <Button variant="secondary" class="mr-2" @click="closeSetAvatarTagsDialog">{{ t("dialog.set_avatar_tags.cancel") }}</Button>
        <Button @click="saveSetAvatarTagsDialog">{{ t("dialog.set_avatar_tags.save") }}</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
import Dialog from "@/components/ui/dialog/Dialog.vue";
import DialogContent from "@/components/ui/dialog/DialogContent.vue";
import DialogFooter from "@/components/ui/dialog/DialogFooter.vue";
import DialogHeader from "@/components/ui/dialog/DialogHeader.vue";
import DialogTitle from "@/components/ui/dialog/DialogTitle.vue";
import Button from "@/components/ui/button/Button.vue";
import Checkbox from "@/components/ui/checkbox/Checkbox.vue";
import InputGroupTextareaField from "@/components/ui/input-group/InputGroupTextareaField.vue";
import Spinner from "@/components/ui/spinner/Spinner.vue";
import { toast } from "vue-sonner";
import { useI18n } from "vue-i18n";
import { watch } from "vue";

import { avatarRequest } from "../../../api/avatar";
import { removeFromArray } from "../../../shared/utils/base/array";
import { useAvatarStore } from "../../../stores/avatar";
import { showAvatarDialog, applyAvatar } from "../../../coordinators/avatar-coordinator";
import type { ContentFlagKey, SetAvatarTagsState } from "./avatar-dialog-types";

const { cachedAvatars } = useAvatarStore();

const { t } = useI18n();
const props = defineProps<{
  setAvatarTagsDialog: SetAvatarTagsState;
}>();
const avatarTagStrings = new Map<string, string>();

const emit = defineEmits<{
  "update:setAvatarTagsDialog": [value: SetAvatarTagsState];
}>();

watch(
  () => props.setAvatarTagsDialog.visible,
  (isVisible) => {
    if (isVisible) {
      updateAvatarTagsString();
      updateSelectedAvatarTags();
      updateInputAvatarTags();
    }
  }
);

function closeSetAvatarTagsDialog() {
  emit("update:setAvatarTagsDialog", {
    ...props.setAvatarTagsDialog,
    visible: false,
  });
}

function setContentFlag(key: ContentFlagKey, checked: boolean | "indeterminate") {
  const D = props.setAvatarTagsDialog;
  D[key] = checked === true;
  updateSelectedAvatarTags();
}

function setSelectedTagsCsv(value: string) {
  const D = props.setAvatarTagsDialog;
  D.selectedTagsCsv = value;
}

function updateSelectedAvatarTags() {
  const D = props.setAvatarTagsDialog;
  if (D.contentHorror) {
    if (!D.selectedTags.includes("content_horror")) {
      D.selectedTags.push("content_horror");
    }
  } else if (D.selectedTags.includes("content_horror")) {
    D.selectedTags.splice(D.selectedTags.indexOf("content_horror"), 1);
  }
  if (D.contentGore) {
    if (!D.selectedTags.includes("content_gore")) {
      D.selectedTags.push("content_gore");
    }
  } else if (D.selectedTags.includes("content_gore")) {
    D.selectedTags.splice(D.selectedTags.indexOf("content_gore"), 1);
  }
  if (D.contentViolence) {
    if (!D.selectedTags.includes("content_violence")) {
      D.selectedTags.push("content_violence");
    }
  } else if (D.selectedTags.includes("content_violence")) {
    D.selectedTags.splice(D.selectedTags.indexOf("content_violence"), 1);
  }
  if (D.contentAdult) {
    if (!D.selectedTags.includes("content_adult")) {
      D.selectedTags.push("content_adult");
    }
  } else if (D.selectedTags.includes("content_adult")) {
    D.selectedTags.splice(D.selectedTags.indexOf("content_adult"), 1);
  }
  if (D.contentSex) {
    if (!D.selectedTags.includes("content_sex")) {
      D.selectedTags.push("content_sex");
    }
  } else if (D.selectedTags.includes("content_sex")) {
    D.selectedTags.splice(D.selectedTags.indexOf("content_sex"), 1);
  }

  D.selectedTagsCsv = D.selectedTags.join(",").replace(/content_/g, "");
}

function toggleAvatarSelection(avatarId: string, checked: boolean | "indeterminate") {
  const D = props.setAvatarTagsDialog;
  const isSelected = D.selectedAvatarIds.includes(avatarId);
  const shouldSelect = typeof checked === "boolean" ? checked : !isSelected;
  if (shouldSelect && !isSelected) {
    D.selectedAvatarIds.push(avatarId);
  } else if (!shouldSelect && isSelected) {
    removeFromArray(D.selectedAvatarIds, avatarId);
  }
}

function updateAvatarTagsString() {
  const D = props.setAvatarTagsDialog;
  for (const ref of D.ownAvatars) {
    let tagString = "";
    const contentTags: string[] = [];
    ref.tags.forEach((tag) => {
      if (tag.startsWith("content_")) {
        contentTags.push(tag.substring(8));
      }
    });
    for (const [index, tag] of contentTags.entries()) {
      if (index < contentTags.length - 1) {
        tagString += `${tag}, `;
      } else {
        tagString += tag;
      }
    }
    avatarTagStrings.set(ref.id, tagString);
  }
}

function setAvatarTagsSelectToggle() {
  const D = props.setAvatarTagsDialog;
  const isAllSelected = D.ownAvatars.length === D.selectedAvatarIds.length;
  for (const ref of D.ownAvatars) {
    if (!isAllSelected) {
      if (!D.selectedAvatarIds.includes(ref.id)) {
        D.selectedAvatarIds.push(ref.id);
      }
    } else {
      removeFromArray(D.selectedAvatarIds, ref.id);
    }
  }
}

async function saveSetAvatarTagsDialog() {
  const D = props.setAvatarTagsDialog;
  if (D.loading) {
    return;
  }
  D.loading = true;
  try {
    for (const avatarId of D.selectedAvatarIds) {
      console.log("Saving tags for avatar", avatarId);
      const ref = cachedAvatars.get(avatarId);
      if (!D.visible || !ref) {
        console.error("Aborting avatar tag save, dialog closed or avatar not found", avatarId);
        break;
      }
      const tags = [...D.selectedTags];
      for (const tag of ref.tags) {
        if (!tag.startsWith("content_")) {
          tags.push(tag);
        }
      }
      const args = await avatarRequest.saveAvatar({
        id: ref.id,
        tags,
      });
      applyAvatar(args.json);
    }
  } catch (err) {
    console.error(err);
    toast.error("Error saving avatar tags");
  } finally {
    D.loading = false;
    D.visible = false;
  }
}

function updateInputAvatarTags() {
  const D = props.setAvatarTagsDialog;
  D.contentHorror = false;
  D.contentGore = false;
  D.contentViolence = false;
  D.contentAdult = false;
  D.contentSex = false;
  const tags = D.selectedTagsCsv.split(",");
  D.selectedTags = [];
  for (const tag of tags) {
    switch (tag) {
      case "horror":
        D.contentHorror = true;
        break;
      case "gore":
        D.contentGore = true;
        break;
      case "violence":
        D.contentViolence = true;
        break;
      case "adult":
        D.contentAdult = true;
        break;
      case "sex":
        D.contentSex = true;
        break;
    }
    if (tag && !D.selectedTags.includes(`content_${tag}`)) {
      D.selectedTags.push(`content_${tag}`);
    }
  }
}
</script>
