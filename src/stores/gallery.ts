import { reactive, ref, shallowReactive, watch } from "vue";
import type { Ref } from "vue";
import { defineStore } from "pinia";
import { toast } from "vue-sonner";
import { useI18n } from "vue-i18n";

import { convertFileUrlToImageUrl } from "../shared/utils/common";
import { getEmojiFileName, getPrintFileName, getPrintLocalDate } from "../shared/utils/gallery";
import { openExternalLink } from "../shared/utils/app-actions";
import { parseFileSaveResult } from "../shared/utils/file-save-result";
import type { FileSaveResult } from "../shared/utils/file-save-result";
import { inventoryRequest } from "../api/inventory";
import { queryRequest } from "../api/query-request";
import { vrcPlusIconRequest } from "../api/vrc-plus-icon";
import { vrcPlusImageRequest } from "../api/vrc-plus-image";
import { AppDebug } from "../services/app-config";
import { handleImageUploadInput } from "../coordinators/image-upload-coordinator";
import { router } from "../plugins/router";
import { useAdvancedSettingsStore } from "./settings/advanced";
import { useAuthStore } from "./auth";
import { useModalStore } from "./modal";
import { watchState } from "../services/watch-state";
import { database } from "../services/database";
import type { GalleryFileListArgs, GalleryFileRequestArgs, GalleryFile, GalleryInventoryItem, GalleryPrint, GalleryState } from "./gallery-types";

import * as workerTimers from "worker-timers";

const BINARY_CHUNK_SIZE = 0x8000;

function bytesToBinaryString(bytes: Uint8Array): string {
  const chunks: string[] = [];
  for (let offset = 0; offset < bytes.length; offset += BINARY_CHUNK_SIZE) {
    chunks.push(String.fromCharCode(...bytes.subarray(offset, offset + BINARY_CHUNK_SIZE)));
  }
  return chunks.join("");
}

function logRejection(message: string) {
  return (error: unknown) => {
    console.error(message, error);
  };
}

function hasOkResult(value: unknown): boolean {
  return typeof value === "object" && value !== null && "ok" in value && Boolean(value.ok);
}

