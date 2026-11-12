<template>
  <div class="flex-1 min-h-0 min-w-0 flex flex-row">
    <DialogHeader class="sr-only">
      <DialogTitle>{{ worldDialog.ref?.name || worldDialog.id }}</DialogTitle>
      <DialogDescription>
        {{ worldDialog.ref?.description }}
      </DialogDescription>
    </DialogHeader>

    <div class="flex-none w-77 pr-4 overflow-y-auto">
      <div class="rounded-xl bg-(--profile-card) overflow-hidden flex flex-col">
        <div class="relative aspect-4/3">
          <img
            v-if="!worldDialog.loading && !imageError"
            :src="worldDialog.ref.thumbnailImageUrl"
            class="absolute inset-0 size-full cursor-pointer object-cover"
            loading="lazy"
            @click="showFullscreenImageDialog(worldDialog.ref.imageUrl ?? '')"
            @error="imageError = true"
          />
          <div v-else-if="!worldDialog.loading" class="absolute inset-0 flex items-center justify-center bg-muted">
            <Image class="size-8 text-muted-foreground" />
          </div>
        </div>
        <div class="flex flex-col p-3">
          <div class="flex min-w-0 flex-col">
            <div class="flex justify-between gap-2">
              <div class="min-w-0 flex-1">
                <div class="overflow-hidden">
                  <span class="flex flex-wrap font-bold cursor-pointer wrap-anywhere" :title="worldDialog.ref.name || worldDialog.id" @click="copyWorldName">
                    <Home v-if="currentUser.$homeLocation && currentUser.$homeLocation.worldId === worldDialog.id" class="inline-block" />
                    {{ worldDialog.ref.name || worldDialog.id }}
                  </span>
                </div>
                <div class="flex flex-col gap-1">
                  <div>
                    <span
                      class="flex flex-wrap cursor-pointer x-grey font-mono text-xs max-w-30"
                      @click="showUserDialog(worldDialog.ref.authorId)"
                      v-text="worldDialog.ref.authorName || worldDialog.ref.authorId"
                    />
                  </div>
                </div>
              </div>
              <div class="grid grid-cols-2 flex-none items-center justify-end gap-2 self-start">
                <TooltipWrapper v-if="worldDialog.isFavorite" side="top" :content="t('dialog.world.actions.favorites_tooltip')">
                  <Button class="rounded-lg" size="icon" :aria-label="t('dialog.world.actions.favorites_tooltip')" @click="worldDialogCommand('Add Favorite')"
                    ><Star
                  /></Button>
                </TooltipWrapper>
                <TooltipWrapper v-else side="top" :content="t('dialog.world.actions.favorites_tooltip')">
                  <Button
                    class="rounded-lg"
                    size="icon"
                    variant="outline"
                    :aria-label="t('dialog.world.actions.favorites_tooltip')"
                    @click="worldDialogCommand('Add Favorite')"
                    ><Star
                  /></Button>
                </TooltipWrapper>
                <DropdownMenu>
                  <DropdownMenuTrigger as-child>
                    <Button variant="outline" size="icon" class="rounded-lg">
                      <Ellipsis />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuItem @click="worldDialogCommand('Refresh')">
                      <RefreshCw class="size-4" />
                      {{ t("dialog.world.actions.refresh") }}
                    </DropdownMenuItem>
                    <DropdownMenuSub>
                      <DropdownMenuSubTrigger @click="worldDialogCommand('Share')">
                        <Share2 class="size-4 mr-2" />
                        <span>{{ t("dialog.world.actions.share") }}</span>
                      </DropdownMenuSubTrigger>
                      <DropdownMenuSubContent side="right" align="start" class="w-56">
                        <DropdownMenuItem @click="worldDialogCommand('Share')">
                          <Copy class="size-4" />
                          {{ t("dialog.world.info.copy_url") }}
                        </DropdownMenuItem>
                        <DropdownMenuItem @click="worldDialogCommand('Copy World Name')">
                          <Copy class="size-4" />
                          {{ t("dialog.world.info.copy_name") }}
                        </DropdownMenuItem>
                        <DropdownMenuItem @click="worldDialogCommand('Copy World ID')">
                          <Copy class="size-4" />
                          {{ t("dialog.world.info.copy_id") }}
                        </DropdownMenuItem>
                      </DropdownMenuSubContent>
                    </DropdownMenuSub>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem @click="worldDialogCommand('New Instance')">
                      <Flag class="size-4" />
                      {{ t("dialog.world.actions.new_instance") }}
                    </DropdownMenuItem>
                    <DropdownMenuItem @click="worldDialogCommand('New Instance and Self Invite')">
                      <MessageSquare class="size-4" />
                      {{
                        canOpenInstanceInGame ? t("dialog.world.actions.new_instance_and_open_ingame") : t("dialog.world.actions.new_instance_and_self_invite")
                      }}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      v-if="currentUser.$homeLocation && currentUser.$homeLocation.worldId === worldDialog.id"
                      @click="worldDialogCommand('Reset Home')"
                    >
                      <Wand2 class="size-4" />
                      {{ t("dialog.world.actions.reset_home") }}
                    </DropdownMenuItem>
                    <DropdownMenuItem v-else @click="worldDialogCommand('Make Home')">
                      <Home class="size-4" />
                      {{ t("dialog.world.actions.make_home") }}
                    </DropdownMenuItem>
                    <DropdownMenuItem @click="worldDialogCommand('Previous Instances')">
                      <LineChart class="size-4" />
                      {{ t("dialog.world.actions.show_previous_instances") }}
                    </DropdownMenuItem>
                    <template v-if="currentUser.id !== worldDialog.ref.authorId">
                      <DropdownMenuItem :disabled="!worldDialog.hasPersistData" @click="worldDialogCommand('Delete Persistent Data')">
                        <Upload class="size-4" />
                        {{ t("dialog.world.actions.delete_persistent_data") }}
                      </DropdownMenuItem>
                    </template>
                    <template v-else>
                      <DropdownMenuItem @click="worldDialogCommand('Rename')">
                        <Pencil class="size-4" />
                        {{ t("dialog.world.actions.rename") }}
                      </DropdownMenuItem>
                      <DropdownMenuItem @click="worldDialogCommand('Change Description')">
                        <Pencil class="size-4" />
                        {{ t("dialog.world.actions.change_description") }}
                      </DropdownMenuItem>
                      <DropdownMenuItem @click="worldDialogCommand('Change Capacity')">
                        <Pencil class="size-4" />
                        {{ t("dialog.world.actions.change_capacity") }}
                      </DropdownMenuItem>
                      <DropdownMenuItem @click="worldDialogCommand('Change Recommended Capacity')">
                        <Pencil class="size-4" />
                        {{ t("dialog.world.actions.change_recommended_capacity") }}
                      </DropdownMenuItem>
                      <DropdownMenuItem @click="worldDialogCommand('Change YouTube Preview')">
                        <Pencil class="size-4" />
                        {{ t("dialog.world.actions.change_preview") }}
                      </DropdownMenuItem>
                      <DropdownMenuItem @click="worldDialogCommand('Change Tags')">
                        <Pencil class="size-4" />
                        {{ t("dialog.world.actions.change_warnings_settings_tags") }}
                      </DropdownMenuItem>
                      <DropdownMenuItem @click="worldDialogCommand('Change Allowed Domains')">
                        <Pencil class="size-4" />
                        {{ t("dialog.world.actions.change_allowed_video_player_domains") }}
                      </DropdownMenuItem>
                      <DropdownMenuItem @click="worldDialogCommand('Change Image')">
                        <Image class="size-4" />
                        {{ t("dialog.world.actions.change_image") }}
                      </DropdownMenuItem>
                      <DropdownMenuItem v-if="worldDialog.ref.unityPackageUrl" @click="worldDialogCommand('Download Unity Package')">
                        <Download class="size-4" />
                        {{ t("dialog.world.actions.download_package") }}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        v-if="worldDialog.ref?.tags?.includes('system_approved') || worldDialog.ref?.tags?.includes('system_labs')"
                        @click="worldDialogCommand('Unpublish')"
                      >
                        <Eye class="size-4" />
                        {{ t("dialog.world.actions.unpublish") }}
                      </DropdownMenuItem>
                      <DropdownMenuItem v-else @click="worldDialogCommand('Publish')">
                        <Eye class="size-4" />
                        {{ t("dialog.world.actions.publish_to_labs") }}
                      </DropdownMenuItem>
                      <DropdownMenuItem :disabled="!worldDialog.hasPersistData" @click="worldDialogCommand('Delete Persistent Data')">
                        <Upload class="size-4" />
                        {{ t("dialog.world.actions.delete_persistent_data") }}
                      </DropdownMenuItem>
                      <DropdownMenuItem variant="destructive" @click="worldDialogCommand('Delete')">
                        <Trash2 class="size-4" />
                        {{ t("dialog.world.actions.delete") }}
                      </DropdownMenuItem>
                    </template>
                  </DropdownMenuContent>
                </DropdownMenu>
                <div class="flex size-9 flex-col">
                  <TooltipWrapper side="top" :content="t('dialog.world.actions.like')">
                    <Button
                      class="h-1/2 w-full rounded-b-none rounded-t-lg border p-0 has-[>svg]:px-0"
                      :class="{ 'border-primary': worldDialog.rating === 'like' }"
                      :variant="worldDialog.rating === 'like' ? 'default' : 'outline'"
                      :aria-label="t('dialog.world.actions.like')"
                      @click="setWorldRating('like')"
                      ><ThumbsUp class="text-xs"
                    /></Button>
                  </TooltipWrapper>
                  <TooltipWrapper side="bottom" :content="t('dialog.world.actions.dislike')">
                    <Button
                      class="h-1/2 w-full rounded-t-none rounded-b-lg border border-t-0 p-0 has-[>svg]:px-0"
                      :class="{ 'border-primary': worldDialog.rating === 'dislike' }"
                      :variant="worldDialog.rating === 'dislike' ? 'default' : 'outline'"
                      :aria-label="t('dialog.world.actions.dislike')"
                      @click="setWorldRating('dislike')"
                      ><ThumbsDown class="text-xs"
                    /></Button>
                  </TooltipWrapper>
                </div>
                <TooltipWrapper v-if="worldDialog.inCache" side="top" :content="t('dialog.world.actions.delete_cache_tooltip')">
                  <Button
                    class="rounded-lg"
                    size="icon"
                    variant="outline"
                    :aria-label="t('common.actions.delete')"
                    :disabled="isGameRunning && worldDialog.cacheLocked"
                    @click="deleteVRChatCache({ unityPackages: worldDialog.ref.unityPackages ?? [] })"
                    ><Trash2
                  /></Button>
                </TooltipWrapper>
              </div>
            </div>
            <div class="flex flex-wrap items-center gap-1 mt-2">
              <Badge v-if="worldDialog.ref.$isLabs" variant="outline">
                {{ t("dialog.world.tags.labs") }}
              </Badge>
              <Badge v-else-if="worldDialog.ref.releaseStatus === 'public'" variant="outline">
                {{ t("dialog.world.tags.public") }}
              </Badge>
              <Badge v-else variant="outline">
                {{ t("dialog.world.tags.private") }}
              </Badge>
              <TooltipWrapper v-if="worldDialog.isPC" side="top" content="PC">
                <Badge class="text-platform-pc border-platform-pc!" variant="outline">
                  <Monitor class="h-4 w-4 text-platform-pc" />
                  <span v-if="fileSizeOf('standalonewindows')" class="x-grey text-platform-pc border-l-[0.8px] border-solid ml-1.5 pl-1.5">
                    {{ fileSizeOf("standalonewindows") }}
                  </span>
                </Badge>
              </TooltipWrapper>

              <TooltipWrapper v-if="worldDialog.isQuest" side="top" content="Quest">
                <Badge class="text-platform-quest border-platform-quest!" variant="outline">
                  <Smartphone class="h-4 w-4 text-platform-quest" />
                  <span v-if="fileSizeOf('android')" class="x-grey text-platform-quest border-l-[0.8px] border-solid ml-1.5 pl-1.5">
                    {{ fileSizeOf("android") }}
                  </span>
                </Badge>
              </TooltipWrapper>

              <TooltipWrapper v-if="worldDialog.isIos" side="top" content="iOS">
                <Badge class="text-platform-ios border-platform-ios" variant="outline">
                  <Apple class="h-4 w-4 text-platform-ios" />
                  <span v-if="fileSizeOf('ios')" class="x-grey text-platform-ios border-platform-ios border-l-[0.8px] border-solid ml-1.5 pl-1.5">
                    {{ fileSizeOf("ios") }}
                  </span>
                </Badge>
              </TooltipWrapper>

              <Badge v-if="worldDialog.avatarScalingDisabled" variant="outline">
                {{ t("dialog.world.tags.avatar_scaling_disabled") }}
              </Badge>
              <Badge v-if="worldDialog.focusViewDisabled" variant="outline">
                {{ t("dialog.world.tags.focus_view_disabled") }}
              </Badge>
              <Badge v-if="worldDialog.ref.unityPackageUrl" variant="outline">
                {{ t("dialog.world.tags.future_proofing") }}
              </Badge>
              <Badge v-if="worldDialog.inCache" variant="outline" class="cursor-pointer" @click="openFolderGeneric(worldDialog.cachePath)">
                <span v-text="worldDialog.cacheSize" />
                | {{ t("dialog.world.tags.cache") }}
              </Badge>
            </div>
            <div class="flex flex-wrap gap-1 mt-1">
              <template v-for="tag in worldDialog.ref.tags" :key="tag">
                <Badge v-if="tag.startsWith('content_')" variant="outline">
                  <span v-if="tag === 'content_horror'">
                    {{ t("dialog.world.tags.content_horror") }}
                  </span>
                  <span v-else-if="tag === 'content_gore'">
                    {{ t("dialog.world.tags.content_gore") }}
                  </span>
                  <span v-else-if="tag === 'content_violence'">
                    {{ t("dialog.world.tags.content_violence") }}
                  </span>
                  <span v-else-if="tag === 'content_adult'">
                    {{ t("dialog.world.tags.content_adult") }}
                  </span>
                  <span v-else-if="tag === 'content_sex'">
                    {{ t("dialog.world.tags.content_sex") }}
                  </span>
                  <span v-else>
                    {{ tag.replace("content_", "") }}
                  </span>
                </Badge>
              </template>
            </div>
          </div>
        </div>
      </div>
      <WorldDialogInfo />
    </div>

    <div class="flex-1 min-w-0 flex flex-col min-h-0 pl-4">
      <TabsUnderline
        v-model="worldDialog.activeTab"
        :background="true"
        :items="worldDialogTabs"
        :unmount-on-hide="false"
        fill
        @update:model-value="(tabName) => worldDialogTabClick(String(tabName))"
      >
        <template #Instances>
          <WorldDialogInstancesTab />
        </template>
        <template #Store>
          <WorldDialogStoreTab ref="storeTabRef" />
        </template>
        <template #JSON>
          <DialogJsonTab
            class="rounded-xl bg-(--profile-card) p-2"
            :tree-data="treeData"
            :tree-data-key="treeDataKey"
            :dialog-id="worldDialog.id"
            :dialog-ref="worldDialog.ref"
            :file-analysis="worldDialog.fileAnalysis"
            @refresh="refreshWorldDialogTreeData()"
          />
        </template>
      </TabsUnderline>
    </div>

    <template v-if="isDialogVisible">
      <WorldAllowedDomainsDialog :world-allowed-domains-dialog="worldAllowedDomainsDialog" />
      <SetWorldTagsDialog
        v-model:is-set-world-tags-dialog-visible="isSetWorldTagsDialogVisible"
        :old-tags="worldDialog.ref?.tags"
        :old-disabled-prop-abilities="oldDisabledPropAbilities"
        :world-id="worldDialog.id"
        :is-world-dialog-visible="worldDialog.visible"
      />
      <NewInstanceDialog :new-instance-dialog-location-tag="newInstanceDialogLocationTag ?? ''" :last-location="lastLocation" />
      <input id="WorldImageUploadButton" type="file" accept="image/*" class="hidden" @change="onFileChangeWorldImage" />
      <ImageCropDialog
        :open="cropDialogOpen"
        :title="t('dialog.change_content_image.world')"
        :aspect-ratio="4 / 3"
        :file="cropDialogFile"
        @update:open="cropDialogOpen = $event"
        @confirm="onCropConfirmWorld"
      />
    </template>
  </div>
