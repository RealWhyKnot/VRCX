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
        <div @dragover.prevent @drop.prevent="handleDropEmoji">
          <input id="EmojiUploadButton" type="file" accept="image/*" class="hidden" @change="onFileChangeEmoji" />
          <div class="flex flex-col gap-2">
            <div class="flex items-center gap-2">
              <ButtonGroup>
                <Button variant="outline" size="sm" @click="refreshEmojiTable">
                  <RefreshCw />
                  {{ t("dialog.gallery_icons.refresh") }}
                </Button>
                <Button variant="outline" size="sm" :disabled="!isLocalUserVrcPlusSupporter || isUploading" @click="displayEmojiUpload">
                  <Upload />
                  {{ t("dialog.gallery_icons.upload") }}
                </Button>
              </ButtonGroup>
              <div class="flex-1 min-w-0 max-w-120">
                <VirtualCombobox
                  v-model="emojiAnimationStyle"
                  :groups="emojiStylePickerGroups"
                  :placeholder="t('dialog.gallery_icons.emoji_animation_styles')"
                  :search-placeholder="t('dialog.gallery_icons.emoji_animation_styles')"
                  :clearable="false"
                  :close-on-select="true"
                >
                  <template #item="{ item, selected }">
                    <div class="flex w-full items-center gap-2">
                      <div class="h-10 w-10 shrink-0 overflow-hidden rounded-sm bg-black/5">
                        <img class="h-full w-full object-cover" :src="emojiStyleImageUrl(item.value)" loading="lazy" />
                      </div>
                      <span class="truncate text-sm" v-text="item.label"></span>
                      <span v-if="selected" class="ml-auto opacity-70">✓</span>
                    </div>
                  </template>
                </VirtualCombobox>
              </div>
              <label class="inline-flex items-center gap-2">
                <Checkbox v-model="emojiAnimType" />
                <span>{{ t("dialog.gallery_icons.emoji_animation_type") }}</span>
              </label>
            </div>
            <div v-if="emojiAnimType" class="flex items-center gap-2">
              <Button size="sm" variant="outline" @click="openExternalLink('https://vrcemoji.com')">
                {{ t("dialog.gallery_icons.create_animated_emoji") }}
              </Button>
              <span class="text-sm">{{ t("dialog.gallery_icons.emoji_animation_fps") }}</span>
              <NumberField v-model="emojiAnimFps" :min="1" :max="64" :step="1" :format-options="{ maximumFractionDigits: 0 }" class="w-28">
                <NumberFieldContent>
                  <NumberFieldDecrement />
                  <NumberFieldInput />
                  <NumberFieldIncrement />
                </NumberFieldContent>
              </NumberField>
              <span class="text-sm">{{ t("dialog.gallery_icons.emoji_animation_frame_count") }}</span>
              <NumberField v-model="emojiAnimFrameCount" :min="2" :max="64" :step="1" :format-options="{ maximumFractionDigits: 0 }" class="w-28">
                <NumberFieldContent>
                  <NumberFieldDecrement />
                  <NumberFieldInput />
                  <NumberFieldIncrement />
                </NumberFieldContent>
              </NumberField>
              <label class="inline-flex items-center gap-2">
                <Checkbox v-model="emojiAnimLoopPingPong" />
                <span>{{ t("dialog.gallery_icons.emoji_loop_pingpong") }}</span>
              </label>
            </div>
            <span v-if="emojiAnimType" class="basis-full text-sm text-muted-foreground">{{ t("dialog.gallery_icons.flipbook_info") }}</span>
          </div>
          <ItemGroup class="grid gap-3 mt-3 grid-cols-[repeat(auto-fill,minmax(160px,1fr))]">
            <Item v-for="image in emojiTable" :key="image.id" variant="outline" size="sm" class="p-0 x-hover-card hover:bg-accent hover:shadow-sm" as-child>
              <div v-if="latestFileUrl(image)" class="overflow-hidden">
                <ItemHeader class="cursor-pointer" @click="openFullscreen(latestFileUrl(image), emojiFileName(image))">
                  <Emoji :image-url="latestFileUrl(image)" class="aspect-square w-full rounded-t-md" />
                </ItemHeader>
                <ItemContent class="min-w-0 px-2.5 pt-1.5 pb-0">
                  <ItemDescription class="text-xs flex items-center gap-1 flex-wrap">
                    <span v-if="image.loopStyle === 'pingpong'">
                      <RefreshCw class="size-3" />
                    </span>
                    <span>{{ image.animationStyle }}</span>
                    <span v-if="image.framesOverTime">{{ image.framesOverTime }}fps</span>
                    <span v-if="image.frames">{{ image.frames }}frames</span>
                  </ItemDescription>
                </ItemContent>
                <ItemFooter class="p-2 gap-1">
                  <Button size="icon-sm" variant="ghost" class="rounded-full text-destructive" @click="deleteEmoji(image.id)">
                    <Trash2 />
                  </Button>
                </ItemFooter>
              </div>
            </Item>
          </ItemGroup>
        </div>
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
        <div @dragover.prevent @drop.prevent="handleDropPrint">
          <input id="PrintUploadButton" type="file" accept="image/*" class="hidden" @change="onFileChangePrint" />
          <div class="flex items-center">
            <ButtonGroup>
              <Button variant="outline" size="sm" @click="refreshPrintTable">
                <RefreshCw />
                {{ t("dialog.gallery_icons.refresh") }}
              </Button>
              <Button variant="outline" size="sm" :disabled="!isLocalUserVrcPlusSupporter || isUploading" @click="displayPrintUpload">
                <Upload />
                {{ t("dialog.gallery_icons.upload") }}
              </Button>
            </ButtonGroup>
            <InputGroupTextareaField
              v-model="printUploadNote"
              :rows="1"
              :maxlength="32"
              class="ml-2 w-[300px]"
              :placeholder="t('dialog.gallery_icons.note')"
              input-class="resize-none min-h-0"
            />
            <label class="inline-flex items-center gap-2 ml-2 mr-2">
              <Checkbox v-model="printCropBorder" />
              <span>{{ t("dialog.gallery_icons.crop_print_border") }}</span>
            </label>
          </div>
          <ItemGroup class="grid gap-3 mt-3 grid-cols-[repeat(auto-fill,minmax(200px,1fr))]">
            <Item v-for="image in printTable" :key="image.id" variant="outline" size="sm" class="p-0 x-hover-card hover:bg-accent hover:shadow-sm" as-child>
              <div class="overflow-hidden">
                <ItemHeader class="cursor-pointer" @click="openFullscreen(image.files.image, getPrintFileName(image))">
                  <img :src="image.files.image" loading="lazy" class="aspect-[16/9] w-full rounded-t-md object-cover" />
                </ItemHeader>
                <ItemContent class="min-w-0 px-2.5 pt-1.5 pb-0">
                  <ItemTitle v-if="image.note" class="truncate text-sm">
                    {{ image.note }}
                  </ItemTitle>
                  <ItemDescription class="text-xs truncate">
                    <Location v-if="image.worldId" :location="image.worldId" :hint="image.worldName" />
                    <span v-else>&nbsp;</span>
                  </ItemDescription>
                  <ItemDescription class="text-xs truncate font-mono">
                    <DisplayName v-if="image.authorId" :userid="image.authorId" :hint="image.authorName" />
                    <span v-else>&nbsp;</span>
                  </ItemDescription>
                  <ItemDescription v-if="image.createdAt" class="text-[11px] truncate font-mono">
                    {{ formatDateFilter(image.createdAt, "long") }}
                  </ItemDescription>
                </ItemContent>
                <ItemFooter class="p-2 gap-1">
                  <Button size="icon-sm" variant="ghost" class="rounded-full text-destructive" @click="deletePrint(image.id)">
                    <Trash2 />
                  </Button>
                  <Button size="icon-sm" variant="ghost" class="rounded-full ml-auto" @click="toggleFavoritePrint(image.id)">
                    <Star :class="favoritePrintIds.has(image.id) ? 'text-yellow-500 fill-yellow-500' : 'hover:text-yellow-500'" />
                  </Button>
                </ItemFooter>
              </div>
            </Item>
          </ItemGroup>
        </div>
      </template>

      <template #inventory>
        <div>
          <div class="flex items-center gap-2 flex-wrap">
            <ButtonGroup>
              <Button variant="outline" size="sm" @click="getInventory">
                <RefreshCw />
                {{ t("dialog.gallery_icons.refresh") }}
              </Button>
              <Button variant="outline" size="sm" @click="redeemReward">
                <Gift />
                {{ t("dialog.gallery_icons.redeem") }}
              </Button>
            </ButtonGroup>
            <Select v-model="inventoryTypeFilter">
              <SelectTrigger size="sm" class="w-44">
                <SelectValue :placeholder="t('dialog.gallery_icons.all_types')" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="all">{{ t("dialog.gallery_icons.all_types") }}</SelectItem>
                  <SelectItem v-for="type in inventoryTypeOptions" :key="type" :value="type">
                    {{ type }}
                  </SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
          <ItemGroup class="grid gap-3 mt-3 grid-cols-[repeat(auto-fill,minmax(180px,1fr))]">
            <Item
              v-for="item in filteredInventoryTable"
              :key="item.id"
              variant="outline"
              size="sm"
              class="p-0 pb-4 x-hover-card hover:bg-accent hover:shadow-sm"
              as-child
            >
              <div class="overflow-hidden">
                <ItemHeader class="cursor-pointer" @click="openFullscreen(item.imageUrl)">
                  <img :src="item.imageUrl" loading="lazy" class="aspect-square w-full rounded-t-md object-cover" />
                </ItemHeader>
                <ItemContent class="min-w-0 px-2.5 pt-1.5 pb-0">
                  <ItemTitle class="truncate text-sm">
                    {{ item.name }}
                  </ItemTitle>
                  <ItemDescription v-if="item.description" class="text-xs truncate">
                    {{ item.description }}
                  </ItemDescription>
                  <ItemDescription class="text-[11px] truncate font-mono">
                    {{ formatDateFilter(item.created_at, "long") }}
                  </ItemDescription>
                  <ItemDescription class="text-xs">{{ item.itemTypeLabel || item.itemType }}</ItemDescription>
                </ItemContent>
                <ItemFooter v-if="item.itemType === 'bundle'" class="p-2">
                  <Button size="sm" @click="consumeInventoryBundle(item.id)">
                    {{ t("dialog.gallery_icons.consume_bundle") }}
                  </Button>
                </ItemFooter>
              </div>
            </Item>
          </ItemGroup>
        </div>
      </template>
    </TabsUnderline>

    <ImageCropDialog
      :open="cropDialogOpen"
      :title="cropDialogTitle"
      :aspect-ratio="cropDialogAspectRatio"
      :file="cropDialogFile"
      @update:open="cropDialogOpen = $event"
      @confirm="onCropConfirm"
    />
  </div>
