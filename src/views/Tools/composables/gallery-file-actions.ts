import { miscRequest } from "../../../api/misc";
import { useGalleryStore } from "../../../stores/gallery";
import type { GalleryFile } from "../../../stores/gallery-types";
import { readFileAsBase64 } from "../../../shared/utils/image-upload";

export function logError(error: unknown) {
  console.error(error);
}

export function latestFileUrl(file: GalleryFile): string {
  const latestVersion = file.versions.at(-1);
  return latestVersion?.file?.url ?? "";
}

export function openFullscreen(imageUrl: string | undefined, fileName?: string) {
  useGalleryStore().showFullscreenImageDialog(imageUrl ?? "", fileName ?? "");
}

export function triggerFileInput(id: string) {
  document.getElementById(id)?.click();
}

export function removeItemById(array: { id: string }[], itemId: string) {
  const { length } = array;
  for (let i = 0; i < length; ++i) {
    if (itemId === array[i]?.id) {
      array.splice(i, 1);
      break;
    }
  }
}

export function deleteFileAndRemove(fileId: string, array: GalleryFile[]) {
  void miscRequest
    .deleteFile(fileId)
    .then((args) => {
      removeItemById(array, args.fileId);
    })
    .catch(logError);
}

export async function readFileToBase64Str(file: File) {
  if (!file.type.startsWith("image/")) {
    throw new Error(`unrecognized image format: ${file.type}`);
  }
  return readFileAsBase64(file);
}