</template>

<script setup lang="ts">
import {
  Apple,
  Copy,
  Download,
  Ellipsis,
  Eye,
  Flag,
  Home,
  Image,
  LineChart,
  MessageSquare,
  Monitor,
  Pencil,
  RefreshCw,
  Share2,
  Smartphone,
  Star,
  ThumbsDown,
  ThumbsUp,
  Trash2,
  Upload,
  Wand2,
} from "lucide-vue-next";
import { computed, ref, watch } from "vue";
import DialogDescription from "@/components/ui/dialog/DialogDescription.vue";
import DialogHeader from "@/components/ui/dialog/DialogHeader.vue";
import DialogTitle from "@/components/ui/dialog/DialogTitle.vue";
import Button from "@/components/ui/button/Button.vue";
import TabsUnderline from "@/components/ui/tabs/TabsUnderline.vue";
import { storeToRefs } from "pinia";
import { toast } from "vue-sonner";
import { useI18n } from "vue-i18n";

import { useFavoriteStore } from "../../../stores/favorite";
import { useGalleryStore } from "../../../stores/gallery";
import { useGameStore } from "../../../stores/game";
import { useInstanceStore } from "../../../stores/instance";
import { useInviteStore } from "../../../stores/invite";
import { useLocationStore } from "../../../stores/location";
import { useModalStore } from "../../../stores/modal";
import { useUserStore } from "../../../stores/user";
import { useWorldStore } from "../../../stores/world";
import { showWorldDialog } from "../../../coordinators/world-coordinator";
import { worldRequest } from "../../../api/world";
import DropdownMenu from "../../ui/dropdown-menu/DropdownMenu.vue";
import DropdownMenuContent from "../../ui/dropdown-menu/DropdownMenuContent.vue";
import DropdownMenuItem from "../../ui/dropdown-menu/DropdownMenuItem.vue";
import DropdownMenuSeparator from "../../ui/dropdown-menu/DropdownMenuSeparator.vue";
import DropdownMenuSub from "../../ui/dropdown-menu/DropdownMenuSub.vue";
import DropdownMenuSubContent from "../../ui/dropdown-menu/DropdownMenuSubContent.vue";
import DropdownMenuSubTrigger from "../../ui/dropdown-menu/DropdownMenuSubTrigger.vue";
import DropdownMenuTrigger from "../../ui/dropdown-menu/DropdownMenuTrigger.vue";
import { deleteVRChatCache } from "../../../coordinators/cache-coordinator";
import { logError } from "../../../stores/vrcx-messages";
import type { WorldRatingValue } from "../../../types/vrcx";
import { openFolderGeneric } from "../../../shared/utils/app-actions";
import Badge from "../../ui/badge/Badge.vue";
import { formatJsonVars } from "../../../shared/utils/base/ui";
import { runNewInstanceSelfInviteFlow as newInstanceSelfInvite } from "../../../coordinators/invite-coordinator";
import { useWorldDialogCommands } from "./use-world-dialog-commands";

