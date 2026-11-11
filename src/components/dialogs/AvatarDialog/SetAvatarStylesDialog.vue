<template>
  <Dialog
    :open="setAvatarStylesDialog.visible"
    @update:open="
      (open) => {
        if (!open) closeSetAvatarStylesDialog();
      }
    "
  >
    <DialogContent class="x-dialog sm:max-w-100">
      <DialogHeader>
        <DialogTitle>{{ t("dialog.set_avatar_styles.header") }}</DialogTitle>
      </DialogHeader>

      <template v-if="setAvatarStylesDialog.visible">
        <div>
          <span>{{ t("dialog.set_avatar_styles.primary_style") }}</span>
          <br />
          <Select
            :model-value="setAvatarStylesDialog.primaryStyle"
            @update:model-value="(v) => updateDialog({ primaryStyle: typeof v === 'string' && v !== SELECT_CLEAR_VALUE ? v : '' })"
          >
            <SelectTrigger size="sm" style="display: inline-flex">
              <SelectValue :placeholder="t('dialog.set_avatar_styles.select_style')" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem :value="SELECT_CLEAR_VALUE">{{ t("dialog.gallery_select.none") }}</SelectItem>
              <SelectItem v-for="(style, index) in setAvatarStylesDialog.availableAvatarStyles" :key="index" :value="style">
                {{ style }}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <span>{{ t("dialog.set_avatar_styles.secondary_style") }}</span>
          <br />
          <Select
            :model-value="setAvatarStylesDialog.secondaryStyle"
            @update:model-value="(v) => updateDialog({ secondaryStyle: typeof v === 'string' && v !== SELECT_CLEAR_VALUE ? v : '' })"
          >
            <SelectTrigger size="sm" style="display: inline-flex">
              <SelectValue :placeholder="t('dialog.set_avatar_styles.select_style')" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem :value="SELECT_CLEAR_VALUE">{{ t("dialog.gallery_select.none") }}</SelectItem>
              <SelectItem v-for="(style, index) in setAvatarStylesDialog.availableAvatarStyles" :key="index" :value="style">
                {{ style }}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div class="text-xs">{{ t("dialog.set_world_tags.author_tags") }}</div>

        <InputGroupTextareaField
          :model-value="setAvatarStylesDialog.authorTags"
          :autosize="{ minRows: 2, maxRows: 5 }"
          :rows="2"
          placeholder=""
          input-class="resize-none mt-2"
          @update:model-value="(v) => updateDialog({ authorTags: v })"
        />
      </template>

      <DialogFooter>
        <Button variant="secondary" class="mr-2" @click="closeSetAvatarStylesDialog">{{ t("dialog.set_avatar_styles.cancel") }}</Button>
        <Button @click="saveSetAvatarStylesDialog">
          {{ t("dialog.set_avatar_styles.save") }}
        </Button>
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
import InputGroupTextareaField from "@/components/ui/input-group/InputGroupTextareaField.vue";
import { toast } from "vue-sonner";
import { useI18n } from "vue-i18n";
import { watch } from "vue";

import Select from "../../ui/select/Select.vue";
import SelectContent from "../../ui/select/SelectContent.vue";
import SelectItem from "../../ui/select/SelectItem.vue";
import SelectTrigger from "../../ui/select/SelectTrigger.vue";
import SelectValue from "../../ui/select/SelectValue.vue";
import { avatarRequest } from "../../../api/avatar";
import { queryRequest } from "../../../api/query-request";
import { arraysMatch } from "../../../shared/utils/base/array";
import { applyAvatar } from "../../../coordinators/avatar-coordinator";
import { logError } from "../../../stores/vrcx-messages";
import type { SetAvatarStylesState } from "./avatar-dialog-types";

const props = defineProps<{
  setAvatarStylesDialog: SetAvatarStylesState;
}>();

const emit = defineEmits<{
  "update:setAvatarStylesDialog": [value: SetAvatarStylesState];
}>();

const { t } = useI18n();

const SELECT_CLEAR_VALUE = "__clear__";

watch(
  () => props.setAvatarStylesDialog.visible,
  (isVisible) => {
    if (isVisible) {
      void getAvatarStyles().catch(logError);
    }
  }
);

function updateDialog(patch: Partial<SetAvatarStylesState>) {
  emit("update:setAvatarStylesDialog", {
    ...props.setAvatarStylesDialog,
    ...patch,
  });
}

async function getAvatarStyles() {
  try {
    const ref = await queryRequest.fetch("avatarStyles");
    const styles: string[] = [];
    const stylesMap = new Map<string, string>();
    for (const style of ref.json) {
      styles.push(style.styleName);
      stylesMap.set(style.styleName, style.id);
    }

    updateDialog({
      availableAvatarStyles: styles,
      availableAvatarStylesMap: stylesMap,
    });
  } catch (error) {
    console.error("Error loading avatar styles:", error);
  }
}

function closeSetAvatarStylesDialog() {
  updateDialog({ visible: false });
}

function saveSetAvatarStylesDialog() {
  const D = props.setAvatarStylesDialog;
  const primaryStyleId = D.availableAvatarStylesMap.get(D.primaryStyle) ?? "";
  const secondaryStyleId = D.availableAvatarStylesMap.get(D.secondaryStyle) ?? "";

  const tags: string[] = [];
  for (const tag of D.initialTags) {
    if (!tag.startsWith("author_tag_")) {
      tags.push(tag);
    }
  }

  const authorTagsArray = D.authorTags.split(",");
  for (const tag of authorTagsArray) {
    if (!tag.trim()) {
      continue;
    }
    const tagName = `author_tag_${tag}`;
    if (!tags.includes(tagName)) {
      tags.push(tagName);
    }
  }

  if (D.initialPrimaryStyle === D.primaryStyle && D.initialSecondaryStyle === D.secondaryStyle && arraysMatch(D.initialTags, tags)) {
    closeSetAvatarStylesDialog();
    return;
  }

  const params = {
    id: D.avatarId,
    primaryStyle: primaryStyleId,
    secondaryStyle: secondaryStyleId,
    tags,
  };

  avatarRequest
    .saveAvatar(params)
    .then((args) => {
      applyAvatar(args.json);
      toast.success(t("dialog.set_avatar_styles.save_success"));
      closeSetAvatarStylesDialog();
    })
    .catch((error: unknown) => {
      toast.error(t("dialog.set_avatar_styles.save_failed"));
      console.error("Error saving avatar styles:", error);
    });
}
</script>
