<template>
  <Dialog v-model:open="groupPostEditDialog.visible">
    <DialogContent class="sm:max-w-162.5">
      <DialogHeader>
        <DialogTitle>{{ t("dialog.group_post_edit.header") }}</DialogTitle>
      </DialogHeader>

      <div v-if="groupPostEditDialog.visible">
        <FieldGroup class="gap-4">
          <Field>
            <FieldLabel>{{ t("dialog.group_post_edit.title") }}</FieldLabel>
            <FieldContent>
              <InputGroupField v-model="groupPostEditDialog.title" size="sm" />
            </FieldContent>
          </Field>
          <Field>
            <FieldLabel>{{ t("dialog.group_post_edit.message") }}</FieldLabel>
            <FieldContent>
              <InputGroupTextareaField v-model="groupPostEditDialog.text" :rows="4" input-class="resize-none mt-2" />
            </FieldContent>
          </Field>
          <Field v-if="!groupPostEditDialog.postId">
            <FieldLabel class="sr-only">{{ t("dialog.group_post_edit.send_notification") }}</FieldLabel>
            <FieldContent>
              <label class="inline-flex items-center gap-2">
                <Checkbox v-model="groupPostEditDialog.sendNotification" />
                <span>{{ t("dialog.group_post_edit.send_notification") }}</span>
              </label>
            </FieldContent>
          </Field>
          <Field>
            <FieldLabel>{{ t("dialog.group_post_edit.post_visibility") }}</FieldLabel>
            <FieldContent>
              <RadioGroup v-model="groupPostEditDialog.visibility" class="flex items-center gap-4">
                <div class="flex items-center space-x-2">
                  <RadioGroupItem id="groupPostVisibility-public" value="public" />
                  <label for="groupPostVisibility-public">
                    {{ t("dialog.group_post_edit.visibility_public") }}
                  </label>
                </div>
                <div class="flex items-center space-x-2">
                  <RadioGroupItem id="groupPostVisibility-group" value="group" />
                  <label for="groupPostVisibility-group">
                    {{ t("dialog.group_post_edit.visibility_group") }}
                  </label>
                </div>
              </RadioGroup>
            </FieldContent>
          </Field>
          <Field v-if="groupPostEditDialog.visibility === 'group'">
            <FieldLabel>{{ t("dialog.new_instance.roles") }}</FieldLabel>
            <FieldContent>
              <Select
                multiple
                :model-value="Array.isArray(groupPostEditDialog.roleIds) ? groupPostEditDialog.roleIds : []"
                @update:model-value="handleRoleIdsChange"
              >
                <SelectTrigger size="sm" class="w-full">
                  <SelectValue>
                    <span class="truncate">
                      {{ selectedRoleSummary || t("dialog.new_instance.role_placeholder") }}
                    </span>
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem v-for="role in selectableRoles" :key="role.id" :value="role.id">
                      {{ role.name }}
                    </SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </FieldContent>
          </Field>
          <Field>
            <FieldLabel>{{ t("dialog.group_post_edit.image") }}</FieldLabel>
            <FieldContent>
              <template v-if="gallerySelectDialog.selectedFileId">
                <div class="mr-1.5" style="display: inline-block; flex: none">
                  <img
                    :src="gallerySelectDialog.selectedImageUrl"
                    style="flex: none; width: 60px; height: 60px; border-radius: var(--radius-md); object-fit: cover"
                    loading="lazy"
                    @click="showFullscreenImageDialog(gallerySelectDialog.selectedImageUrl)"
                  />
                  <Button size="sm" variant="outline" style="vertical-align: top" @click="clearImageGallerySelect">
                    {{ t("dialog.invite_message.clear_selected_image") }}
                  </Button>
                </div>
              </template>
              <template v-else>
                <Button size="sm" variant="outline" @click="showGallerySelectDialog">
                  {{ t("dialog.invite_message.select_image") }}
                </Button>
              </template>
            </FieldContent>
          </Field>
        </FieldGroup>
      </div>

      <DialogFooter>
        <div class="flex gap-2">
          <Button variant="secondary" @click="groupPostEditDialog.visible = false">
            {{ t("dialog.group_post_edit.cancel") }}
          </Button>
          <Button v-if="groupPostEditDialog.postId" @click="editGroupPost">
            {{ t("dialog.group_post_edit.edit_post") }}
          </Button>
          <Button v-else @click="createGroupPost">
            {{ t("dialog.group_post_edit.create_post") }}
          </Button>
        </div>
      </DialogFooter>

      <GallerySelectDialog :gallery-select-dialog="gallerySelectDialog" />
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
import Dialog from "@/components/ui/dialog/Dialog.vue";
import DialogContent from "@/components/ui/dialog/DialogContent.vue";
import DialogFooter from "@/components/ui/dialog/DialogFooter.vue";
import DialogHeader from "@/components/ui/dialog/DialogHeader.vue";
import DialogTitle from "@/components/ui/dialog/DialogTitle.vue";
import Field from "@/components/ui/field/Field.vue";
import FieldContent from "@/components/ui/field/FieldContent.vue";
import FieldGroup from "@/components/ui/field/FieldGroup.vue";
import FieldLabel from "@/components/ui/field/FieldLabel.vue";
import InputGroupField from "@/components/ui/input-group/InputGroupField.vue";
import InputGroupTextareaField from "@/components/ui/input-group/InputGroupTextareaField.vue";
import { computed, ref } from "vue";
import Button from "@/components/ui/button/Button.vue";
import Checkbox from "@/components/ui/checkbox/Checkbox.vue";
import { toast } from "vue-sonner";
import { useI18n } from "vue-i18n";
import type { AcceptableValue } from "reka-ui";