import DialogJsonTab from "../DialogJsonTab.vue";
import ImageCropDialog from "../ImageCropDialog.vue";
import WorldDialogInfo from "./WorldDialogInfo.vue";
import WorldDialogInstancesTab from "./WorldDialogInstancesTab.vue";
import WorldDialogStoreTab from "./WorldDialogStoreTab.vue";
import { showUserDialog } from "../../../coordinators/user-coordinator";

import NewInstanceDialog from "../NewInstanceDialog/NewInstanceDialog.vue";
import SetWorldTagsDialog from "./SetWorldTagsDialog.vue";
import WorldAllowedDomainsDialog from "./WorldAllowedDomainsDialog.vue";

const { currentUser, userDialog } = storeToRefs(useUserStore());
const { worldDialog } = storeToRefs(useWorldStore());
const { cachedWorlds } = useWorldStore();
const { lastLocation } = storeToRefs(useLocationStore());
const { canOpenInstanceInGame } = useInviteStore();
const { showFavoriteDialog } = useFavoriteStore();
const { showPreviousInstancesListDialog: openPreviousInstancesListDialog } = useInstanceStore();
const { isGameRunning } = storeToRefs(useGameStore());
const { showFullscreenImageDialog } = useGalleryStore();
const modalStore = useModalStore();

