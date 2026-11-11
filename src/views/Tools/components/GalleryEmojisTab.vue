<template>
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

<script setup lang="ts">
import { RefreshCw, Trash2, Upload } from "lucide-vue-next";
import { storeToRefs } from "pinia";
import { useI18n } from "vue-i18n";
import Button from "@/components/ui/button/Button.vue";
import ButtonGroup from "@/components/ui/button-group/ButtonGroup.vue";
import Checkbox from "@/components/ui/checkbox/Checkbox.vue";
import Item from "@/components/ui/item/Item.vue";
import ItemContent from "@/components/ui/item/ItemContent.vue";
import ItemDescription from "@/components/ui/item/ItemDescription.vue";
import ItemFooter from "@/components/ui/item/ItemFooter.vue";
import ItemGroup from "@/components/ui/item/ItemGroup.vue";
import ItemHeader from "@/components/ui/item/ItemHeader.vue";
import NumberField from "@/components/ui/number-field/NumberField.vue";
import NumberFieldContent from "@/components/ui/number-field/NumberFieldContent.vue";
import NumberFieldDecrement from "@/components/ui/number-field/NumberFieldDecrement.vue";
import NumberFieldIncrement from "@/components/ui/number-field/NumberFieldIncrement.vue";
import NumberFieldInput from "@/components/ui/number-field/NumberFieldInput.vue";
import VirtualCombobox from "@/components/ui/virtual-combobox/VirtualCombobox.vue";
import Emoji from "../../../components/Emoji.vue";
import { openExternalLink } from "../../../shared/utils/app-actions";
import { useGalleryStore } from "../../../stores/gallery";
import { useUserStore } from "../../../stores/user";
import { latestFileUrl, openFullscreen } from "../composables/gallery-file-actions";
import { useGalleryEmoji } from "../composables/use-gallery-emoji";
import type { GalleryUpload } from "../composables/use-gallery-upload";

const props = defineProps<{
  uploads: GalleryUpload;
}>();

const { t } = useI18n();
const { isLocalUserVrcPlusSupporter } = storeToRefs(useUserStore());
const { refreshEmojiTable } = useGalleryStore();
const { isUploading } = props.uploads;

const {
  emojiTable,
  emojiAnimFps,
  emojiAnimFrameCount,
  emojiAnimType,
  emojiAnimationStyle,
  emojiAnimLoopPingPong,
  emojiStyleImageUrl,
  emojiStylePickerGroups,
  emojiFileName,
  onFileChangeEmoji,
  displayEmojiUpload,
  deleteEmoji,
  handleDropEmoji,
} = useGalleryEmoji(props.uploads);
</script>