</template>

<script setup lang="ts">
import Location from "@/components/Location.vue";
defineOptions({ name: "GalleryView" });

import { ArrowLeft, Check, Gift, RefreshCw, Trash2, Upload, X, Star } from "lucide-vue-next";
import NumberField from "@/components/ui/number-field/NumberField.vue";
import NumberFieldContent from "@/components/ui/number-field/NumberFieldContent.vue";
import NumberFieldDecrement from "@/components/ui/number-field/NumberFieldDecrement.vue";
import NumberFieldIncrement from "@/components/ui/number-field/NumberFieldIncrement.vue";
import NumberFieldInput from "@/components/ui/number-field/NumberFieldInput.vue";
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import Button from "@/components/ui/button/Button.vue";
import ButtonGroup from "@/components/ui/button-group/ButtonGroup.vue";
import Checkbox from "@/components/ui/checkbox/Checkbox.vue";
import InputGroupTextareaField from "@/components/ui/input-group/InputGroupTextareaField.vue";
import Select from "@/components/ui/select/Select.vue";
import SelectContent from "@/components/ui/select/SelectContent.vue";
import SelectGroup from "@/components/ui/select/SelectGroup.vue";
import SelectItem from "@/components/ui/select/SelectItem.vue";
import SelectTrigger from "@/components/ui/select/SelectTrigger.vue";
import SelectValue from "@/components/ui/select/SelectValue.vue";
import TabsUnderline from "@/components/ui/tabs/TabsUnderline.vue";
import VirtualCombobox from "@/components/ui/virtual-combobox/VirtualCombobox.vue";
import Item from "@/components/ui/item/Item.vue";
import ItemContent from "@/components/ui/item/ItemContent.vue";
import ItemDescription from "@/components/ui/item/ItemDescription.vue";
import ItemFooter from "@/components/ui/item/ItemFooter.vue";
import ItemGroup from "@/components/ui/item/ItemGroup.vue";
import ItemHeader from "@/components/ui/item/ItemHeader.vue";
import ItemTitle from "@/components/ui/item/ItemTitle.vue";
import { storeToRefs } from "pinia";
import { toast } from "vue-sonner";
import { useI18n } from "vue-i18n";
import { useRoute, useRouter } from "vue-router";
import type { ImageAnimationStyle, ImageLoopStyle, ImageMask } from "vrchat";

