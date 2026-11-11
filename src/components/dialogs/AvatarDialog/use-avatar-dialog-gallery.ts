import { nextTick, ref } from "vue";
import type { Ref } from "vue";
import type { useI18n } from "vue-i18n";
import { toast } from "vue-sonner";
import { avatarRequest } from "../../../api/avatar";
import { miscRequest } from "../../../api/misc";
import { handleImageUploadInput, resizeImageToFitLimits } from "../../../coordinators/image-upload-coordinator";
import { readFileAsBase64 } from "../../../shared/utils/image-upload";
import type { AvatarGalleryImage, useAvatarStore } from "../../../stores/avatar";
import type { useModalStore } from "../../../stores/modal";

type AvatarDialogState = ReturnType<typeof useAvatarStore>["avatarDialog"];
type GalleryCarouselApi = {
  selectedScrollSnap(): number;
  on(event: "select" | "reInit", handler: () => void): void;
  reInit(): void;
  scrollTo(index: number, jump?: boolean): void;
};

export function useAvatarDialogGallery({
  avatarDialog,
  getAvatarGallery,
  modalStore,
  t,
}: {
  avatarDialog: Ref<AvatarDialogState>;
  getAvatarGallery: ReturnType<typeof useAvatarStore>["getAvatarGallery"];
  modalStore: Pick<ReturnType<typeof useModalStore>, "confirm">;
  t: ReturnType<typeof useI18n>["t"];
}) {
  const galleryCropDialogOpen = ref(false);
  const galleryCropDialogFile = ref<File | null>(null);
  const galleryCarouselApi = ref<GalleryCarouselApi | null>(null);
  const galleryCarouselIndex = ref(0);

  function onGalleryCarouselInit(api: GalleryCarouselApi) {
    galleryCarouselApi.value = api;
    const updateIndex = () => {
      galleryCarouselIndex.value = api.selectedScrollSnap();
    };
    updateIndex();
    api.on("select", updateIndex);
    api.on("reInit", updateIndex);
  }

  async function scrollGalleryToImage(imageId: string | undefined) {
    await nextTick();
    const api = galleryCarouselApi.value;
    if (!api) {
      return;
    }
    let index = avatarDialog.value.galleryImages.findIndex((image) => image.id === imageId);
    if (index === -1) {
      index = avatarDialog.value.galleryImages.length - 1;
    }
    api.reInit();
    api.scrollTo(index, true);
  }

  function displayAvatarGalleryUpload() {
    const uploadButton = document.getElementById("AvatarGalleryUploadButton");
    if (!uploadButton) {
      throw new Error("AvatarGalleryUploadButton is not in the document");
    }
    uploadButton.click();
  }

  function onFileChangeAvatarGallery(e: Event) {
    const { file, clearInput } = handleImageUploadInput(e, {
      inputSelector: "#AvatarGalleryUploadButton",
      tooLargeMessage: () => t("message.file.too_large"),
      invalidTypeMessage: () => t("message.file.not_image"),
    });
    if (!file) {
      return;
    }
    clearInput();
    galleryCropDialogFile.value = file;
    galleryCropDialogOpen.value = true;
  }

  async function onCropConfirmAvatarGallery(blob: Blob | null) {
    const avatarId = avatarDialog.value.id;
    avatarDialog.value.galleryLoading = true;
    const uploadPromise = (async () => {
      if (!blob) {
        throw new Error("No gallery image to upload");
      }
      const base64Body = await readFileAsBase64(blob);
      const base64File = await resizeImageToFitLimits(base64Body);
      const args = await avatarRequest.uploadAvatarGalleryImage(base64File, avatarId);
      await getAvatarGallery(avatarId);
      return args;
    })();
    toast.promise(uploadPromise, {
      loading: t("message.upload.loading"),
      success: t("message.upload.success"),
      error: t("message.upload.error"),
    });
    try {
      const args = await uploadPromise;
      await scrollGalleryToImage(args.json.id);
    } catch (error) {
      console.error("Failed to upload image", error);
    } finally {
      avatarDialog.value.galleryLoading = false;
      galleryCropDialogOpen.value = false;
    }
  }

  async function moveGalleryImage(index: number, direction: number) {
    const avatarId = avatarDialog.value.id;
    const images = [...avatarDialog.value.galleryImages];
    const target = index + direction;
    const movedImage = images[index];
    const targetImage = images[target];
    if (!movedImage || !targetImage) {
      return;
    }
    images[index] = targetImage;
    images[target] = movedImage;
    avatarDialog.value.galleryLoading = true;
    try {
      await avatarRequest.setAvatarGalleryOrder(
        images.map((image) => image.id),
        avatarId
      );
    } catch (error) {
      console.error("Failed to reorder gallery", error);
      toast.error(t("message.upload.error"));
    }
    await getAvatarGallery(avatarId);
    await scrollGalleryToImage(movedImage.id);
  }

  async function deleteGalleryImage(image: AvatarGalleryImage) {
    const avatarId = avatarDialog.value.id;
    const { ok } = await modalStore.confirm({
      title: t("confirm.title"),
      description: t("confirm.command_question", {
        command: t("dialog.avatar.info.gallery_delete"),
      }),
    });
    if (!ok) {
      return;
    }
    avatarDialog.value.galleryLoading = true;
    try {
      await miscRequest.deleteFile(image.id);
    } catch (error) {
      console.error("Failed to delete gallery image", error);
    }
    await getAvatarGallery(avatarId);
  }

  return {
    galleryCropDialogOpen,
    galleryCropDialogFile,
    galleryCarouselIndex,
    onGalleryCarouselInit,
    displayAvatarGalleryUpload,
    onFileChangeAvatarGallery,
    onCropConfirmAvatarGallery,
    moveGalleryImage,
    deleteGalleryImage,
  };
}
