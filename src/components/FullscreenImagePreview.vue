<template>
  <Dialog v-model:open="open">
    <DialogPortal :to="portalTo">
      <RekaDialogOverlay :class="cn('fixed inset-0 bg-background/80', !disableGpuAcceleration && 'backdrop-blur-sm')" />

      <RekaDialogContent
        class="fixed inset-0 p-6 sm:p-10 border-0 bg-transparent shadow-none outline-none"
        @click="closeDialog"
        @open-auto-focus.prevent
        @close-auto-focus.prevent
      >
        <div ref="viewerEl" class="relative h-full w-full overflow-hidden select-none">
          <div class="absolute right-3 top-3 z-10 flex items-center gap-2 rounded-md bg-background/70 backdrop-blur px-2 py-1 border" @click.stop>
            <Button
              variant="ghost"
              size="icon"
              class="h-8 w-8"
              :disabled="!imageUrl"
              :aria-label="t('common.actions.copy')"
              @click="copyImageToClipboard(imageUrl)"
            >
              <Copy class="h-4 w-4" />
            </Button>

            <Button
              variant="ghost"
              size="icon"
              class="h-8 w-8"
              :disabled="!imageUrl"
              :aria-label="t('dialog.vrcx_updater.download')"
              @click="downloadAndSaveImage(imageUrl, fullscreenImageDialog.fileName)"
            >
              <Download class="h-4 w-4" />
            </Button>

            <div class="mx-1 h-5 w-px bg-border" />

            <Button variant="ghost" size="icon" class="h-8 w-8" :aria-label="t('dialog.image_crop.zoom_out')" @click="zoomOutCenter">
              <ZoomOut class="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" class="h-8 w-8" :aria-label="t('dialog.image_crop.zoom_in')" @click="zoomInCenter">
              <ZoomIn class="h-4 w-4" />
            </Button>

            <Button variant="ghost" size="icon" class="h-8 w-8" :aria-label="t('dialog.image_crop.rotate_right')" @click="rotateCW">
              <RotateCw class="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" class="h-8 w-8" :aria-label="t('dialog.image_crop.rotate_left')" @click="rotateCCW">
              <RotateCcw class="h-4 w-4" />
            </Button>

            <Button variant="ghost" size="icon" class="h-8 w-8" :aria-label="t('dialog.image_crop.reset')" @click="resetTransform">
              <RefreshCcw class="h-4 w-4" />
            </Button>

            <div class="mx-1 h-5 w-px bg-border" />

            <Button variant="ghost" size="icon" class="h-8 w-8" :aria-label="t('dialog.shared_feed_filters.close')" @click="closeDialog">
              <X class="h-4 w-4" />
            </Button>
          </div>

          <div class="h-full w-full flex items-center justify-center" @wheel="onWheel">
            <img
              v-if="imageUrl"
              :src="imageUrl"
              class="max-h-full max-w-full x-viewer-img"
              :style="transformStyle"
              draggable="false"
              @pointerdown="onPointerDown"
              @pointermove="onPointerMove"
              @pointerup="onPointerUp"
              @pointercancel="onPointerUp"
              @click.stop
            />
          </div>
        </div>
      </RekaDialogContent>
    </DialogPortal>
  </Dialog>
</template>

<script setup lang="ts">
import { Copy, Download, RefreshCcw, RotateCcw, RotateCw, X, ZoomIn, ZoomOut } from "lucide-vue-next";
import { useEventListener } from "@vueuse/core";
import { computed, onBeforeUnmount, ref, watch } from "vue";
import { DialogContent as RekaDialogContent, DialogOverlay as RekaDialogOverlay, DialogPortal } from "reka-ui";
import Button from "@/components/ui/button/Button.vue";
import Dialog from "@/components/ui/dialog/Dialog.vue";
import { acquireModalPortalLayer } from "@/lib/modal-portal-layers";
import { cn } from "@/lib/utils";
import { storeToRefs } from "pinia";
import { toast } from "vue-sonner";
import { useGeneralSettingsStore } from "@/stores/settings/general";
import { useI18n } from "vue-i18n";

import { extractFileId } from "../shared/utils/file-utils";
import { useGalleryStore } from "../stores/gallery";
import { webApiService } from "../services/webapi";

const galleryStore = useGalleryStore();
const { fullscreenImageDialog } = storeToRefs(galleryStore);
const { disableGpuAcceleration } = storeToRefs(useGeneralSettingsStore());
const { t } = useI18n();

const viewerEl = ref<HTMLDivElement | null>(null);
const portalLayer = acquireModalPortalLayer();
const portalTo = portalLayer.element ?? "body";

const scale = ref(1);
const rotate = ref(0);
const tx = ref(0);
const ty = ref(0);

const isDragging = ref(false);
const dragStartX = ref(0);
const dragStartY = ref(0);
const startTx = ref(0);
const startTy = ref(0);

const imageUrl = computed(() => fullscreenImageDialog.value.imageUrl || "");

const open = computed<boolean>({
  get: () => fullscreenImageDialog.value.visible,
  set: (isOpen: boolean) => {
    fullscreenImageDialog.value.visible = isOpen;
  },
});

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}
function degToRad(deg: number) {
  return (deg * Math.PI) / 180;
}

function resetTransform() {
  scale.value = 1;
  rotate.value = 0;
  tx.value = 0;
  ty.value = 0;
}

