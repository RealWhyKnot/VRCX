<template>
  <div class="flex-none w-77 pr-4 overflow-y-auto">
    <div class="rounded-xl bg-(--profile-card) overflow-hidden flex flex-col">
      <div class="relative aspect-4/3">
        <img
          v-if="!imageError"
          :src="avatarDialog.ref.thumbnailImageUrl"
          class="absolute inset-0 size-full cursor-pointer object-cover"
          loading="lazy"
          @click="showFullscreenImageDialog(avatarDialog.ref.imageUrl ?? '')"
          @error="imageError = true"
        />
        <div v-else class="absolute inset-0 flex items-center justify-center bg-muted">
          <Image class="size-8 text-muted-foreground" />
        </div>
      </div>
      <div class="grid grid-cols-[minmax(0,1fr)_auto] gap-x-2 p-3">
        <div class="contents">
          <div class="col-start-1 row-start-1 overflow-hidden">
            <span
              class="flex flex-wrap font-bold cursor-pointer wrap-anywhere"
              :title="avatarDialog.ref.name || avatarDialog.id"
              @click="copyToClipboard(avatarDialog.ref.name ?? '')"
              v-text="avatarDialog.ref.name || avatarDialog.id"
            ></span>
          </div>
          <div class="col-start-1 row-start-2 flex flex-col gap-1">
            <div>
              <span
                class="flex flex-wrap cursor-pointer x-grey font-mono text-xs max-w-30"
                @click="showUserDialog(avatarDialog.ref.authorId)"
                v-text="avatarDialog.ref.authorName || avatarDialog.ref.authorId"
              />
            </div>
          </div>
          <AvatarDialogBadges />
        </div>
        <AvatarDialogActions @command="$emit('command', $event)" />
      </div>
    </div>

    <div class="rounded-xl bg-(--profile-card) p-3 mt-2.5">
      <div class="text-[10px] font-bold uppercase tracking-wide text-muted-foreground mb-2 pb-2 border-b border-border">
        {{ t("dialog.avatar.info.header") }}
      </div>
      <div class="flex flex-col gap-1.5">
        <TooltipWrapper side="right" :content="formatDateFilter(avatarDialog.ref.created_at, 'long')" :disabled="!avatarDialog.ref.created_at">
          <div class="flex justify-between items-start gap-2 text-xs">
            <span class="text-muted-foreground shrink-0">{{ t("dialog.avatar.info.created_at") }}</span>
            <span class="text-right text-muted-foreground">{{ timeAgo(avatarDialog.ref.created_at) }}</span>
          </div>
        </TooltipWrapper>
        <TooltipWrapper side="right" :content="formatDateFilter(avatarDialog.ref.updated_at, 'long')" :disabled="!avatarDialog.ref.updated_at">
          <div class="flex justify-between items-start gap-2 text-xs">
            <span class="text-muted-foreground shrink-0">{{ t("dialog.avatar.info.last_updated") }}</span>
            <span class="text-right text-muted-foreground">{{ timeAgo(avatarDialog.ref.updated_at) }}</span>
          </div>
        </TooltipWrapper>
        <TooltipWrapper side="right" :content="avatarTags" :disabled="!avatarTags">
          <div class="flex items-start justify-between gap-2 text-xs">
            <span class="text-muted-foreground shrink-0">{{ t("dialog.avatar.info.tags") }}</span>
            <span class="max-w-30 truncate text-right text-muted-foreground">
              {{ avatarTags || "—" }}
            </span>
          </div>
        </TooltipWrapper>
        <div class="flex justify-between items-start gap-2 text-xs">
          <span class="text-muted-foreground shrink-0">{{ t("dialog.avatar.info.version") }}</span>
          <span class="text-right text-muted-foreground">{{ avatarDialog.ref.version || "—" }}</span>
        </div>
        <TooltipWrapper side="right" :content="avatarDialogPlatform" :disabled="!avatarDialogPlatform">
          <div class="flex items-start justify-between gap-2 text-xs">
            <span class="text-muted-foreground shrink-0">{{ t("dialog.avatar.info.platform") }}</span>
            <span class="block max-w-25 truncate whitespace-nowrap text-right text-muted-foreground">
              {{ avatarDialogPlatform || "—" }}
            </span>
          </div>
        </TooltipWrapper>
        <div class="flex justify-between items-center gap-2 text-xs">
          <span class="text-muted-foreground">{{ t("dialog.avatar.info.id") }}</span>
          <Button
            class="-mr-1.5 h-5 gap-1 px-1.5 text-xs font-normal text-muted-foreground has-[>svg]:px-1.5"
            size="sm"
            variant="ghost"
            @click="copyAvatarId(avatarDialog.id)"
          >
            <Copy class="size-3" />
            {{ t("dialog.avatar.info.copy_id") }}
          </Button>
        </div>
      </div>
    </div>

    <div class="rounded-xl bg-(--profile-card) p-3 mt-2.5">
      <div class="flex items-center mb-2 pb-2 border-b border-muted-foreground/20">
        <span class="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
          {{ t("dialog.user.info.vrcx_info") }}
          <TooltipWrapper side="right" :content="t('dialog.user.info.vrcx_info_tooltip')">
            <Info class="h-3 w-3 shrink-0" />
          </TooltipWrapper>
        </span>
      </div>
      <div class="flex justify-between items-start gap-2 text-xs">
        <span class="text-muted-foreground shrink-0">{{ t("dialog.avatar.info.time_spent") }}</span>
        <span class="text-right text-muted-foreground">
          {{ avatarDialog.timeSpent ? timeToText(avatarDialog.timeSpent) : "—" }}
        </span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Copy, Image, Info } from "lucide-vue-next";
