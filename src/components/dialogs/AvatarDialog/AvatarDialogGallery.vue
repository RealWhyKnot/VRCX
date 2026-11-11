<template>
  <div class="h-full min-h-0 max-h-[unset] overflow-y-auto flex flex-wrap content-start items-start rounded-xl bg-(--profile-card) p-3">
    <div class="w-full">
      <div class="flex justify-between text-[10px] font-bold uppercase tracking-wide text-muted-foreground mb-2 pb-2 border-b border-border">
        <span>{{ t("dialog.avatar.info.gallery") }}</span>
        <Button
          v-if="isAvatarOwner"
          size="sm"
          variant="outline"
          class="h-6"
          :disabled="avatarDialog.galleryLoading"
          :aria-label="t('dialog.screenshot_metadata.upload')"
          @click="displayAvatarGalleryUpload"
        >
          <span class="text-[10px]">
            {{ t("dialog.screenshot_metadata.upload") }}
          </span>
          <Upload class="text-[10px]" />
        </Button>
      </div>
      <input id="AvatarGalleryUploadButton" type="file" accept="image/*" class="hidden" @change="onFileChangeAvatarGallery" />

      <div class="mt-2 w-[80%] ml-20">
        <Carousel v-if="avatarDialog.galleryImages.length" class="w-full" @init-api="onGalleryCarouselInit">
          <CarouselContent class="h-50">
            <CarouselItem v-for="(image, index) in avatarDialog.galleryImages" :key="image.id">
              <div class="relative h-50 w-full">
                <img :src="image.url" class="w-full h-full object-contain cursor-pointer" loading="lazy" @click="showFullscreenImageDialog(image.url)" />
                <div v-if="isAvatarOwner" class="absolute top-1 right-1 flex gap-1">
                  <Button
                    size="icon-sm"
                    variant="outline"
                    :disabled="avatarDialog.galleryLoading || index === 0"
                    :aria-label="t('dialog.avatar.info.gallery_move_left')"
                    @click="moveGalleryImage(index, -1)"
                  >
                    <ChevronLeft />
                  </Button>
                  <Button
                    size="icon-sm"
                    variant="outline"
                    :disabled="avatarDialog.galleryLoading || index === avatarDialog.galleryImages.length - 1"
                    :aria-label="t('dialog.avatar.info.gallery_move_right')"
                    @click="moveGalleryImage(index, 1)"
                  >
                    <ChevronRight />
                  </Button>
                  <Button
                    size="icon-sm"
                    variant="outline"
                    :disabled="avatarDialog.galleryLoading"
                    :aria-label="t('dialog.avatar.info.gallery_delete')"
                    @click="deleteGalleryImage(image)"
                  >
                    <Trash2 />
                  </Button>
                </div>
                <div class="hidden absolute inset-0 items-center justify-center bg-muted">
                  <Image class="size-8 text-muted-foreground" />
                </div>
              </div>
            </CarouselItem>
          </CarouselContent>
          <CarouselPrevious />
          <CarouselNext />
          <div class="mt-1 text-center text-xs text-muted-foreground">{{ galleryCarouselIndex + 1 }}/{{ avatarDialog.galleryImages.length }}</div>
        </Carousel>
        <div v-else>
          <DataTableEmpty type="nodata" />
        </div>
      </div>
    </div>
    <ImageCropDialog
      v-if="avatarDialog.visible"
      :open="galleryCropDialogOpen"
      :title="t('dialog.avatar.info.gallery')"
      :aspect-ratio="4 / 3"
      :file="galleryCropDialogFile"
      @update:open="galleryCropDialogOpen = $event"
      @confirm="onCropConfirmAvatarGallery"
    />
  </div>
</template>

<script setup lang="ts">
import { ChevronLeft, ChevronRight, Image, Trash2, Upload } from "lucide-vue-next";
import { computed } from "vue";
import { storeToRefs } from "pinia";
import { useI18n } from "vue-i18n";
import Button from "@/components/ui/button/Button.vue";
import Carousel from "@/components/ui/carousel/Carousel.vue";
import CarouselContent from "@/components/ui/carousel/CarouselContent.vue";
import CarouselItem from "@/components/ui/carousel/CarouselItem.vue";
import CarouselNext from "@/components/ui/carousel/CarouselNext.vue";
import CarouselPrevious from "@/components/ui/carousel/CarouselPrevious.vue";
import DataTableEmpty from "@/components/ui/data-table/DataTableEmpty.vue";
import ImageCropDialog from "../ImageCropDialog.vue";
import { useAvatarStore } from "../../../stores/avatar";
import { useGalleryStore } from "../../../stores/gallery";
import { useModalStore } from "../../../stores/modal";
import { useUserStore } from "../../../stores/user";
import { useAvatarDialogGallery } from "./use-avatar-dialog-gallery";

const avatarStore = useAvatarStore();
const { avatarDialog } = storeToRefs(avatarStore);
const { getAvatarGallery } = avatarStore;
const { currentUser } = storeToRefs(useUserStore());
const { showFullscreenImageDialog } = useGalleryStore();
const modalStore = useModalStore();
const { t } = useI18n();

const isAvatarOwner = computed(() => avatarDialog.value.ref.authorId === currentUser.value.id);

const {
  galleryCropDialogOpen,
  galleryCropDialogFile,
  galleryCarouselIndex,
  onGalleryCarouselInit,
  displayAvatarGalleryUpload,
  onFileChangeAvatarGallery,
  onCropConfirmAvatarGallery,
  moveGalleryImage,
  deleteGalleryImage,
} = useAvatarDialogGallery({ avatarDialog, getAvatarGallery, modalStore, t });
</script>