import Select from "../../ui/select/Select.vue";
import SelectContent from "../../ui/select/SelectContent.vue";
import SelectGroup from "../../ui/select/SelectGroup.vue";
import SelectItem from "../../ui/select/SelectItem.vue";
import SelectTrigger from "../../ui/select/SelectTrigger.vue";
import SelectValue from "../../ui/select/SelectValue.vue";
import RadioGroup from "../../ui/radio-group/RadioGroup.vue";
import RadioGroupItem from "../../ui/radio-group/RadioGroupItem.vue";
import { groupRequest } from "../../../api/group";
import { useGalleryStore } from "../../../stores/gallery";
import { useGroupStore } from "../../../stores/group";

import GallerySelectDialog from "./GallerySelectDialog.vue";
import type { GroupPostEditDialogState, GroupPostSelectedImage } from "./group-dialog-types";

const props = withDefaults(
  defineProps<{
    dialogData: GroupPostEditDialogState;
    selectedGalleryFile?: GroupPostSelectedImage;
  }>(),
  {
    selectedGalleryFile: () => ({ selectedFileId: "", selectedImageUrl: "" }),
  }
);

const emit = defineEmits<{
  "update:dialogData": [value: GroupPostEditDialogState];
}>();

const { t } = useI18n();

const { showFullscreenImageDialog } = useGalleryStore();
const { handleGroupPost } = useGroupStore();

const gallerySelectDialog = ref({
  visible: false,
  selectedFileId: "",
  selectedImageUrl: "",
  isIconGallerySelectDialog: false,
});
const groupPostEditDialog = computed({
  get() {
    return props.dialogData;
  },
  set(value) {
    emit("update:dialogData", value);
  },
});

const selectableRoles = computed(() =>
  (groupPostEditDialog.value.groupRef.roles ?? []).filter((role): role is typeof role & { id: string } => typeof role.id === "string")
);

const selectedRoleSummary = computed(() => {
  const ids = groupPostEditDialog.value.roleIds;
  if (ids.length === 0) {
    return "";
  }
  const roleById = new Map<string, string>();
  for (const role of groupPostEditDialog.value.groupRef.roles ?? []) {
    if (role.id !== undefined && role.name !== undefined) {
      roleById.set(role.id, role.name);
    }
  }
  const names = ids.map((id) => roleById.get(id) ?? id);
  return names.slice(0, 3).join(", ") + (names.length > 3 ? ` +${names.length - 3}` : "");
});

function handleRoleIdsChange(value: AcceptableValue | AcceptableValue[]) {
  const next: string[] = [];
  if (Array.isArray(value)) {
    for (const roleId of value) {
      if (typeof roleId === "string" && roleId !== "") {
        next.push(roleId);
      }
    }
  }
  groupPostEditDialog.value.roleIds = next;
}

function showGallerySelectDialog() {
  const D = gallerySelectDialog.value;
  D.visible = true;
}
function editGroupPost() {
  const D = groupPostEditDialog.value;
  if (!D.groupId || !D.postId) {
    return;
  }
  if (!D.title || !D.text) {
    toast.warning("Title and text are required");
    return;
  }
  const params = {
    groupId: D.groupId,
    postId: D.postId,
    title: D.title,
    text: D.text,
    roleIds: D.roleIds,
    visibility: D.visibility,
    imageId: gallerySelectDialog.value.selectedFileId || null,
  };
  groupRequest
    .editGroupPost(params)
    .then((args) => {
      handleGroupPost(args);
      toast.success("Group post edited");
    })
    .catch((err: unknown) => console.error(err));
  D.visible = false;
}
function createGroupPost() {
  const D = groupPostEditDialog.value;
  if (!D.title || !D.text) {
    toast.warning("Title and text are required");
    return;
  }
  const params = {
    groupId: D.groupId,
    title: D.title,
    text: D.text,
    roleIds: D.roleIds,
    visibility: D.visibility,
    sendNotification: D.sendNotification,
    imageId: gallerySelectDialog.value.selectedFileId || null,
  };
  groupRequest
    .createGroupPost(params)
    .then((args) => {
      handleGroupPost(args);
      toast.success("Group post created");
    })
    .catch((err: unknown) => console.error(err));
  D.visible = false;
}
function clearImageGallerySelect() {
  const D = gallerySelectDialog.value;
  D.selectedFileId = "";
  D.selectedImageUrl = "";
}
</script>
