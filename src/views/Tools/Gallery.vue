<template>
  <div class="gallery-page x-container">
    <div class="flex items-center gap-2 ml-2">
      <Button variant="ghost" size="sm" class="mr-3" @click="goBack">
        <ArrowLeft />
        {{ t("nav_tooltip.tools") }}
      </Button>
      <span class="header">{{ t("dialog.gallery_icons.header") }}</span>
    </div>
    <TabsUnderline v-model="activeTab" :items="galleryTabs" :unmount-on-hide="false">
      <template #label-gallery>
        <span>
          {{ t("dialog.gallery_icons.gallery") }}
          <span class="text-xs ml-[5px]"> {{ galleryTable.length }}/{{ cachedPermissions.maxUserGallery }} </span>
        </span>
      </template>
      <template #label-icons>
        <span>
          {{ t("dialog.gallery_icons.icons") }}
          <span class="text-xs ml-[5px]"> {{ VRCPlusIconsTable.length }}/{{ cachedPermissions.maxUserIcons }} </span>
        </span>
      </template>
      <template #label-emojis>
        <span>
          {{ t("dialog.gallery_icons.emojis") }}
          <span class="text-xs ml-[5px]"> {{ emojiTable.length }}/{{ cachedPermissions.maxUserEmoji }} </span>
        </span>
      </template>
      <template #label-stickers>
        <span>
          {{ t("dialog.gallery_icons.stickers") }}
          <span class="text-xs ml-[5px]"> {{ stickerTable.length }}/{{ cachedPermissions.maxUserStickers }} </span>
        </span>
      </template>
      <template #label-prints>
        <span>
          {{ t("dialog.gallery_icons.prints") }}
          <span class="text-xs ml-[5px]"> {{ printTable.length }}/{{ cachedPermissions.maxUserPrints }} </span>
        </span>
      </template>
      <template #label-inventory>
        <span>
          {{ t("dialog.gallery_icons.inventory") }}
          <span class="text-xs ml-[5px]">
            {{ inventoryTable.length }}
          </span>
        </span>
      </template>
      <template #gallery>
        <div @dragover.prevent @drop.prevent="handleDropGallery">
          <input id="GalleryUploadButton" type="file" accept="image/*" class="hidden" @change="onFileChangeGallery" />
          <ButtonGroup>
            <Button variant="outline" size="sm" @click="refreshGalleryTable">
              <RefreshCw />
              {{ t("dialog.gallery_icons.refresh") }}
            </Button>
            <Button variant="outline" size="sm" :disabled="!isLocalUserVrcPlusSupporter || isUploading" @click="displayGalleryUpload">
              <Upload />
              {{ t("dialog.gallery_icons.upload") }}
            </Button>
          </ButtonGroup>
          <ItemGroup class="grid gap-3 mt-3 grid-cols-[repeat(auto-fill,minmax(180px,1fr))]">
            <Item v-for="image in galleryTable" :key="image.id" variant="outline" size="sm" class="p-0 x-hover-card hover:bg-accent hover:shadow-sm" as-child>
              <div v-if="latestFileUrl(image)" class="overflow-hidden rounded-[inherit]">
                <ItemHeader class="cursor-pointer" @click="openFullscreen(latestFileUrl(image))">
                  <img :src="latestFileUrl(image)" loading="lazy" class="aspect-[4/3] w-full rounded-t-md object-cover" />
                </ItemHeader>
                <ItemFooter class="p-2 gap-1">
                  <Button size="icon-sm" variant="ghost" class="rounded-full text-destructive" @click="deleteGalleryImage(image.id)">
                    <Trash2 />
                  </Button>
                </ItemFooter>
              </div>
            </Item>
          </ItemGroup>
        </div>
      </template>

      <template #icons>
        <div @dragover.prevent @drop.prevent="handleDropIcon">
          <input id="VRCPlusIconUploadButton" type="file" accept="image/*" class="hidden" @change="onFileChangeVRCPlusIcon" />
          <ButtonGroup>
            <Button variant="outline" size="sm" @click="refreshVRCPlusIconsTable">
              <RefreshCw />
              {{ t("dialog.gallery_icons.refresh") }}
            </Button>
            <Button variant="outline" size="sm" :disabled="!isLocalUserVrcPlusSupporter || isUploading" @click="displayVRCPlusIconUpload">
              <Upload />
              {{ t("dialog.gallery_icons.upload") }}
            </Button>
            <Button variant="outline" size="sm" :disabled="currentUser.userIcon === currentUser.currentAvatarImageUrl" @click="setUserIcon('')">
              <X />
              {{ t("dialog.gallery_icons.clear") }}
            </Button>
          </ButtonGroup>
          <ItemGroup class="grid gap-3 mt-3 grid-cols-[repeat(auto-fill,minmax(160px,1fr))]">
            <Item
              v-for="image in VRCPlusIconsTable"
              :key="image.id"
              variant="outline"
              size="sm"
              class="p-0 x-hover-card hover:bg-accent hover:shadow-sm"
              :class="compareCurrentVRCPlusIcon(image.id) ? 'x-highlight-ring' : ''"
              as-child
            >
              <div v-if="latestFileUrl(image)" class="overflow-hidden rounded-[inherit]">
                <ItemHeader class="cursor-pointer" @click="openFullscreen(latestFileUrl(image))">
                  <img :src="latestFileUrl(image)" loading="lazy" class="aspect-square w-full rounded-t-md object-cover" />
                </ItemHeader>
                <ItemFooter class="p-2 gap-1">
                  <Button size="icon-sm" variant="ghost" class="rounded-full text-destructive" @click="deleteVRCPlusIcon(image.id)">
                    <Trash2 />
                  </Button>
                  <Button
                    size="icon-sm"
                    class="rounded-full"
                    :variant="compareCurrentVRCPlusIcon(image.id) ? 'default' : 'ghost'"
                    @click="setUserIcon(image.id)"
                  >
                    <Check />
                  </Button>
                </ItemFooter>
              </div>
            </Item>
          </ItemGroup>
        </div>
      </template>

      <template #emojis>
        <GalleryEmojisTab :uploads="uploads" />
      </template>

      <template #stickers>
        <div @dragover.prevent @drop.prevent="handleDropSticker">
          <input id="StickerUploadButton" type="file" accept="image/*" class="hidden" @change="onFileChangeSticker" />
          <ButtonGroup>
            <Button variant="outline" size="sm" @click="refreshStickerTable">
              <RefreshCw />
              {{ t("dialog.gallery_icons.refresh") }}
            </Button>
            <Button variant="outline" size="sm" :disabled="!isLocalUserVrcPlusSupporter || isUploading" @click="displayStickerUpload">
              <Upload />
              {{ t("dialog.gallery_icons.upload") }}
            </Button>
          </ButtonGroup>
          <ItemGroup class="grid gap-3 mt-3 grid-cols-[repeat(auto-fill,minmax(160px,1fr))]">
            <Item v-for="image in stickerTable" :key="image.id" variant="outline" size="sm" class="p-0 x-hover-card hover:bg-accent hover:shadow-sm" as-child>
              <div v-if="latestFileUrl(image)" class="overflow-hidden">
                <ItemHeader class="cursor-pointer" @click="openFullscreen(latestFileUrl(image))">
                  <img :src="latestFileUrl(image)" loading="lazy" class="aspect-square w-full rounded-t-md object-cover" />
                </ItemHeader>
                <ItemFooter class="p-2 gap-1">
                  <Button size="icon-sm" variant="ghost" class="rounded-full text-destructive" @click="deleteSticker(image.id)">
                    <Trash2 />
                  </Button>
                </ItemFooter>
              </div>
            </Item>
          </ItemGroup>
        </div>
      </template>

      <template #prints>
        <GalleryPrintsTab :uploads="uploads" />
      </template>

      <template #inventory>
        <GalleryInventoryTab />
      </template>
    </TabsUnderline>

    <ImageCropDialog
      :open="cropDialogOpen"
      :title="cropDialogTitle"
      :aspect-ratio="cropDialogAspectRatio"
      :file="cropDialogFile"
      :previews="cropDialogPreviews"
      @update:open="cropDialogOpen = $event"
      @confirm="onCropConfirm"
    />
  </div>