import { extractFileId } from "../../shared/utils/file-utils";
import { formatDateFilter } from "../../coordinators/date-coordinator";
import { getEmojiFileName, getPrintFileName } from "../../shared/utils/gallery";
import { openExternalLink } from "../../shared/utils/app-actions";
import { inventoryRequest } from "../../api/inventory";
import { miscRequest } from "../../api/misc";
import { userRequest } from "../../api/user";
import { vrcPlusIconRequest } from "../../api/vrc-plus-icon";
import { vrcPlusImageRequest } from "../../api/vrc-plus-image";
import { useAdvancedSettingsStore } from "../../stores/settings/advanced";
import { useAuthStore } from "../../stores/auth";
import { useGalleryStore } from "../../stores/gallery";
import type { GalleryFile } from "../../stores/gallery-types";
import { useModalStore } from "../../stores/modal";
import { useUserStore } from "../../stores/user";
import { readFileAsBase64, withUploadTimeout } from "../../shared/utils/image-upload";
import { handleImageUploadInput } from "../../coordinators/image-upload-coordinator";
import { emojiAnimationStyleList, emojiAnimationStyleUrl } from "../../shared/constants/emoji";
import { AppDebug } from "../../services/app-config";
import { parseLeadingInt } from "../../stores/vrcx-messages";

