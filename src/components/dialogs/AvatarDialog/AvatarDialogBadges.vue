<template>
  <div class="col-span-2 flex flex-wrap items-center">
    <Badge v-if="avatarDialog.ref.releaseStatus === 'public'" class="mr-1.5 mt-1.5" variant="outline">
      {{ t("dialog.avatar.tags.public") }}
    </Badge>
    <Badge v-else class="mr-1.5 mt-1.5" variant="outline">
      {{ t("dialog.avatar.tags.private") }}
    </Badge>
    <TooltipWrapper v-if="avatarDialog.isPC" side="top" content="PC">
      <Badge class="text-platform-pc border-platform-pc! mr-1.5 mt-1.5" variant="outline"
        ><Monitor class="h-4 w-4 text-platform-pc" />
        <span v-if="performanceLabel('pc')" class="text-platform-pc dark:text-foreground border-platform-pc border-l-[0.8px] border-solid ml-1.5 pl-1.5">{{
          performanceLabel("pc")
        }}</span>
        <span
          v-if="fileSizeOf('standalonewindows')"
          class="text-platform-pc dark:text-foreground border-platform-pc border-l-[0.8px] border-solid ml-1.5 pl-1.5"
          >{{ fileSizeOf("standalonewindows") }}</span
        >
      </Badge>
    </TooltipWrapper>
    <TooltipWrapper v-if="avatarDialog.isQuest" side="top" content="Android">
      <Badge class="text-platform-quest border-platform-quest! mr-1.5 mt-1.5" variant="outline"
        ><Smartphone class="h-4 w-4 text-platform-quest" />
        <span v-if="performanceLabel('android')" class="x-grey text-platform-quest border-l-[0.8px] border-solid ml-1.5 pl-1.5">{{
          performanceLabel("android")
        }}</span>
        <span v-if="fileSizeOf('android')" class="x-grey text-platform-quest border-l-[0.8px] border-solid ml-1.5 pl-1.5">{{ fileSizeOf("android") }}</span>
      </Badge>
    </TooltipWrapper>
    <TooltipWrapper v-if="avatarDialog.isIos" side="top" content="iOS">
      <Badge class="text-platform-ios border-platform-ios mr-1.5 mt-1.5" variant="outline"
        ><Apple class="h-4 w-4 text-platform-ios" />
        <span v-if="performanceLabel('ios')" class="x-grey text-platform-ios border-platform-ios border-l-[0.8px] border-solid ml-1.5 pl-1.5">{{
          performanceLabel("ios")
        }}</span>
        <span v-if="fileSizeOf('ios')" class="x-grey text-platform-ios border-platform-ios border-l-[0.8px] border-solid ml-1.5 pl-1.5">{{
          fileSizeOf("ios")
        }}</span>
      </Badge>
    </TooltipWrapper>
    <Badge v-if="avatarDialog.inCache" variant="outline" class="cursor-pointer mr-1.5 mt-1.5" @click="openFolderGeneric(avatarDialog.cachePath)">
      <span v-text="avatarDialog.cacheSize"></span>
      &nbsp;{{ t("dialog.avatar.tags.cache") }}
    </Badge>
    <Badge v-if="avatarDialog.ref.styles?.primary || avatarDialog.ref.styles?.secondary" class="mr-1.5 mt-1.5" variant="outline"
      >{{ t("view.favorite.avatars.styles") }}
      <span v-if="avatarDialog.ref.styles.primary" class="x-grey border-l-[0.8px] border-solid ml-1.5 pl-1.5 pb-px">{{ avatarDialog.ref.styles.primary }}</span>
      <span v-if="avatarDialog.ref.styles.secondary" class="x-grey border-l-[0.8px] border-solid ml-1.5 pl-1.5 pb-px">{{
        avatarDialog.ref.styles.secondary
      }}</span>
    </Badge>
    <Badge v-if="avatarDialog.isQuestFallback" class="mr-1.5 mt-1.5" variant="outline">
      {{ t("dialog.avatar.tags.fallback") }}
    </Badge>
    <Badge v-if="avatarDialog.hasImposter" class="mr-1.5 mt-1.5" variant="outline"
      >{{ t("dialog.avatar.tags.impostor") }}
      <span v-if="avatarDialog.imposterVersion" class="x-grey border-l-[0.8px] border-solid ml-1.5 pl-1.5 pb-px">v{{ avatarDialog.imposterVersion }}</span>
    </Badge>
    <Badge
      v-for="scan in scanWarnings"
      :key="scan.platform"
      :title="scan.label"
      :aria-label="scan.label"
      :variant="scan.status === 'failed' ? 'destructive' : 'outline'"
      class="mr-1.5 mt-1.5 max-w-full"
    >
      <component :is="scan.icon" v-if="scan.icon" class="size-4 shrink-0" aria-hidden="true" />
      <span v-else-if="scan.platform" class="min-w-0 truncate">{{ scan.platform }}</span>
      <span class="shrink-0">{{ scan.text }}</span>
    </Badge>
    <Badge v-if="avatarDialog.ref.unityPackageUrl" class="mr-1.5 mt-1.5" variant="outline">
      {{ t("dialog.avatar.tags.future_proofing") }}
    </Badge>
    <div>
      <template v-for="tag in avatarDialog.ref.tags" :key="tag">
        <Badge v-if="tag.startsWith('content_')" class="mr-1.5 mt-1.5" variant="outline">
          <span v-if="tag === 'content_horror'">{{ t("dialog.avatar.tags.content_horror") }}</span>
          <span v-else-if="tag === 'content_gore'">{{ t("dialog.avatar.tags.content_gore") }}</span>
          <span v-else-if="tag === 'content_violence'">{{ t("dialog.avatar.tags.content_violence") }}</span>
          <span v-else-if="tag === 'content_adult'">{{ t("dialog.avatar.tags.content_adult") }}</span>
          <span v-else-if="tag === 'content_sex'">{{ t("dialog.avatar.tags.content_sex") }}</span>
          <span v-else>{{ tag.replace("content_", "") }}</span>
        </Badge>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Apple, Monitor, Smartphone } from "lucide-vue-next";