const { t } = useI18n();

const {
  worldAllowedDomainsDialog,
  isSetWorldTagsDialogVisible,
  newInstanceDialogLocationTag,
  cropDialogOpen,
  cropDialogFile,
  worldDialogCommand,
  onFileChangeWorldImage,
  onCropConfirmWorld,
  copyWorldName,
  showWorldAllowedDomainsDialog,
  registerCallbacks,
} = useWorldDialogCommands(worldDialog, {
  t,
  toast,
  modalStore,
  userDialog,
  cachedWorlds,
  showWorldDialog,
  showFavoriteDialog,
  newInstanceSelfInvite,
  showPreviousInstancesListDialog: openPreviousInstancesListDialog,
  showFullscreenImageDialog,
});

registerCallbacks({
  showSetWorldTagsDialog: () => {
    isSetWorldTagsDialogVisible.value = true;
  },
  showWorldAllowedDomainsDialog: () => {
    showWorldAllowedDomainsDialog();
  },
  showChangeWorldImageDialog: () => {
    const uploadButton = document.getElementById("WorldImageUploadButton");
    if (!uploadButton) {
      throw new Error("WorldImageUploadButton is not in the document");
    }
    uploadButton.click();
  },
});

const worldDialogTabs = computed(() => [
  { value: "Instances", label: t("dialog.world.instances.header") },
  ...(worldDialog.value.ref.storeId ? [{ value: "Store", label: t("dialog.world.store.header") }] : []),
  { value: "JSON", label: t("dialog.world.json.header") },
]);