import Emoji from "../../components/Emoji.vue";
import ImageCropDialog from "../../components/dialogs/ImageCropDialog.vue";
import { database } from "../../services/database";

type EmojiFileNameInfo = {
  name: string;
  animationStyle: string;
  frames?: number;
  framesOverTime?: number;
  loopStyle?: ImageLoopStyle;
};

type EmojiUploadParams = {
  tag: "emoji" | "emojianimated";
  animationStyle: ImageAnimationStyle;
  maskTag: ImageMask;
  frames?: number;
  framesOverTime?: number;
  loopStyle?: ImageLoopStyle;
};

type MaskUploadParams = {
  tag: "sticker";
  maskTag: ImageMask;
};

type ImageUploadPayload = {
  file: File;
  blob: Blob;
  base64Body: string;
};

type ImageUploadFlowOptions = {
  inputSelector: string;
  aspectRatio: number;
  beforeCrop?: (file: File) => void;
  upload: (payload: ImageUploadPayload) => Promise<void>;
  errorMessage?: string;
};

type CropUploadHandler = (blob: Blob) => Promise<void>;

const imageAnimationStyles = [
  "aura",
  "bats",
  "bees",
  "bounce",
  "cloud",
  "confetti",
  "crying",
  "dislike",
  "fire",
  "idea",
  "lasers",
  "like",
  "magnet",
  "mistletoe",
  "money",
  "noise",
  "orbit",
  "pizza",
  "rain",
  "rotate",
  "shake",
  "snow",
  "snowball",
  "spin",
  "splash",
  "stop",
  "zzz",
] as const satisfies readonly ImageAnimationStyle[];

function isImageAnimationStyle(value: string): value is ImageAnimationStyle {
  return imageAnimationStyles.some((style) => style === value);
}

function logError(error: unknown) {
  console.error(error);
}

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
const modalStore = useModalStore();

