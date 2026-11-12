import { ref } from "vue";
import { toast } from "vue-sonner";
import { useI18n } from "vue-i18n";
import type { Point, Transform } from "vue-advanced-cropper";

type CropCoordinates = { left: number; top: number; width: number; height: number };
type CropTransforms = { rotate?: number; flip?: { horizontal?: boolean; vertical?: boolean } };
type CropperResult = { coordinates?: CropCoordinates; image?: { transforms?: CropTransforms }; canvas?: HTMLCanvasElement };
type CropperHandle = {
  getResult: () => CropperResult | null | undefined;
  setCoordinates: (transform: Transform | Transform[], options?: { autoZoom?: boolean; transitions?: boolean }) => void;
  zoom: (factor: number, center?: Point) => void;
  rotate: (angle: number) => void;
  flip: (horizontal: boolean, vertical?: boolean) => void;
};

const MAX_PREVIEW_SIZE = 800;

function requireContext2d(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const ctx = canvas.getContext("2d");
  if (ctx === null) {
    throw new Error("2D canvas context is not available");
  }
  return ctx;
}

export function applyTransforms(img: HTMLImageElement, angleDeg: number, isFlipHorizontal: boolean, isFlipVertical: boolean) {
  const angleRad = (angleDeg * Math.PI) / 180;
  const absCos = Math.abs(Math.cos(angleRad));
  const absSin = Math.abs(Math.sin(angleRad));

  const rotW = Math.round(img.width * absCos + img.height * absSin);
  const rotH = Math.round(img.width * absSin + img.height * absCos);

  const cvs = document.createElement("canvas");
  cvs.width = rotW;
  cvs.height = rotH;
  const ctx = requireContext2d(cvs);

  ctx.translate(rotW / 2, rotH / 2);
  ctx.rotate(angleRad);
  if (isFlipHorizontal) ctx.scale(-1, 1);
  if (isFlipVertical) ctx.scale(1, -1);
  ctx.drawImage(img, -img.width / 2, -img.height / 2);

  return cvs;
}

export function cropImage(
  originalImage: HTMLImageElement | null | undefined,
  previewScale: number,
  cropperResult: CropperResult | null | undefined,
  originalFile?: File | null
): Promise<File | Blob | null> {
  if (!cropperResult?.coordinates || !originalImage) {
    return Promise.resolve(null);
  }

  const { coordinates } = cropperResult;
  const scale = previewScale;
  const transforms: CropTransforms = cropperResult.image?.transforms ?? {};
  const rotate = transforms.rotate;
  const angle = rotate === undefined || Number.isNaN(rotate) ? 0 : rotate;
  const isFlipHorizontal = Boolean(transforms.flip?.horizontal);
  const isFlipVertical = Boolean(transforms.flip?.vertical);
  const hasTransform = angle !== 0 || isFlipHorizontal || isFlipVertical;

  const cropX = Math.round(coordinates.left / scale);
  const cropY = Math.round(coordinates.top / scale);
  const cropW = Math.round(coordinates.width / scale);
  const cropH = Math.round(coordinates.height / scale);

  if (!hasTransform) {
    const isFullFrame = cropX <= 1 && cropY <= 1 && Math.abs(cropW - originalImage.width) <= 1 && Math.abs(cropH - originalImage.height) <= 1;
    if (isFullFrame && originalFile) {
      return Promise.resolve(originalFile);
    }
  }

  const source = hasTransform ? applyTransforms(originalImage, angle, isFlipHorizontal, isFlipVertical) : originalImage;

  const cropCanvas = document.createElement("canvas");
  cropCanvas.width = cropW;
  cropCanvas.height = cropH;
  const ctx = requireContext2d(cropCanvas);

  ctx.drawImage(source, -cropX, -cropY);

  return new Promise<Blob | null>((resolve) => {
    cropCanvas.toBlob(resolve, "image/png");
  });
}

export function useImageCropper() {
  const { t } = useI18n();

  const cropperRef = ref<CropperHandle | null>(null);
  const cropperImageSrc = ref("");
  const originalImage = ref<HTMLImageElement | null>(null);
  const previewScale = ref(1);

  function resetCropState() {
    cropperImageSrc.value = "";
    originalImage.value = null;
    previewScale.value = 1;
  }

  function loadImageForCrop(file: Blob) {
    const r = new FileReader();
    r.onload = () => {
      const dataUrl = typeof r.result === "string" ? r.result : "";
      const img = new Image();
      img.onload = () => {
        originalImage.value = img;
        if (img.width > MAX_PREVIEW_SIZE || img.height > MAX_PREVIEW_SIZE) {
          const scale = Math.min(MAX_PREVIEW_SIZE / img.width, MAX_PREVIEW_SIZE / img.height);
          previewScale.value = scale;
          const cvs = document.createElement("canvas");
          cvs.width = Math.round(img.width * scale);
          cvs.height = Math.round(img.height * scale);
          const ctx = requireContext2d(cvs);
          ctx.drawImage(img, 0, 0, cvs.width, cvs.height);
          cropperImageSrc.value = cvs.toDataURL("image/jpeg", 0.9);
        } else {
          previewScale.value = 1;

          cropperImageSrc.value = dataUrl;
        }
      };
      img.onerror = () => {
        resetCropState();
      };

      img.src = dataUrl;
    };
    r.onerror = () => {
      resetCropState();
      toast.error(t("message.file.not_image"));
    };
    r.readAsDataURL(file);
  }

  function getCroppedBlob(originalFile?: File | null) {
    const result = cropperRef.value?.getResult();
    return cropImage(originalImage.value, previewScale.value, result, originalFile);
  }

  function getPreviewUrl(): string {
    const canvas = cropperRef.value?.getResult()?.canvas;
    return canvas && canvas.width > 0 && canvas.height > 0 ? canvas.toDataURL("image/jpeg", 0.8) : "";
  }

  return {
    cropperRef,
    cropperImageSrc,
    resetCropState,
    loadImageForCrop,
    getCroppedBlob,
    getPreviewUrl,
  };
}