</template>

<script setup lang="ts">
import { ArrowLeft, Check, RefreshCw, Trash2, Upload, X } from "lucide-vue-next";
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { storeToRefs } from "pinia";
import { toast } from "vue-sonner";
import { useI18n } from "vue-i18n";
import { useRoute, useRouter } from "vue-router";
import type { ImageMask } from "vrchat";
import Button from "@/components/ui/button/Button.vue";
import ButtonGroup from "@/components/ui/button-group/ButtonGroup.vue";
import Item from "@/components/ui/item/Item.vue";
import ItemFooter from "@/components/ui/item/ItemFooter.vue";
import ItemGroup from "@/components/ui/item/ItemGroup.vue";
import ItemHeader from "@/components/ui/item/ItemHeader.vue";
import TabsUnderline from "@/components/ui/tabs/TabsUnderline.vue";
import { extractFileId } from "../../shared/utils/file-utils";
import { userRequest } from "../../api/user";
import { vrcPlusIconRequest } from "../../api/vrc-plus-icon";
import { vrcPlusImageRequest } from "../../api/vrc-plus-image";
import { useAuthStore } from "../../stores/auth";
import { useGalleryStore } from "../../stores/gallery";
import { useUserStore } from "../../stores/user";
import { AppDebug } from "../../services/app-config";
import ImageCropDialog from "../../components/dialogs/ImageCropDialog.vue";
import GalleryEmojisTab from "./components/GalleryEmojisTab.vue";
import GalleryInventoryTab from "./components/GalleryInventoryTab.vue";
import GalleryPrintsTab from "./components/GalleryPrintsTab.vue";
import { deleteFileAndRemove, latestFileUrl, logError, openFullscreen, readFileToBase64Str, triggerFileInput } from "./composables/gallery-file-actions";
import { useGalleryUpload } from "./composables/use-gallery-upload";

