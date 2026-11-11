import { storeToRefs } from "pinia";
import { toast } from "vue-sonner";
import { vrcPlusImageRequest } from "../../../api/vrc-plus-image";
import { database } from "../../../services/database";
import { useGalleryStore } from "../../../stores/gallery";
import { logError, readFileToBase64Str, removeItemById, triggerFileInput } from "./gallery-file-actions";
import type { GalleryUpload } from "./use-gallery-upload";

function readFileDate(file: File): Date {
  const lastModifiedDate: unknown = Reflect.get(file, "lastModifiedDate");
  return lastModifiedDate instanceof Date ? lastModifiedDate : new Date();
}

export function useGalleryPrints(uploads: GalleryUpload) {
  const { printUploadNote, printCropBorder, printTable, favoritePrintIds } = storeToRefs(useGalleryStore());

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
    uploads.openImageUploadFlow(e, {
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

  async function handleDropPrint(event: DragEvent) {
    event.preventDefault();
    for (const file of event.dataTransfer?.files ?? []) {
      const b64str = await readFileToBase64Str(file);
      const fileDate = readFileDate(file);
      await uploadPrint(b64str, fileDate);
    }
  }

  return {
    printUploadNote,
    printCropBorder,
    printTable,
    favoritePrintIds,
    onFileChangePrint,
    displayPrintUpload,
    deletePrint,
    toggleFavoritePrint,
    handleDropPrint,
  };
}
