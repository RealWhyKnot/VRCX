<template>
  <div class="flex-1 min-h-0 min-w-0 flex flex-row">
    <DialogHeader class="sr-only">
      <DialogTitle>{{ avatarDialog.ref?.name || avatarDialog.id || t("dialog.avatar.info.header") }}</DialogTitle>
      <DialogDescription>
        {{ avatarDialog.ref?.description || avatarDialog.ref?.name || t("dialog.avatar.info.header") }}
      </DialogDescription>
    </DialogHeader>
    <div class="contents">
      <AvatarDialogSidebar @command="avatarDialogCommand" />
      <div class="flex-1 min-w-0 flex flex-col min-h-0 pl-4">
        <TabsUnderline
          v-model="avatarDialog.activeTab"
          :background="true"
          :items="avatarDialogTabs"
          :unmount-on-hide="false"
          fill
          @update:model-value="(tabName) => avatarDialogTabClick(String(tabName))"
        >
          <template #Info>
            <AvatarDialogInfoPanel v-model:memo="memo" @memo-change="onAvatarMemoChange" />
          </template>
          <template #JSON>
            <DialogJsonTab
              class="rounded-xl bg-(--profile-card) p-2"
              :tree-data="treeData"
              :tree-data-key="avatarDialog.id"
              :dialog-id="avatarDialog.id"
              :dialog-ref="avatarDialog.ref"
              :file-analysis="avatarDialog.fileAnalysis"
              @refresh="refreshAvatarDialogTreeData()"
            />
          </template>
        </TabsUnderline>
      </div>
      <template v-if="avatarDialog.visible">
        <SetAvatarTagsDialog v-model:set-avatar-tags-dialog="setAvatarTagsDialog" />
        <SetAvatarStylesDialog v-model:set-avatar-styles-dialog="setAvatarStylesDialog" />
        <input id="AvatarImageUploadButton" type="file" accept="image/*" class="hidden" @change="onFileChangeAvatarImage" />
        <ImageCropDialog
          :open="cropDialogOpen"
          :title="t('dialog.change_content_image.avatar')"
          :aspect-ratio="4 / 3"
          :file="cropDialogFile"
          @update:open="cropDialogOpen = $event"
          @confirm="onCropConfirmAvatar"
        />
      </template>
    </div>
  </div>
</template>
<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { storeToRefs } from "pinia";
import { useI18n } from "vue-i18n";
import { toast } from "vue-sonner";
import DialogDescription from "@/components/ui/dialog/DialogDescription.vue";
import DialogHeader from "@/components/ui/dialog/DialogHeader.vue";
import DialogTitle from "@/components/ui/dialog/DialogTitle.vue";
import TabsUnderline from "@/components/ui/tabs/TabsUnderline.vue";
import DialogJsonTab from "../DialogJsonTab.vue";
import ImageCropDialog from "../ImageCropDialog.vue";
import AvatarDialogSidebar from "./AvatarDialogSidebar.vue";
import AvatarDialogInfoPanel from "./AvatarDialogInfoPanel.vue";
import SetAvatarStylesDialog from "./SetAvatarStylesDialog.vue";
import SetAvatarTagsDialog from "./SetAvatarTagsDialog.vue";
import { useAvatarDialogCommands } from "./use-avatar-dialog-commands";
import { useAvatarSetDialogs } from "./use-avatar-set-dialogs";
import { useAvatarStore } from "../../../stores/avatar";
import { useFavoriteStore } from "../../../stores/favorite";
import { useModalStore } from "../../../stores/modal";
import { useUiStore } from "../../../stores/ui";
import { useUserStore } from "../../../stores/user";
import { logError } from "../../../stores/vrcx-messages";
import { database } from "../../../services/database";
import { formatJsonVars } from "../../../shared/utils/base/ui";
import { showAvatarDialog, applyAvatar } from "../../../coordinators/avatar-coordinator";

