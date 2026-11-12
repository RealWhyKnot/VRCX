import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import { toast } from "vue-sonner";
import { handleImageUploadInput } from "../../../coordinators/image-upload-coordinator";
import { readFileAsBase64, withUploadTimeout } from "../../../shared/utils/image-upload";
import type { UploadPreviewKind } from "../../../shared/utils/upload-previews";

export type ImageUploadPayload = {
  file: File;
  blob: Blob;
  base64Body: string;
};

type ImageUploadFlowOptions = {
  inputSelector: string;
  aspectRatio: number;
  previews?: UploadPreviewKind;
  beforeCrop?: (file: File) => void;
  upload: (payload: ImageUploadPayload) => Promise<void>;
  errorMessage?: string;
};

type CropUploadHandler = (blob: Blob) => Promise<void>;

export function useGalleryUpload() {
  const { t } = useI18n();

  const pendingUploads = ref(0);
  const isUploading = computed(() => pendingUploads.value > 0);

  const cropDialogOpen = ref(false);
  const cropDialogTitle = ref("");
  const cropDialogAspectRatio = ref(4 / 3);
  const cropDialogFile = ref<File | null>(null);
  const cropDialogPreviews = ref<UploadPreviewKind | null>(null);
  const cropDialogUploadHandler = ref<CropUploadHandler | null>(null);

  function startUpload() {
    pendingUploads.value += 1;
  }

  function finishUpload() {
    pendingUploads.value = Math.max(0, pendingUploads.value - 1);
  }

  function openCropDialog(file: File, title: string, aspectRatio: number, previews: UploadPreviewKind | null, handler: CropUploadHandler) {
    cropDialogPreviews.value = previews;
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

  function openImageUploadFlow(
    e: Event,
    { inputSelector, aspectRatio, previews, beforeCrop, upload, errorMessage = "Failed to upload" }: ImageUploadFlowOptions
  ) {
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
    openCropDialog(file, t("dialog.change_content_image.upload"), aspectRatio, previews ?? null, async (blob) => {
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

  return {
    isUploading,
    cropDialogOpen,
    cropDialogTitle,
    cropDialogAspectRatio,
    cropDialogFile,
    cropDialogPreviews,
    onCropConfirm,
    openImageUploadFlow,
  };
}

export type GalleryUpload = ReturnType<typeof useGalleryUpload>;