export const useGalleryStore = defineStore("Gallery", () => {
  const advancedSettingsStore = useAdvancedSettingsStore();
  const authStore = useAuthStore();
  const { t } = useI18n();
  const modalStore = useModalStore();

  const state = reactive<GalleryState>({
    printCache: [],
    printQueue: [],
    printQueueWorker: null,
    instanceInventoryCache: [],
    instanceInventoryQueue: [],
    instanceInventoryQueueWorker: null,
  });

  const cachedEmoji = shallowReactive(new Map<string, GalleryFile>());

  const galleryTable = ref<GalleryFile[]>([]);

  const galleryDialogVisible = ref(false);

  const galleryDialogGalleryLoading = ref(false);

  const galleryDialogIconsLoading = ref(false);

  const galleryDialogEmojisLoading = ref(false);

  const galleryDialogStickersLoading = ref(false);

  const galleryDialogPrintsLoading = ref(false);

  const galleryDialogInventoryLoading = ref(false);

  const uploadImage = ref("");

  const VRCPlusIconsTable = ref<GalleryFile[]>([]);

  const printUploadNote = ref("");

  const printCropBorder = ref(true);

  const stickerTable = ref<GalleryFile[]>([]);

  const instanceStickersCache = ref<string[]>([]);

  const printTable = ref<GalleryPrint[]>([]);

  const favoritePrintIds = ref(new Set<string | null>());

  const emojiTable = ref<GalleryFile[]>([]);

  const inventoryTable = ref<GalleryInventoryItem[]>([]);

  const fullscreenImageDialog = ref({
    visible: false,
    imageUrl: "",
    fileName: "",
  });

  watch(
    () => watchState.isLoggedIn,
    (isLoggedIn) => {
      cachedEmoji.clear();
      galleryTable.value = [];
      VRCPlusIconsTable.value = [];
      stickerTable.value = [];
      printTable.value = [];
      emojiTable.value = [];
      galleryDialogVisible.value = false;
      fullscreenImageDialog.value.visible = false;
      if (isLoggedIn) {
        tryDeleteOldPrints().catch(logRejection("Failed to delete old prints:"));
      }
    },
    { flush: "sync" }
  );

  function handleFilesList(args: GalleryFileListArgs) {
    if (args.params?.tag === "gallery") {
      galleryTable.value = args.json.reverse();
    }
    if (args.params?.tag === "icon") {
      VRCPlusIconsTable.value = args.json.reverse();
    }
    if (args.params?.tag === "sticker") {
      stickerTable.value = args.json.reverse();
      galleryDialogStickersLoading.value = false;
    }
    if (args.params?.tag === "emoji") {
      emojiTable.value = args.json.reverse();
      galleryDialogEmojisLoading.value = false;
    }
  }

  function handleGalleryImageAdd(args: GalleryFileRequestArgs) {
    if (Object.keys(galleryTable.value).length !== 0) {
      galleryTable.value.unshift(args.json);
    }
  }

  function showGalleryPage(tab: unknown) {
    galleryDialogVisible.value = true;
    const query = typeof tab === "string" ? { tab } : {};
    if (router.currentRoute.value.name === "gallery") {
      loadGalleryData();
      router.replace({ name: "gallery", query }).catch(logRejection("Failed to open gallery page:"));
      return;
    }
    router.push({ name: "gallery", query }).catch(logRejection("Failed to open gallery page:"));
  }

  function loadGalleryData() {
    refreshGalleryTable();
    refreshVRCPlusIconsTable();
    refreshEmojiTable();
    refreshStickerTable();
    refreshPrintTable().catch(logRejection("Error fetching prints:"));
    refreshPrintFavorites().catch(logRejection("Error refreshing print favorites:"));
    getInventory().catch(logRejection("Error fetching inventory items:"));
  }

  function refreshFileTable(tag: string, isLoading: Ref<boolean>, label: string) {
    isLoading.value = true;
    vrcPlusIconRequest
      .getFileList({ n: 100, tag })
      .then((args) => handleFilesList(args))
      .finally(() => {
        isLoading.value = false;
      })
      .catch(logRejection(`Error fetching ${label}:`));
  }

  function refreshGalleryTable() {
    refreshFileTable("gallery", galleryDialogGalleryLoading, "gallery files");
  }

  function refreshVRCPlusIconsTable() {
    refreshFileTable("icon", galleryDialogIconsLoading, "VRC Plus icons");
  }

  function inviteImageUpload(e: unknown) {
    const { file } = handleImageUploadInput(e, {
      inputSelector: null,
      tooLargeMessage: () => t("message.file.too_large"),
      invalidTypeMessage: () => t("message.file.not_image"),
      onClear: clearInviteImageUpload,
    });
    if (!file) {
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (reader.result instanceof ArrayBuffer) {
        uploadImage.value = btoa(bytesToBinaryString(new Uint8Array(reader.result)));
      }
    };
    reader.readAsArrayBuffer(file);
  }

  function clearInviteImageUpload() {
    const buttonList = document.querySelectorAll<HTMLInputElement>(".inviteImageUploadButton");
    buttonList.forEach((button) => {
      button.value = "";
    });
    uploadImage.value = "";
  }

  function refreshStickerTable() {
    refreshFileTable("sticker", galleryDialogStickersLoading, "stickers");
  }

  function handleStickerAdd(args: GalleryFileRequestArgs) {
    if (Object.keys(stickerTable.value).length !== 0) {
      stickerTable.value.unshift(args.json);
    }
  }

  async function trySaveStickerToFile(displayName: string, userId: string, inventoryId: string) {
    if (instanceStickersCache.value.includes(inventoryId)) {
      return;
    }
    instanceStickersCache.value.push(inventoryId);
    if (instanceStickersCache.value.length > 100) {
      instanceStickersCache.value.shift();
    }
    const args = await queryRequest.fetch("userInventoryItem", {
      inventoryId,
      userId,
    });

    if (args.json.itemType !== "sticker" || !args.json.flags.includes("ugc")) {
      return;
    }
    const imageUrl = args.json.metadata.imageUrl ?? args.json.imageUrl;
    const createdAt = args.json.created_at;
    const monthFolder = createdAt.slice(0, 7);
    const fileNameDate = createdAt.replace(/:/g, "-").replace(/T/g, "_").replace(/Z/g, "");
    const fileName = `${displayName}_${fileNameDate}_${inventoryId}.png`;
    try {
      const result = parseFileSaveResult(await AppApi.SaveStickerToFile(imageUrl, advancedSettingsStore.ugcFolderPath, monthFolder, fileName));
      if (result.status === "saved") {
        console.log(`Sticker saved to file: ${monthFolder}\\${fileName}`);
      }
      reportBlockedFolder(result, "sticker");
    } catch (e) {
      console.error("Failed to save sticker to file:", e);
    }
  }

  function reportBlockedFolder(saveResult: FileSaveResult, itemType: string) {
    if (saveResult.status !== "folderBlocked") {
      return;
    }
    modalStore
      .confirm({
        description: `Windows has blocked VRCX from creating files on your system. Please allow VRCX to create files to save ${itemType}s, would you like to see instructions on how to fix this?`,
        title: `Failed to create ${itemType} folder`,
        cancelText: "Ignore",
      })
      .then((result) => {
        if (!hasOkResult(result)) return;
        openExternalLink("https://www.youtube.com/watch?v=1mwmmCdA4D8&t=213s");
      })
      .catch(logRejection("Failed to show file save instructions:"));
    console.error(`Failed to save ${itemType} to file: the folder could not be created`);
  }

  async function refreshPrintTable() {
    galleryDialogPrintsLoading.value = true;
    const params = {
      n: 100,
    };
    try {
      const args = await vrcPlusImageRequest.getPrints(params);
      args.json.sort((a, b) => {
        return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
      });
      printTable.value = args.json;
    } catch (error) {
      console.error("Error fetching prints:", error);
    } finally {
      galleryDialogPrintsLoading.value = false;
    }
  }

  async function refreshPrintFavorites() {
    const favorites = await database.getPrintFavorites();

    favoritePrintIds.value = new Set(favorites.map((favorite) => favorite.printId));
  }

  function queueSavePrintToFile(printId: string) {
    if (state.printCache.includes(printId)) {
      return;
    }
    state.printCache.push(printId);
    if (state.printCache.length > 100) {
      state.printCache.shift();
    }

    state.printQueue.push(printId);

    if (state.printQueueWorker === null || state.printQueueWorker === 0) {
      state.printQueueWorker = workerTimers.setInterval(() => {
        const printId = state.printQueue.shift();
        if (printId) {
          trySavePrintToFile(printId).catch(logRejection("Failed to save print to file:"));
        }
      }, 2_500);
    }
  }

  async function trySavePrintToFile(printId: string) {
    const args = await vrcPlusImageRequest.getPrint({ printId });
    const imageUrl = args.json.files.image;
    if (!imageUrl) {
      console.error("Print image URL is missing", args);
      return;
    }
    const print = args.json;
    const createdAt = getPrintLocalDate(print);
    try {
      const owner = await queryRequest.fetch("user.dialog", {
        userId: print.ownerId ?? "",
      });
      console.log(`Print spawned by ${owner.json.displayName} id:${print.id} note:${print.note} authorName:${print.authorName} at:${new Date().toISOString()}`);
    } catch (err) {
      console.error(err);
    }
    const monthFolder = createdAt.toISOString().slice(0, 7);
    const fileName = getPrintFileName(print);
    try {
      const result = parseFileSaveResult(await AppApi.SavePrintToFile(imageUrl, advancedSettingsStore.ugcFolderPath, monthFolder, fileName));
      if (result.status === "saved") {
        console.log(`Print saved to file: ${monthFolder}\\${fileName}`);
        if (advancedSettingsStore.cropInstancePrints) {
          if (!(await AppApi.CropPrintImage(result.path))) {
            console.error("Failed to crop print image");
          }
        }
      }
      reportBlockedFolder(result, "print");
    } catch (e) {
      console.error("Failed to save print to file:", e);
    }

    if (state.printQueue.length === 0) {
      if (state.printQueueWorker !== null) {
        workerTimers.clearInterval(state.printQueueWorker);
      }
      state.printQueueWorker = null;
    }
  }

  function refreshEmojiTable() {
    refreshFileTable("emoji", galleryDialogEmojisLoading, "emojis");
  }

  async function getInventory() {
    inventoryTable.value = [];
    advancedSettingsStore.currentUserInventory.clear();

    galleryDialogInventoryLoading.value = true;
    try {
      for (let i = 0; i < 100; i++) {
        const args = await inventoryRequest.getInventoryItems({
          n: 100,
          offset: i * 100,
          order: "newest",
          notFlags: "ugc",
        });
        for (const item of args.json.data) {
          advancedSettingsStore.currentUserInventory.set(item.id, item);
          inventoryTable.value.push(item);
        }
        if (args.json.data.length === 0) {
          break;
        }
      }
      const globalInventory = await inventoryRequest.getGlobalInventory();
      for (const item of globalInventory.json) {
        inventoryTable.value.push(item);
      }
    } catch (error) {
      console.error("Error fetching inventory items:", error);
    } finally {
      galleryDialogInventoryLoading.value = false;
    }
  }

  async function tryDeleteOldPrints() {
    if (!advancedSettingsStore.autoDeleteOldPrints) {
      return;
    }
    await refreshPrintTable();
    await refreshPrintFavorites();
    const printLimit = authStore.cachedPermissions.maxUserPrints - 2;
    const printCount = printTable.value.length;
    if (printCount <= printLimit) {
      return;
    }
    const deleteCount = printCount - printLimit;
    if (deleteCount <= 0) {
      return;
    }
    const idList: string[] = [];
    for (let i = printCount - 1; i >= 0 && idList.length < deleteCount; i--) {
      const print = printTable.value[i];
      if (print === undefined || favoritePrintIds.value.has(print.id)) {
        continue;
      }
      idList.push(print.id);
    }
    console.log(`Deleting ${idList.length} old prints`, idList);
    if (idList.length < deleteCount) {
      console.log(`Unable to automatically delete enough old prints because ${deleteCount - idList.length} print(s) are protected by favorites.`);
    }
    try {
      for (const printId of idList) {
        await vrcPlusImageRequest.deletePrint(printId);
        const text = `Old print automatically deleted: ${printId}`;
        if (AppDebug.errorNoty) {
          toast.dismiss(AppDebug.errorNoty);
        }
        AppDebug.errorNoty = toast.info(text);
      }
    } catch (err) {
      console.error("Failed to delete old print:", err);
    }
    await refreshPrintTable();
  }

  function showFullscreenImageDialog(imageUrl: string, fileName = "") {
    if (!imageUrl) {
      return;
    }
    const D = fullscreenImageDialog.value;
    D.imageUrl = convertFileUrlToImageUrl(imageUrl, 10_000);
    D.fileName = fileName;
    D.visible = true;
  }

  function queueCheckInstanceInventory(inventoryId: string, userId: string) {
    if (state.instanceInventoryCache.includes(inventoryId) || instanceStickersCache.value.includes(inventoryId)) {
      return;
    }
    state.instanceInventoryCache.push(inventoryId);
    if (state.instanceInventoryCache.length > 100) {
      state.instanceInventoryCache.shift();
    }

    state.instanceInventoryQueue.push({ inventoryId, userId });

    if (state.instanceInventoryQueueWorker === null || state.instanceInventoryQueueWorker === 0) {
      state.instanceInventoryQueueWorker = workerTimers.setInterval(() => {
        const item = state.instanceInventoryQueue.shift();
        if (item?.inventoryId) {
          trySaveEmojiToFile(item.inventoryId, item.userId).catch(logRejection("Failed to save emoji to file:"));
        }
      }, 2_500);
    }
  }

  async function trySaveEmojiToFile(inventoryId: string, userId: string) {
    const args: { json: GalleryInventoryItem } = await queryRequest.fetch("userInventoryItem", {
      inventoryId,
      userId,
    });

    if (args.json.itemType !== "emoji" || !args.json.flags.includes("ugc")) {
      return;
    }

    const userArgs = await queryRequest.fetch("user.dialog", {
      userId: args.json.holderId,
    });
    const displayName = userArgs.json.displayName;

    const emoji = args.json.metadata;
    const emojiFileName = getEmojiFileName({
      name: `${displayName}_${inventoryId}`,
      animationStyle: String(emoji.animationStyle),
      frames: emoji.frames ?? null,
      framesOverTime: emoji.framesOverTime ?? null,
      loopStyle: emoji.loopStyle ?? null,
    });
    const imageUrl = args.json.metadata.imageUrl ?? args.json.imageUrl;
    const createdAt = args.json.created_at;
    const monthFolder = createdAt.slice(0, 7);

    try {
      const result = parseFileSaveResult(await AppApi.SaveEmojiToFile(imageUrl, advancedSettingsStore.ugcFolderPath, monthFolder, emojiFileName));
      if (result.status === "saved") {
        console.log(`Emoji saved to file: ${monthFolder}\\${emojiFileName}`);
      }
      reportBlockedFolder(result, "emoji");
    } catch (e) {
      console.error("Failed to save emoji to file:", e);
    }

    if (state.instanceInventoryQueue.length === 0) {
      if (state.instanceInventoryQueueWorker !== null) {
        workerTimers.clearInterval(state.instanceInventoryQueueWorker);
      }
      state.instanceInventoryQueueWorker = null;
    }
  }

  async function getCachedEmoji(fileId: string) {
    const cached = cachedEmoji.get(fileId);
    if (typeof cached !== "undefined") {
      return cached;
    }
    const args = await queryRequest.fetch("file", { fileId });
    cachedEmoji.set(fileId, args.json);
    return args.json;
  }

  return {
    state,

    galleryTable,
    galleryDialogVisible,
    galleryDialogGalleryLoading,
    galleryDialogIconsLoading,
    galleryDialogEmojisLoading,
    galleryDialogStickersLoading,
    galleryDialogPrintsLoading,
    galleryDialogInventoryLoading,
    uploadImage,
    VRCPlusIconsTable,
    printUploadNote,
    printCropBorder,
    stickerTable,
    instanceStickersCache,
    printTable,
    favoritePrintIds,
    emojiTable,
    inventoryTable,
    fullscreenImageDialog,
    cachedEmoji,

    showGalleryPage,
    loadGalleryData,
    refreshGalleryTable,
    refreshVRCPlusIconsTable,
    inviteImageUpload,
    clearInviteImageUpload,
    refreshStickerTable,
    trySaveStickerToFile,
    refreshPrintTable,
    refreshPrintFavorites,
    queueSavePrintToFile,
    refreshEmojiTable,
    getInventory,
    tryDeleteOldPrints,
    showFullscreenImageDialog,
    handleStickerAdd,
    handleGalleryImageAdd,
    handleFilesList,
    queueCheckInstanceInventory,
    getCachedEmoji,
  };
});
