import { computed, ref } from "vue";
import { storeToRefs } from "pinia";
import { useI18n } from "vue-i18n";
import type { ImageAnimationStyle, ImageLoopStyle, ImageMask } from "vrchat";
import { vrcPlusImageRequest } from "../../../api/vrc-plus-image";
import { emojiAnimationStyleList, emojiAnimationStyleUrl } from "../../../shared/constants/emoji";
import { getEmojiFileName } from "../../../shared/utils/gallery";
import { useGalleryStore } from "../../../stores/gallery";
import type { GalleryFile } from "../../../stores/gallery-types";
import { parseLeadingInt } from "../../../stores/vrcx-messages";
import { deleteFileAndRemove, readFileToBase64Str, triggerFileInput } from "./gallery-file-actions";
import type { GalleryUpload } from "./use-gallery-upload";

type EmojiFileNameInfo = {
  name: string;
  animationStyle: string;
  frames?: number;
  framesOverTime?: number;
  loopStyle?: ImageLoopStyle;
};

type EmojiUploadParams = {
  tag: "emoji" | "emojianimated";
  animationStyle: ImageAnimationStyle;
  maskTag: ImageMask;
  frames?: number;
  framesOverTime?: number;
  loopStyle?: ImageLoopStyle;
};

const imageAnimationStyles = [
  "aura",
  "bats",
  "bees",
  "bounce",
  "cloud",
  "confetti",
  "crying",
  "dislike",
  "fire",
  "idea",
  "lasers",
  "like",
  "magnet",
  "mistletoe",
  "money",
  "noise",
  "orbit",
  "pizza",
  "rain",
  "rotate",
  "shake",
  "snow",
  "snowball",
  "spin",
  "splash",
  "stop",
  "zzz",
] as const satisfies readonly ImageAnimationStyle[];

function isImageAnimationStyle(value: string): value is ImageAnimationStyle {
  return imageAnimationStyles.some((style) => style === value);
}

export function useGalleryEmoji(uploads: GalleryUpload) {
  const { t } = useI18n();
  const { emojiTable } = storeToRefs(useGalleryStore());

  const emojiAnimFps = ref(15);
  const emojiAnimFrameCount = ref(4);
  const emojiAnimType = ref(false);
  const emojiAnimationStyle = ref("Stop");
  const emojiAnimLoopPingPong = ref<boolean | string>(false);

  const emojiStyleFileNames = new Map(Object.entries(emojiAnimationStyleList));

  function emojiStyleImageUrl(value: string | number): string {
    return `${emojiAnimationStyleUrl}${emojiStyleFileNames.get(String(value)) ?? ""}`;
  }

  const emojiStylePickerGroups = computed(() => [
    {
      key: "emojiAnimationStyles",
      label: t("dialog.gallery_icons.emoji_animation_styles"),
      items: Object.keys(emojiAnimationStyleList).map((styleName) => ({
        value: styleName,
        label: styleName,
        search: styleName,
      })),
    },
  ]);

  function emojiFileName(image: GalleryFile): string {
    const info: EmojiFileNameInfo = {
      name: image.name,
      animationStyle: String(image.animationStyle),
    };
    if (image.frames !== undefined) {
      info.frames = image.frames;
    }
    if (image.framesOverTime !== undefined) {
      info.framesOverTime = image.framesOverTime;
    }
    if (image.loopStyle !== undefined) {
      info.loopStyle = image.loopStyle;
    }
    return getEmojiFileName(info);
  }

  function parseEmojiFileName(fileName: string) {
    const baseName = fileName.replace(/\.[^/.]+$/, "");
    const array = baseName.split("_");
    for (const value of array) {
      if (value.endsWith("animationStyle")) {
        emojiAnimType.value = false;
        emojiAnimationStyle.value = value.replace("animationStyle", "").toLowerCase();
      }
      if (value.endsWith("frames")) {
        emojiAnimType.value = true;
        emojiAnimFrameCount.value = parseLeadingInt(value.replace("frames", ""));
      }
      if (value.endsWith("fps")) {
        emojiAnimFps.value = parseLeadingInt(value.replace("fps", ""));
      }
      if (value.endsWith("loopStyle")) {
        emojiAnimLoopPingPong.value = value.replace("loopStyle", "").toLowerCase();
      }
    }
  }

  async function uploadEmoji(base64Body: string) {
    const animationStyle = emojiAnimationStyle.value.toLowerCase();
    if (!isImageAnimationStyle(animationStyle)) {
      throw new Error(`unsupported emoji animation style: ${animationStyle}`);
    }
    const params: EmojiUploadParams = {
      tag: emojiAnimType.value ? "emojianimated" : "emoji",
      animationStyle,
      maskTag: "square",
    };
    if (emojiAnimType.value) {
      params.frames = emojiAnimFrameCount.value;
      params.framesOverTime = emojiAnimFps.value;
    }
    if (emojiAnimLoopPingPong.value) {
      params.loopStyle = "pingpong";
    }
    const args = await vrcPlusImageRequest.uploadEmoji(base64Body, params);
    if (emojiTable.value.length > 0) {
      emojiTable.value.unshift(args.json);
    }
  }

  function onFileChangeEmoji(e: Event) {
    uploads.openImageUploadFlow(e, {
      inputSelector: "#EmojiUploadButton",
      aspectRatio: 1 / 1,
      beforeCrop: (file) => {
        parseEmojiFileName(file.name);
      },
      upload: async ({ base64Body }) => {
        await uploadEmoji(base64Body);
      },
    });
  }

  function displayEmojiUpload() {
    triggerFileInput("EmojiUploadButton");
  }

  function deleteEmoji(fileId: string) {
    deleteFileAndRemove(fileId, emojiTable.value);
  }

  async function handleDropEmoji(event: DragEvent) {
    event.preventDefault();
    for (const file of event.dataTransfer?.files ?? []) {
      const b64str = await readFileToBase64Str(file);
      await uploadEmoji(b64str);
    }
  }

  return {
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
  };
}