const treeData = ref<Record<string, unknown>>({});
const storeTabRef = ref<{ getWorldListings: () => Promise<void> } | null>(null);
const imageError = ref(false);

const treeDataKey = computed(() => {
  const id = treeData.value["id"];
  return typeof id === "string" ? id : null;
});

const oldDisabledPropAbilities = computed(() =>
  (worldDialog.value.ref.disabledPropAbilities ?? []).filter((ability): ability is string => typeof ability === "string")
);

function fileSizeOf(platform: string): string | undefined {
  const analysis = worldDialog.value.fileAnalysis[platform];
  if (typeof analysis !== "object" || analysis === null || !("_fileSize" in analysis)) {
    return undefined;
  }
  const size = analysis._fileSize;
  return typeof size === "string" ? size : undefined;
}

watch(
  () => worldDialog.value.id,
  () => {
    imageError.value = false;
  }
);

const isDialogVisible = computed({
  get() {
    return worldDialog.value.visible;
  },
  set(isVisible: boolean) {
    worldDialog.value.visible = isVisible;
  },
});

watch(
  () => worldDialog.value.loading,
  () => {
    if (worldDialog.value.visible) {
      handleDialogOpen();
      if (!worldDialog.value.loading) {
        loadLastActiveTab();
      }
    }
  }
);