const {
  galleryTable,
  galleryDialogVisible,
  VRCPlusIconsTable,
  printUploadNote,
  printCropBorder,
  stickerTable,
  printTable,
  favoritePrintIds,
  emojiTable,
  inventoryTable,
} = storeToRefs(useGalleryStore());
const {
  loadGalleryData,
  refreshGalleryTable,
  refreshVRCPlusIconsTable,
  refreshStickerTable,
  refreshPrintTable,
  refreshEmojiTable,
  getInventory,
  handleStickerAdd,
  handleGalleryImageAdd,
} = useGalleryStore();

const { currentUserInventory } = storeToRefs(useAdvancedSettingsStore());
const { showFullscreenImageDialog } = useGalleryStore();
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

const emojiAnimFps = ref(15);
const emojiAnimFrameCount = ref(4);
const emojiAnimType = ref(false);
const emojiAnimationStyle = ref("Stop");
const emojiAnimLoopPingPong = ref<boolean | string>(false);
const inventoryTypeFilter = ref("all");

const emojiStyleFileNames = new Map(Object.entries(emojiAnimationStyleList));

function emojiStyleImageUrl(value: string | number): string {
  return `${emojiAnimationStyleUrl}${emojiStyleFileNames.get(String(value)) ?? ""}`;
}

const emojiStylePickerGroups = computed(() => [
  {
    key: "emojiAnimationStyles",
    label: t("dialog.gallery_icons.emoji_animation_styles"),
    items: Object.keys(emojiAnimationStyleList).map((styleName) => ({
      value: styleName,
      label: styleName,
      search: styleName,
    })),
  },
]);

const pendingUploads = ref(0);
const isUploading = computed(() => pendingUploads.value > 0);

const inventoryTypeOptions = computed(() => {
  const optionsByType = new Set<string>();
  for (const item of inventoryTable.value) {
    if (optionsByType.has(item.itemTypeLabel)) {
      continue;
    }
    optionsByType.add(item.itemTypeLabel);
  }
  return Array.from(optionsByType.values()).sort((a, b) => a.localeCompare(b));
});

const filteredInventoryTable = computed(() => {
  const selectedType = inventoryTypeFilter.value;
  if (selectedType === "all") {
    return inventoryTable.value;
  }

  return inventoryTable.value.filter((item) => item.itemTypeLabel === selectedType);
});

const cropDialogOpen = ref(false);
const cropDialogTitle = ref("");
const cropDialogAspectRatio = ref(4 / 3);
const cropDialogFile = ref<File | null>(null);
const cropDialogUploadHandler = ref<CropUploadHandler | null>(null);

onMounted(() => {
  galleryDialogVisible.value = true;
  loadGalleryData();
});

onBeforeUnmount(() => {
  galleryDialogVisible.value = false;
});

function latestFileUrl(file: GalleryFile): string {
  const latestVersion = file.versions.at(-1);
  return latestVersion?.file?.url ?? "";
}

function emojiFileName(image: GalleryFile): string {
  const info: EmojiFileNameInfo = {
    name: image.name,
    animationStyle: String(image.animationStyle),
  };
  if (image.frames !== undefined) {
    info.frames = image.frames;
  }
  if (image.framesOverTime !== undefined) {
    info.framesOverTime = image.framesOverTime;
  }
  if (image.loopStyle !== undefined) {
    info.loopStyle = image.loopStyle;
  }
  return getEmojiFileName(info);
}

function openFullscreen(imageUrl: string | undefined, fileName?: string) {
  showFullscreenImageDialog(imageUrl ?? "", fileName ?? "");
}

function startUpload() {
  pendingUploads.value += 1;
}

function finishUpload() {
  pendingUploads.value = Math.max(0, pendingUploads.value - 1);
}

function goBack() {
  galleryDialogVisible.value = false;
  void router.push({ name: "tools" }).catch(logError);
}

function triggerFileInput(id: string) {
  document.getElementById(id)?.click();
}

function removeItemById(array: { id: string }[], itemId: string) {
  const { length } = array;
  for (let i = 0; i < length; ++i) {
    if (itemId === array[i]?.id) {
      array.splice(i, 1);
      break;
    }
  }
}

