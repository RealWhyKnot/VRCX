<template>
  <Dialog :open="gallerySelectDialog.visible" @update:open="setDialogOpen">
    <DialogContent class="x-dialog w-full sm:max-w-none">
      <DialogHeader>
        <DialogTitle>{{ t("dialog.gallery_select.header") }}</DialogTitle>
      </DialogHeader>

      <div>
        <span>{{ t("dialog.gallery_select.gallery") }}</span>
        <span class="ml-1.5 text-muted-foreground text-xs">{{ imageTable.length }}/{{ imageLimit }}</span>
        <br />
        <input id="GalleryUploadButton" type="file" accept="image/*" class="hidden" @change="onFileChangeGallery" />
        <ButtonGroup>
          <Button variant="outline" size="sm" @click="selectImageGallerySelect('', '')">
            <X />
            {{ t("dialog.gallery_select.none") }}
          </Button>
          <Button variant="outline" size="sm" @click="refreshTable()">
            <RefreshCw />
            {{ t("dialog.gallery_select.refresh") }}
          </Button>
          <Button variant="outline" size="sm" :disabled="!isLocalUserVrcPlusSupporter" @click="displayGalleryUpload">
            <Upload />
            {{ t("dialog.gallery_select.upload") }}
          </Button>
        </ButtonGroup>
        <br />
        <div v-for="image in imageTable" :key="image.id" class="box-border inline-block mt-2.5 cursor-default">
          <template v-if="latestVersion(image)">
            <div
              v-if="latestVersion(image)?.file?.url"
              class="h-[200px] w-[200px] rounded-[20px] cursor-pointer overflow-hidden mr-5"
              @click="selectImageGallerySelect(latestVersion(image)?.file?.url ?? '', image.id, latestVersion(image)?.version)"
            >
              <img :src="latestVersion(image)?.file?.url" class="h-full w-full rounded-[15px] object-cover" loading="lazy" />
            </div>
          </template>
        </div>
      </div>
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
import Dialog from "@/components/ui/dialog/Dialog.vue";
import DialogContent from "@/components/ui/dialog/DialogContent.vue";
import DialogHeader from "@/components/ui/dialog/DialogHeader.vue";
import DialogTitle from "@/components/ui/dialog/DialogTitle.vue";
import { RefreshCw, Upload, X } from "lucide-vue-next";
import Button from "@/components/ui/button/Button.vue";
import ButtonGroup from "@/components/ui/button-group/ButtonGroup.vue";
import { storeToRefs } from "pinia";
import { toast } from "vue-sonner";
import { useI18n } from "vue-i18n";

import { useAuthStore } from "../../../stores/auth";
import { useGalleryStore } from "../../../stores/gallery";
import { useUserStore } from "../../../stores/user";
import { vrcPlusIconRequest } from "../../../api/vrc-plus-icon";
import { vrcPlusImageRequest } from "../../../api/vrc-plus-image";
import { computed, watch } from "vue";
import type { GalleryFile } from "../../../stores/gallery-types";
import type { GallerySelectDialogState, GallerySelectionPayload } from "./group-dialog-types";

const { t } = useI18n();

const { galleryTable, VRCPlusIconsTable } = storeToRefs(useGalleryStore());
const { refreshGalleryTable, refreshVRCPlusIconsTable, handleGalleryImageAdd } = useGalleryStore();
const { isLocalUserVrcPlusSupporter } = storeToRefs(useUserStore());
const { cachedPermissions } = storeToRefs(useAuthStore());

const props = defineProps<{
  gallerySelectDialog: GallerySelectDialogState;
}>();
const emit = defineEmits<{
  "select-image": [payload: GallerySelectionPayload];
}>();

watch(
  () => props.gallerySelectDialog.visible,
  (isVisible) => {
    if (isVisible) {
      refreshTable();
    }
  }
);

function refreshTable() {
  if (props.gallerySelectDialog.isIconGallerySelectDialog) {
    refreshVRCPlusIconsTable();
    return;
  }
  refreshGalleryTable();
}
const imageTable = computed(() => {
  if (props.gallerySelectDialog.isIconGallerySelectDialog) {
    return VRCPlusIconsTable.value;
  }
  return galleryTable.value;
});
const imageLimit = computed(() => {
  if (props.gallerySelectDialog.isIconGallerySelectDialog) {
    return cachedPermissions.value.maxUserIcons;
  }
  return cachedPermissions.value.maxUserGallery;
});

function setDialogOpen(isOpen: boolean) {
  const D = props.gallerySelectDialog;
  D.visible = isOpen;
}

function latestVersion(image: GalleryFile) {
  return image.versions.at(-1);
}

function selectImageGallerySelect(imageUrl: string, fileId: string, fileVersion?: number) {
  const D = props.gallerySelectDialog;
  D.selectedFileId = fileId;
  D.selectedImageUrl = imageUrl;
  D.selectedFileVersion = fileVersion;
  emit("select-image", { imageUrl, fileId, fileVersion });
  D.visible = false;
}

function displayGalleryUpload() {
  document.getElementById("GalleryUploadButton")?.click();
}

function onFileChangeGallery(e: Event) {
  const clearFile = function () {
    const fileInput = document.querySelector("#GalleryUploadButton");
    if (fileInput instanceof HTMLInputElement) {
      fileInput.value = "";
    }
  };
  const input = e.target;
  if (!(input instanceof HTMLInputElement) || !input.files) {
    return;
  }
  const file = input.files[0];
  if (!file) {
    return;
  }
  if (file.size >= 100000000) {
    toast.error(t("message.file.too_large"));
    clearFile();
    return;
  }
  if (!/image.*/.test(file.type)) {
    toast.error(t("message.file.not_image"));
    clearFile();
    return;
  }
  const r = new FileReader();
  r.onload = function () {
    if (typeof r.result !== "string") {
      return;
    }
    const base64Body = r.result.slice(r.result.indexOf(",") + 1);
    if (props.gallerySelectDialog.isIconGallerySelectDialog) {
      vrcPlusIconRequest
        .uploadVRCPlusIcon(base64Body)
        .then((args) => {
          handleGalleryImageAdd(args);
          toast.success(t("message.gallery.uploaded"));
          if (Object.keys(VRCPlusIconsTable.value).length !== 0) {
            VRCPlusIconsTable.value.unshift(args.json);
          }
        })
        .catch((err: unknown) => console.error(err));
      return;
    }
    vrcPlusImageRequest
      .uploadGalleryImage(base64Body)
      .then((args) => {
        handleGalleryImageAdd(args);
        toast.success(t("message.gallery.uploaded"));
        if (Object.keys(galleryTable.value).length !== 0) {
          galleryTable.value.unshift(args.json);
        }
      })
      .catch((err: unknown) => console.error(err));
  };
  r.readAsDataURL(file);
  clearFile();
}
</script>