defineOptions({ name: "GalleryView" });

type MaskUploadParams = {
  tag: "sticker";
  maskTag: ImageMask;
};

const { t } = useI18n();
const router = useRouter();
const route = useRoute();
const initialTab = route.query["tab"];
const activeTab = ref(initialTab ? String(initialTab) : "gallery");

watch(
  () => route.query["tab"],
  (tab) => {
    if (tab) {
      activeTab.value = String(tab);
    }
  }
);

const uploads = useGalleryUpload();
const { isUploading, cropDialogOpen, cropDialogTitle, cropDialogAspectRatio, cropDialogFile, cropDialogPreviews, onCropConfirm, openImageUploadFlow } = uploads;

const { galleryTable, galleryDialogVisible, VRCPlusIconsTable, stickerTable, printTable, emojiTable, inventoryTable } = storeToRefs(useGalleryStore());
const { loadGalleryData, refreshGalleryTable, refreshVRCPlusIconsTable, refreshStickerTable, handleStickerAdd, handleGalleryImageAdd } = useGalleryStore();

const { currentUser, isLocalUserVrcPlusSupporter } = storeToRefs(useUserStore());
const { cachedPermissions } = storeToRefs(useAuthStore());
const galleryTabs = computed(() => [
  { value: "gallery", label: t("dialog.gallery_icons.gallery") },
  { value: "icons", label: t("dialog.gallery_icons.icons") },
  { value: "emojis", label: t("dialog.gallery_icons.emojis") },
  { value: "stickers", label: t("dialog.gallery_icons.stickers") },
  { value: "prints", label: t("dialog.gallery_icons.prints") },
  { value: "inventory", label: t("dialog.gallery_icons.inventory") },
]);

onMounted(() => {
  galleryDialogVisible.value = true;
  loadGalleryData();
});

onBeforeUnmount(() => {
  galleryDialogVisible.value = false;
});