function openCropDialog(file: File, title: string, aspectRatio: number, handler: CropUploadHandler) {
  cropDialogTitle.value = title;
  cropDialogAspectRatio.value = aspectRatio;
  cropDialogFile.value = file;
  cropDialogUploadHandler.value = handler;
  cropDialogOpen.value = true;
}

async function onCropConfirm(blob: File | Blob | null) {
  const handler = cropDialogUploadHandler.value;
  if (!handler) {
    return;
  }
  cropDialogUploadHandler.value = null;
  cropDialogFile.value = null;
  if (blob === null) {
    cropDialogOpen.value = false;
    return;
  }
  try {
    await handler(blob);
  } finally {
    cropDialogOpen.value = false;
  }
}

function deleteFileAndRemove(fileId: string, array: GalleryFile[]) {
  void miscRequest
    .deleteFile(fileId)
    .then((args) => {
      removeItemById(array, args.fileId);
    })
    .catch(logError);
}

function isCurrentFile(currentUrl: string, fileId: string) {
  return fileId === extractFileId(currentUrl);
}

function openImageUploadFlow(e: Event, { inputSelector, aspectRatio, beforeCrop, upload, errorMessage = "Failed to upload" }: ImageUploadFlowOptions) {
  const { file, clearInput } = handleImageUploadInput(e, {
    inputSelector,
    tooLargeMessage: () => t("message.file.too_large"),
    invalidTypeMessage: () => t("message.file.not_image"),
  });
  if (!file) {
    return;
  }
  beforeCrop?.(file);
  clearInput();
  openCropDialog(file, t("dialog.change_content_image.upload"), aspectRatio, async (blob) => {
    startUpload();
    try {
      await withUploadTimeout(
        (async () => {
          const base64Body = await readFileAsBase64(blob);
          await upload({
            file,
            blob,
            base64Body,
          });
        })()
      );
      toast.success(t("message.upload.success"));
    } catch (error) {
      console.error(errorMessage, error);
      toast.error(t("message.upload.error"));
    } finally {
      finishUpload();
    }
  });
}

async function uploadGalleryImage(base64Body: string) {
  const args = await vrcPlusImageRequest.uploadGalleryImage(base64Body);
  handleGalleryImageAdd(args);
}

