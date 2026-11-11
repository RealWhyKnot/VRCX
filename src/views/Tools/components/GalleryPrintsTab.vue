<template>
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

<script setup lang="ts">
import { RefreshCw, Star, Trash2, Upload } from "lucide-vue-next";
import { storeToRefs } from "pinia";
import { useI18n } from "vue-i18n";
import Location from "@/components/Location.vue";
import Button from "@/components/ui/button/Button.vue";
import ButtonGroup from "@/components/ui/button-group/ButtonGroup.vue";
import Checkbox from "@/components/ui/checkbox/Checkbox.vue";
import InputGroupTextareaField from "@/components/ui/input-group/InputGroupTextareaField.vue";
import Item from "@/components/ui/item/Item.vue";
import ItemContent from "@/components/ui/item/ItemContent.vue";
import ItemDescription from "@/components/ui/item/ItemDescription.vue";
import ItemFooter from "@/components/ui/item/ItemFooter.vue";
import ItemGroup from "@/components/ui/item/ItemGroup.vue";
import ItemHeader from "@/components/ui/item/ItemHeader.vue";
import ItemTitle from "@/components/ui/item/ItemTitle.vue";
import { formatDateFilter } from "../../../coordinators/date-coordinator";
import { getPrintFileName } from "../../../shared/utils/gallery";
import { useGalleryStore } from "../../../stores/gallery";
import { useUserStore } from "../../../stores/user";
import { openFullscreen } from "../composables/gallery-file-actions";
import { useGalleryPrints } from "../composables/use-gallery-prints";
import type { GalleryUpload } from "../composables/use-gallery-upload";

const props = defineProps<{
  uploads: GalleryUpload;
}>();

const { t } = useI18n();
const { isLocalUserVrcPlusSupporter } = storeToRefs(useUserStore());
const { refreshPrintTable } = useGalleryStore();
const { isUploading } = props.uploads;

const {
  printUploadNote,
  printCropBorder,
  printTable,
  favoritePrintIds,
  onFileChangePrint,
  displayPrintUpload,
  deletePrint,
  toggleFavoritePrint,
  handleDropPrint,
} = useGalleryPrints(props.uploads);
</script>