function isCurrentFile(currentUrl: string, fileId: string) {
  return fileId === extractFileId(currentUrl);
}

function goBack() {
  galleryDialogVisible.value = false;
  void router.push({ name: "tools" }).catch(logError);
}

async function uploadGalleryImage(base64Body: string) {
  const args = await vrcPlusImageRequest.uploadGalleryImage(base64Body);
  handleGalleryImageAdd(args);
}

function onFileChangeGallery(e: Event) {
  openImageUploadFlow(e, {
    inputSelector: "#GalleryUploadButton",
    aspectRatio: 4 / 3,
    previews: "photo",
    upload: async ({ base64Body }) => {
      await uploadGalleryImage(base64Body);
    },
  });
}

function displayGalleryUpload() {
  triggerFileInput("GalleryUploadButton");
}

function deleteGalleryImage(fileId: string) {
  deleteFileAndRemove(fileId, galleryTable.value);
}

async function uploadVRCPlusIcon(base64Body: string) {
  const args = await vrcPlusIconRequest.uploadVRCPlusIcon(base64Body);
  if (VRCPlusIconsTable.value.length > 0) {
    VRCPlusIconsTable.value.unshift(args.json);
  }
}

function onFileChangeVRCPlusIcon(e: Event) {
  openImageUploadFlow(e, {
    inputSelector: "#VRCPlusIconUploadButton",
    aspectRatio: 1 / 1,
    previews: "icon",
    errorMessage: "Failed to upload VRC+ icon",
    upload: async ({ base64Body }) => {
      await uploadVRCPlusIcon(base64Body);
    },
  });
}

function displayVRCPlusIconUpload() {
  triggerFileInput("VRCPlusIconUploadButton");
}

function setUserIcon(fileId: string) {
  if (!isLocalUserVrcPlusSupporter.value) {
    toast.error(t("message.vrcplus.required"));
    return;
  }
  let userIcon = "";
  if (fileId) {
    userIcon = `${AppDebug.endpointDomain}/file/${fileId}/1`;
  }
  if (userIcon === currentUser.value.iconUrl) {
    return;
  }
  void userRequest
    .saveProfile({
      userIcon,
    })
    .then(() => {
      toast.success(t("message.gallery.profile_icon_changed"));
    })
    .catch(logError);
}

function compareCurrentVRCPlusIcon(userIcon: string) {
  return isCurrentFile(currentUser.value.iconUrl, userIcon);
}

function deleteVRCPlusIcon(fileId: string) {
  deleteFileAndRemove(fileId, VRCPlusIconsTable.value);
}

async function uploadSticker(base64Body: string) {
  const params: MaskUploadParams = {
    tag: "sticker",
    maskTag: "square",
  };
  const args = await vrcPlusImageRequest.uploadSticker(base64Body, params);
  handleStickerAdd(args);
}

function onFileChangeSticker(e: Event) {
  openImageUploadFlow(e, {
    inputSelector: "#StickerUploadButton",
    aspectRatio: 1 / 1,
    upload: async ({ base64Body }) => {
      await uploadSticker(base64Body);
    },
  });
}

function displayStickerUpload() {
  triggerFileInput("StickerUploadButton");
}

function deleteSticker(fileId: string) {
  deleteFileAndRemove(fileId, stickerTable.value);
}

async function handleDropGallery(event: DragEvent) {
  event.preventDefault();
  for (const file of event.dataTransfer?.files ?? []) {
    const b64str = await readFileToBase64Str(file);
    await uploadGalleryImage(b64str);
  }
}

async function handleDropIcon(event: DragEvent) {
  event.preventDefault();
  for (const file of event.dataTransfer?.files ?? []) {
    const b64str = await readFileToBase64Str(file);
    await uploadVRCPlusIcon(b64str);
  }
}

async function handleDropSticker(event: DragEvent) {
  event.preventDefault();
  for (const file of event.dataTransfer?.files ?? []) {
    const b64str = await readFileToBase64Str(file);
    await uploadSticker(b64str);
  }
}
</script>