function onFileChangeGallery(e: Event) {
  openImageUploadFlow(e, {
    inputSelector: "#GalleryUploadButton",
    aspectRatio: 4 / 3,
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

function parseEmojiFileName(fileName: string) {
  const baseName = fileName.replace(/\.[^/.]+$/, "");
  const array = baseName.split("_");
  for (const value of array) {
    if (value.endsWith("animationStyle")) {
      emojiAnimType.value = false;
      emojiAnimationStyle.value = value.replace("animationStyle", "").toLowerCase();
    }
    if (value.endsWith("frames")) {
      emojiAnimType.value = true;
      emojiAnimFrameCount.value = parseLeadingInt(value.replace("frames", ""));
    }
    if (value.endsWith("fps")) {
      emojiAnimFps.value = parseLeadingInt(value.replace("fps", ""));
    }
    if (value.endsWith("loopStyle")) {
      emojiAnimLoopPingPong.value = value.replace("loopStyle", "").toLowerCase();
    }
  }
}

async function uploadEmoji(base64Body: string) {
  const animationStyle = emojiAnimationStyle.value.toLowerCase();
  if (!isImageAnimationStyle(animationStyle)) {
    throw new Error(`unsupported emoji animation style: ${animationStyle}`);
  }
  const params: EmojiUploadParams = {
    tag: emojiAnimType.value ? "emojianimated" : "emoji",
    animationStyle,
    maskTag: "square",
  };
  if (emojiAnimType.value) {
    params.frames = emojiAnimFrameCount.value;
    params.framesOverTime = emojiAnimFps.value;
  }
  if (emojiAnimLoopPingPong.value) {
    params.loopStyle = "pingpong";
  }
  const args = await vrcPlusImageRequest.uploadEmoji(base64Body, params);
  if (emojiTable.value.length > 0) {
    emojiTable.value.unshift(args.json);
  }
}

function onFileChangeEmoji(e: Event) {
  openImageUploadFlow(e, {
    inputSelector: "#EmojiUploadButton",
    aspectRatio: 1 / 1,
    beforeCrop: (file) => {
      parseEmojiFileName(file.name);
    },
    upload: async ({ base64Body }) => {
      await uploadEmoji(base64Body);
    },
  });
}

function displayEmojiUpload() {
  triggerFileInput("EmojiUploadButton");
}

function deleteEmoji(fileId: string) {
  deleteFileAndRemove(fileId, emojiTable.value);
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

async function uploadPrint(base64Body: string, date: Date) {
  const timestamp = date.toISOString().slice(0, 19);
  const params = {
    note: printUploadNote.value,

    timestamp,
  };
  const isCropWhiteBorder = printCropBorder.value;
  const args = await vrcPlusImageRequest.uploadPrint(base64Body, isCropWhiteBorder, params);
  if (printTable.value.length > 0) {
    printTable.value.unshift(args.json);
  }
}

function onFileChangePrint(e: Event) {
  openImageUploadFlow(e, {
    inputSelector: "#PrintUploadButton",
    aspectRatio: 16 / 9,
    upload: async ({ base64Body }) => {
      const date = new Date();
      date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
      await uploadPrint(base64Body, date);
    },
  });
}

function displayPrintUpload() {
  triggerFileInput("PrintUploadButton");
}

function deletePrint(printId: string) {
  if (favoritePrintIds.value.has(printId)) {
    toast.warning("This print is in your favorites", {
      description: "Please remove it from your favorites before deleting it.",
    });
    return;
  }
  void vrcPlusImageRequest
    .deletePrint(printId)
    .then((args) => {
      removeItemById(printTable.value, args.printId);
    })
    .catch(logError);
}

function toggleFavoritePrint(printId: string) {
  if (favoritePrintIds.value.has(printId)) {
    database.removePrintFromFavorites(printId);
    favoritePrintIds.value.delete(printId);
  } else {
    database.addPrintToFavorites(printId);
    favoritePrintIds.value.add(printId);
  }
}

function readFileDate(file: File): Date {
  const lastModifiedDate: unknown = Reflect.get(file, "lastModifiedDate");
  return lastModifiedDate instanceof Date ? lastModifiedDate : new Date();
}

async function readFileToBase64Str(file: File) {
  if (!file.type.startsWith("image/")) {
    throw new Error(`unrecognized image format: ${file.type}`);
  }
  return readFileAsBase64(file);
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

async function handleDropEmoji(event: DragEvent) {
  event.preventDefault();
  for (const file of event.dataTransfer?.files ?? []) {
    const b64str = await readFileToBase64Str(file);
    await uploadEmoji(b64str);
  }
}

async function handleDropSticker(event: DragEvent) {
  event.preventDefault();
  for (const file of event.dataTransfer?.files ?? []) {
    const b64str = await readFileToBase64Str(file);
    await uploadSticker(b64str);
  }
}

async function handleDropPrint(event: DragEvent) {
  event.preventDefault();
  for (const file of event.dataTransfer?.files ?? []) {
    const b64str = await readFileToBase64Str(file);
    const fileDate = readFileDate(file);
    await uploadPrint(b64str, fileDate);
  }
}

async function consumeInventoryBundle(inventoryId: string) {
  try {
    await inventoryRequest.consumeInventoryBundle({
      inventoryId,
    });
    currentUserInventory.value.delete(inventoryId);
    removeItemById(inventoryTable.value, inventoryId);
    void getInventory().catch(logError);
  } catch (error) {
    console.error("Error consuming inventory bundle:", error);
  }
}

function redeemReward() {
  void modalStore
    .prompt({
      title: t("prompt.redeem.header"),
      description: t("prompt.redeem.description"),
      confirmText: t("prompt.redeem.redeem"),
      cancelText: t("prompt.redeem.cancel"),
    })
    .then(({ ok, value }) => {
      if (!ok) return;
      if (value) {
        void inventoryRequest
          .redeemReward({
            code: value.trim(),
          })
          .then(() => {
            toast.success(t("prompt.redeem.success"));
            void getInventory().catch(logError);
          })
          .catch((error: unknown) => {
            console.error("Error redeeming reward:", error);
          });
      }
    })
    .catch(logError);
}
</script>