import { computed, ref, watch } from "vue";
import { storeToRefs } from "pinia";
import { useI18n } from "vue-i18n";
import Button from "@/components/ui/button/Button.vue";
import AvatarDialogBadges from "./AvatarDialogBadges.vue";
import AvatarDialogActions from "./AvatarDialogActions.vue";
import { useAuthStore } from "../../../stores/auth";
import { useAvatarStore } from "../../../stores/avatar";
import { useGalleryStore } from "../../../stores/gallery";
import { compareUnityVersion } from "../../../shared/utils/avatar";
import { copyToClipboard } from "../../../shared/utils/app-actions";
import { formatDateFilter } from "../../../coordinators/date-coordinator";
import { timeAgo, timeToText } from "../../../shared/utils/base/format";
import { showUserDialog } from "../../../coordinators/user-coordinator";

defineEmits<{ command: [command: string] }>();

const { avatarDialog } = storeToRefs(useAvatarStore());
const authStore = useAuthStore();
const { showFullscreenImageDialog } = useGalleryStore();
const { t } = useI18n();

const imageError = ref(false);

watch(
  () => avatarDialog.value.id,
  () => {
    imageError.value = false;
  }
);

const avatarTags = computed(() => {
  return avatarDialog.value.ref.tags
    ?.filter((tag) => tag.startsWith("author_tag_"))
    .map((tag) => tag.replace("author_tag_", ""))
    .join(", ");
});

const avatarDialogPlatform = computed(() => {
  const { ref } = avatarDialog.value;
  const platforms: string[] = [];
  if (ref.unityPackages) {
    for (const unityPackage of ref.unityPackages) {
      if (unityPackage.variant && unityPackage.variant !== "standard" && unityPackage.variant !== "security") {
        continue;
      }
      if (!compareUnityVersion(unityPackage.unitySortNumber, authStore.cachedConfig.sdkUnityVersion)) {
        continue;
      }
      let platform = "PC";
      if (unityPackage.platform === "standalonewindows") {
        platform = "PC";
      } else if (unityPackage.platform === "android") {
        platform = "Android";
      } else if (unityPackage.platform) {
        platform = unityPackage.platform;
      }
      const platformWithVersion = `${platform}/${unityPackage.unityVersion}`;
      if (platforms.includes(platformWithVersion)) {
        continue;
      }
      platforms.unshift(platformWithVersion);
    }
  }
  return platforms.join("\n");
});

function copyAvatarId(id: string) {
  copyToClipboard(id);
}
</script>