function handleWorldDialogTab(tabName: string) {
  worldDialog.value.lastActiveTab = tabName;
  if (tabName === "Store") {
    void storeTabRef.value?.getWorldListings().catch(logError);
  } else if (tabName === "JSON") {
    refreshWorldDialogTreeData();
  }
}

function loadLastActiveTab() {
  if (worldDialog.value.lastActiveTab === "Store" && !worldDialog.value.ref.storeId) {
    worldDialog.value.activeTab = "Instances";
    worldDialog.value.lastActiveTab = "Instances";
  }
  handleWorldDialogTab(worldDialog.value.lastActiveTab);
}

function worldDialogTabClick(tabName: string) {
  if (tabName === worldDialog.value.lastActiveTab) {
    if (tabName === "JSON") {
      refreshWorldDialogTreeData();
    }
    return;
  }
  handleWorldDialogTab(tabName);
}

function handleDialogOpen() {
  treeData.value = {};
}

function refreshWorldDialogTreeData() {
  treeData.value = formatJsonVars(worldDialog.value.ref);
}

function setWorldRating(rating: WorldRatingValue) {
  const D = worldDialog.value;
  const req = D.rating === rating ? worldRequest.deleteWorldRating({ worldId: D.id }) : worldRequest.setWorldRating({ worldId: D.id, value: rating });
  void req
    .then((args) => {
      if (args.params.worldId === D.id) {
        D.rating = args.json?.value ?? null;
      }
    })
    .catch(logError);
}
</script>