function closeDialog() {
  open.value = false;
}

function zoomAtCenter(factor: number) {
  const el = viewerEl.value;
  if (!el) {
    scale.value = clamp(scale.value * factor, 0.1, 10);
    return;
  }

  scale.value = clamp(scale.value * factor, 0.1, 10);
}

function zoomInCenter() {
  zoomAtCenter(1.2);
}
function zoomOutCenter() {
  zoomAtCenter(1 / 1.2);
}

function rotateCW() {
  rotate.value = (rotate.value + 90) % 360;
}
function rotateCCW() {
  rotate.value = (rotate.value - 90 + 360) % 360;
}

function zoomAtPointer(e: MouseEvent, factor: number) {
  const el = viewerEl.value;
  if (!el) return;

  const rect = el.getBoundingClientRect();

  const mx = e.clientX - rect.left;
  const my = e.clientY - rect.top;

  const cx = rect.width / 2;
  const cy = rect.height / 2;

  const oldScale = scale.value;
  const newScale = clamp(oldScale * factor, 0.1, 10);

  const r = degToRad(rotate.value);
  const cos = Math.cos(r);
  const sin = Math.sin(r);

  const vx = mx - cx - tx.value;
  const vy = my - cy - ty.value;

  const ux = (vx * cos + vy * sin) / oldScale;
  const uy = (-vx * sin + vy * cos) / oldScale;

  const v2x = (ux * cos - uy * sin) * newScale;
  const v2y = (ux * sin + uy * cos) * newScale;

  tx.value = mx - cx - v2x;
  ty.value = my - cy - v2y;
  scale.value = newScale;
}

function onWheel(e: WheelEvent) {
  e.preventDefault();
  const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
  zoomAtPointer(e, factor);
}

function onPointerDown(e: PointerEvent) {
  if (e.button !== 0) return;
  isDragging.value = true;
  if (e.currentTarget instanceof HTMLElement) {
    e.currentTarget.setPointerCapture(e.pointerId);
  }
  dragStartX.value = e.clientX;
  dragStartY.value = e.clientY;
  startTx.value = tx.value;
  startTy.value = ty.value;
}

function onPointerMove(e: PointerEvent) {
  if (!isDragging.value) return;
  const dx = e.clientX - dragStartX.value;
  const dy = e.clientY - dragStartY.value;
  tx.value = startTx.value + dx;
  ty.value = startTy.value + dy;
}

function onPointerUp(e: PointerEvent) {
  if (!isDragging.value) return;
  isDragging.value = false;
  if (e.currentTarget instanceof HTMLElement) {
    e.currentTarget.releasePointerCapture(e.pointerId);
  }
}

const transformStyle = computed(() => ({
  transform: `translate(${tx.value}px, ${ty.value}px) scale(${scale.value}) rotate(${rotate.value}deg)`,
  transformOrigin: "center center",
}));

watch(
  () => open.value,
  (isOpen) => {
    if (isOpen) {
      portalLayer.bringToFront();
      resetTransform();
    }
  }
);

onBeforeUnmount(() => {
  portalLayer.release();
});

watch(
  () => imageUrl.value,
  (url) => {
    if (!url || !open.value) return;
    resetTransform();
  }
);

function onKeydown(e: KeyboardEvent) {
  if (!open.value) return;
  if (e.key === "+" || e.key === "=") zoomInCenter();
  else if (e.key === "-" || e.key === "_") zoomOutCenter();
  else if (e.key.toLowerCase() === "r") rotateCW();
  else if (e.key === "0") resetTransform();
}
useEventListener(window, "keydown", onKeydown);

async function copyImageToClipboard(url: string) {
  if (!url) return;
  const msg = toast.info(t("message.image.downloading"));
  try {
    const response = await webApiService.execute({ url, method: "GET" });
    if (response.status !== 200 || !response.data.startsWith("data:image/png")) {
      throw new Error(`Error: ${response.data}`);
    }
    const blob = await (await fetch(response.data, { signal: AbortSignal.timeout(30_000) })).blob();
    await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
    toast.success(t("message.image.copied_to_clipboard"));
  } catch (error) {
    console.error("Error downloading image:", error);
    toast.error(`Failed to download image. ${url}`);
  } finally {
    toast.dismiss(msg);
  }
}

async function downloadAndSaveImage(url: string, fileName: string) {
  if (!url) return;
  const msg = toast.info(t("message.image.downloading"));
  try {
    const response = await webApiService.execute({ url, method: "GET" });
    if (response.status !== 200 || !response.data.startsWith("data:image/png")) {
      throw new Error(`Error: ${response.data}`);
    }

    const link = document.createElement("a");
    link.href = response.data;

    const fileId = extractFileId(url);
    let name = fileName;
    if (!name && fileId) name = `${fileId}.png`;
    if (!name) name = `${url.split("/").pop()}.png`;
    if (!name) name = "image.png";

    link.setAttribute("download", name);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } catch (error) {
    console.error("Error downloading image:", error);
    toast.error(`Failed to download image. ${url}`);
  } finally {
    toast.dismiss(msg);
  }
}
</script>

<style scoped>
.x-viewer-img {
  will-change: transform;
  cursor: grab;
  user-select: none;
}

.x-viewer-img:active {
  cursor: grabbing;
}
</style>