import { storeToRefs } from "pinia";
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import Badge from "../../ui/badge/Badge.vue";
import { useAvatarStore } from "../../../stores/avatar";
import { openFolderGeneric } from "../../../shared/utils/app-actions";

const { avatarDialog } = storeToRefs(useAvatarStore());
const { t } = useI18n();

const platformIcons = new Map([
  ["standalonewindows", Monitor],
  ["android", Smartphone],
  ["ios", Apple],
]);

const scanWarnings = computed(() => {
  const warnings = new Map<string, "failed" | "unscanned">();
  for (const pkg of avatarDialog.value.ref.unityPackages ?? []) {
    const status = pkg.scanStatus;
    if (status !== "failed" && status !== "unscanned") continue;
    const platform = pkg.platform ?? "";
    if (warnings.get(platform) !== "failed") warnings.set(platform, status);
  }
  return Array.from(warnings)
    .slice(0, 6)
    .map(([platform, status]) => {
      const icon = platformIcons.get(platform);
      const name = icon ? t(`view.tools.instance_browser.platform_${platform}`) : platform;
      const text = t(status === "failed" ? "dialog.avatar.tags.scan_failed" : "dialog.avatar.tags.unscanned");
      return { platform, status, icon, text, label: name ? `${name} · ${text}` : text };
    });
});

function fileSizeOf(platform: string): string | undefined {
  const analysis = avatarDialog.value.fileAnalysis[platform];
  if (typeof analysis !== "object" || analysis === null || !("_fileSize" in analysis)) {
    return undefined;
  }
  const size = analysis._fileSize;
  return typeof size === "string" ? size : undefined;
}

function performanceLabel(platform: string): string | undefined {
  const info = avatarDialog.value.platformInfo[platform];
  if (typeof info !== "object" || info === null || !("performanceRating" in info)) {
    return undefined;
  }
  const rating = info.performanceRating;
  if (typeof rating !== "string") {
    return undefined;
  }
  return t(`dialog.avatar.tags.performanceRating.${rating.replace(" ", "")}`);
}
</script>