const { sortUserDialogAvatars } = useUserStore();
const { userDialog, currentUser } = storeToRefs(useUserStore());
const avatarStore = useAvatarStore();
const { cachedAvatarModerations, cachedAvatars } = avatarStore;
const { avatarDialog } = storeToRefs(avatarStore);
const { applyAvatarModeration } = avatarStore;
const { showFavoriteDialog } = useFavoriteStore();
const modalStore = useModalStore();
const uiStore = useUiStore();

const { t } = useI18n();

const { cropDialogOpen, cropDialogFile, avatarDialogCommand, onFileChangeAvatarImage, onCropConfirmAvatar, registerCallbacks } = useAvatarDialogCommands(
  avatarDialog,
  {
    t,
    toast,
    modalStore,
    userDialog,
    cachedAvatars,
    cachedAvatarModerations,
    showAvatarDialog,
    showFavoriteDialog,
    applyAvatarModeration,
    applyAvatar,
    sortUserDialogAvatars,
    uiStore,
  }
);

const { setAvatarTagsDialog, setAvatarStylesDialog, showSetAvatarTagsDialog, showSetAvatarStylesDialog } = useAvatarSetDialogs(
  avatarDialog,
  currentUser,
  cachedAvatars
);

const treeData = ref<Record<string, unknown>>({});
const memo = ref("");

const avatarDialogTabs = computed(() => [
  { value: "Info", label: t("dialog.avatar.info.header") },
  { value: "JSON", label: t("dialog.avatar.json.header") },
]);

watch(
  () => avatarDialog.value.loading,
  () => {
    if (avatarDialog.value.visible) {
      handleDialogOpen();
      if (!avatarDialog.value.loading) {
        loadLastActiveTab();
      }
    }
  }
);

function handleAvatarDialogTab(tabName: string) {
  avatarDialog.value.lastActiveTab = tabName;
  if (tabName === "JSON") {
    refreshAvatarDialogTreeData();
  }
}

function loadLastActiveTab() {
  handleAvatarDialogTab(avatarDialog.value.lastActiveTab);
}

function avatarDialogTabClick(tabName: string) {
  if (tabName === avatarDialog.value.lastActiveTab) {
    if (tabName === "JSON") {
      refreshAvatarDialogTreeData();
    }
    return;
  }
  handleAvatarDialogTab(tabName);
}

function handleDialogOpen() {
  setAvatarTagsDialog.value.visible = false;
  avatarDialog.value.timeSpent = 0;
  memo.value = "";
  treeData.value = {};
  getAvatarTimeSpent();
  getAvatarMemo();
}

function getAvatarTimeSpent() {
  const D = avatarDialog.value;
  avatarDialog.value.timeSpent = 0;
  void database
    .getAvatarTimeSpent(D.id)
    .then((aviTime) => {
      if (D.id === aviTime.avatarId) {
        avatarDialog.value.timeSpent = aviTime.timeSpent ?? 0;
        if (D.id === currentUser.value.currentAvatar && currentUser.value.$previousAvatarSwapTime) {
          avatarDialog.value.timeSpent += Date.now() - currentUser.value.$previousAvatarSwapTime;
        }
      }
    })
    .catch(logError);
}

function getAvatarMemo() {
  const D = avatarDialog.value;
  void database
    .getAvatarMemoDB(D.id)
    .then((res) => {
      if (D.id === res.avatarId) {
        memo.value = res.memo ?? "";
      }
    })
    .catch(logError);
}

registerCallbacks({
  showSetAvatarTagsDialog: () => showSetAvatarTagsDialog(avatarDialog.value.id),
  showSetAvatarStylesDialog,
});

function onAvatarMemoChange() {
  if (memo.value) {
    database.setAvatarMemo({
      avatarId: avatarDialog.value.id,
      editedAt: new Date().toJSON(),
      memo: memo.value,
    });
  } else {
    database.deleteAvatarMemo(avatarDialog.value.id);
  }
}

function refreshAvatarDialogTreeData() {
  treeData.value = formatJsonVars(avatarDialog.value.ref);
}
</script>
