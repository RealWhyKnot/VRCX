<template>
  <div class="user-dialog-scrollbars flex-1 min-h-0 min-w-0 flex flex-row" :style="{ '--user-dialog-scrollbar-thumb': scrollbarThumbColor }">
    <DialogHeader class="sr-only">
      <DialogTitle>{{ userDialog.ref?.displayName || userDialog.id || t("dialog.user.info.header") }}</DialogTitle>
      <DialogDescription>{{ getUserStateText(userDialog.ref || {}) }}</DialogDescription>
    </DialogHeader>

    <div class="flex-none w-77 overflow-y-auto">
      <UserSummaryHeader
        :get-user-state-text="getUserStateText"
        :copy-user-display-name="copyUserDisplayName"
        :toggle-badge-visibility="toggleBadgeVisibility"
        :toggle-badge-showcased="toggleBadgeShowcased"
        :user-dialog-command="userDialogCommand"
      />
    </div>

    <div class="flex-1 min-w-0 flex flex-col min-h-0 pl-2">
      <TabsUnderline
        v-model="userDialog.activeTab"
        :items="userDialogTabs"
        :active-color="userDialogTabColor"
        :unmount-on-hide="false"
        fill
        :background="true"
        @update:model-value="selectUserDialogTab"
      >
        <template #Info>
          <UserDialogInfoTab ref="infoTabRef" />
        </template>

        <template v-if="userDialog.id !== currentUser.id && !currentUser.hasSharedConnectionsOptOut" #mutual>
          <UserDialogMutualFriendsTab ref="mutualFriendsTabRef" />
        </template>

        <template #Groups>
          <UserDialogGroupsTab ref="groupsTabRef" />
        </template>

        <template #Worlds>
          <UserDialogWorldsTab ref="worldsTabRef" />
        </template>

        <template #favorite-worlds>
          <UserDialogFavoriteWorldsTab ref="favoriteWorldsTabRef" />
        </template>

        <template #Avatars>
          <UserDialogAvatarsTab ref="avatarsTabRef" />
        </template>

        <template #Activity>
          <UserDialogActivityTab ref="activityTabRef" />
        </template>

        <template #JSON>
          <DialogJsonTab
            class="rounded-xl bg-(--profile-card) p-2"
            :tree-data="treeData"
            :tree-data-key="treeDataKey"
            :dialog-id="userDialog.id"
            :dialog-ref="userDialog.ref"
            @refresh="refreshUserDialogTreeData()"
          />
        </template>
      </TabsUnderline>
      <SendInviteDialog
        v-model:send-invite-dialog-visible="sendInviteDialogVisible"
        v-model:send-invite-dialog="sendInviteDialog"
        @close-invite-dialog="closeInviteDialog"
      />
      <SendInviteRequestDialog
        v-model:send-invite-request-dialog-visible="sendInviteRequestDialogVisible"
        v-model:send-invite-dialog="sendInviteDialog"
        @close-invite-dialog="closeInviteDialog"
      />
      <ModerateGroupDialog />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import DialogDescription from "@/components/ui/dialog/DialogDescription.vue";
import DialogHeader from "@/components/ui/dialog/DialogHeader.vue";
import DialogTitle from "@/components/ui/dialog/DialogTitle.vue";
import TabsUnderline from "@/components/ui/tabs/TabsUnderline.vue";
import { storeToRefs } from "pinia";
import { toast } from "vue-sonner";
import { useI18n } from "vue-i18n";

import { useFavoriteStore } from "../../../stores/favorite";
import { useFriendStore } from "../../../stores/friend";
import { useGalleryStore } from "../../../stores/gallery";
import { useGroupStore } from "../../../stores/group";
import { useInstanceStore } from "../../../stores/instance";
import { useInviteStore } from "../../../stores/invite";
import { useLocationStore } from "../../../stores/location";
import { useModalStore } from "../../../stores/modal";
import { useModerationStore } from "../../../stores/moderation";
import { useNotificationStore } from "../../../stores/notification";
import { useUserStore } from "../../../stores/user";
import { copyToClipboard } from "../../../shared/utils/app-actions";
import { logError } from "../../../stores/notification/errors";
import { formatJsonVars } from "../../../shared/utils/base/ui";
import { miscRequest } from "../../../api/misc";
import { useUserDialogCommands } from "./use-user-dialog-commands";
import { showAvatarDialog, showAvatarAuthorDialog } from "../../../coordinators/avatar-coordinator";
import { showUserDialog, refreshUserDialogAvatars } from "../../../coordinators/user-coordinator";
import { getFriendRequest, handleFriendDelete } from "../../../coordinators/friend-relationship-coordinator";

import DialogJsonTab from "../DialogJsonTab.vue";
import SendInviteDialog from "../InviteDialog/SendInviteDialog.vue";
import UserDialogActivityTab from "./UserDialogActivityTab.vue";
import UserDialogAvatarsTab from "./UserDialogAvatarsTab.vue";
import UserDialogFavoriteWorldsTab from "./UserDialogFavoriteWorldsTab.vue";
import UserDialogGroupsTab from "./UserDialogGroupsTab.vue";
import UserDialogInfoTab from "./UserDialogInfoTab.vue";
import UserDialogMutualFriendsTab from "./UserDialogMutualFriendsTab.vue";
import UserDialogWorldsTab from "./UserDialogWorldsTab.vue";
import UserSummaryHeader from "./UserSummaryHeader.vue";

import ModerateGroupDialog from "../ModerateGroupDialog.vue";
import SendInviteRequestDialog from "./SendInviteRequestDialog.vue";

const props = withDefaults(
  defineProps<{
    previousIds: {
      mutualFriend: string | null;
      group: string | null;
      avatar: string | null;
      world: string | null;
      favoriteWorld: string | null;
    };
    updatePreviousId?: (key: string, value: string) => void;
  }>(),
  {
    updatePreviousId: () => undefined,
  }
);

const { t } = useI18n();
const userDialogTabs = computed(() => {
  const tabs = [
    { value: "Info", label: t("dialog.user.info.header") },
    { value: "Groups", label: t("dialog.user.groups.header") },
    { value: "Worlds", label: t("dialog.user.worlds.header") },
    { value: "favorite-worlds", label: t("dialog.user.favorite_worlds.header") },
    { value: "Avatars", label: t("dialog.user.avatars.header") },
    { value: "JSON", label: t("dialog.user.json.header") },
  ];
  if (userDialog.value.id !== currentUser.value.id && !currentUser.value.hasSharedConnectionsOptOut) {
    tabs.splice(1, 0, { value: "mutual", label: t("dialog.user.mutual_friends.header") });
  }

  const jsonIdx = tabs.findIndex((tab) => tab.value === "JSON");
  tabs.splice(jsonIdx, 0, { value: "Activity", label: t("dialog.user.activity.header") });
  return tabs;
});
const infoTabRef = ref<InstanceType<typeof UserDialogInfoTab> | null>(null);
const activityTabRef = ref<InstanceType<typeof UserDialogActivityTab> | null>(null);
const favoriteWorldsTabRef = ref<InstanceType<typeof UserDialogFavoriteWorldsTab> | null>(null);
const mutualFriendsTabRef = ref<InstanceType<typeof UserDialogMutualFriendsTab> | null>(null);
const worldsTabRef = ref<InstanceType<typeof UserDialogWorldsTab> | null>(null);
const avatarsTabRef = ref<InstanceType<typeof UserDialogAvatarsTab> | null>(null);
const groupsTabRef = ref<InstanceType<typeof UserDialogGroupsTab> | null>(null);

const modalStore = useModalStore();
const instanceStore = useInstanceStore();

const { userDialog, currentUser } = storeToRefs(useUserStore());
const userDialogTabColor = computed(() => {
  const color = userDialog.value.theme.buttonColor;
  if (!color) {
    return "var(--primary)";
  }
  return color;
});
const scrollbarThumbColor = computed(() => {
  const color = userDialog.value.theme.buttonColor;
  return !color || color === "var(--primary)" ? "color-mix(in oklab, var(--foreground) 30%, transparent)" : `color-mix(in oklab, ${color} 50%, transparent)`;
});
const { cachedUsers, showSendBoopDialog, showEditProfileDialog } = useUserStore();
const { showFavoriteDialog } = useFavoriteStore();
const { showModerateGroupDialog } = useGroupStore();
const { inviteGroupDialog } = storeToRefs(useGroupStore());
const { lastLocation, lastLocationDestination } = storeToRefs(useLocationStore());
const { refreshInviteMessageTableData } = useInviteStore();
const { friendLogTable } = storeToRefs(useFriendStore());
const { clearInviteImageUpload, showGalleryPage } = useGalleryStore();

const { applyPlayerModeration, handlePlayerModerationDelete, showModerationReportDialog } = useModerationStore();

const { sendInviteDialogVisible, sendInviteDialog, sendInviteRequestDialogVisible, userDialogCommand, registerCallbacks } = useUserDialogCommands(userDialog, {
  t,
  toast,
  modalStore,
  currentUser,
  cachedUsers,
  friendLogTable,
  lastLocation,
  lastLocationDestination,
  inviteGroupDialog,
  showUserDialog,
  showFavoriteDialog,
  showAvatarDialog,
  showAvatarAuthorDialog,
  showModerateGroupDialog,
  showSendBoopDialog,
  showModerationReportDialog,
  showGalleryPage,
  getFriendRequest,
  handleFriendDelete,
  applyPlayerModeration,
  handlePlayerModerationDelete,
  refreshInviteMessageTableData,
  clearInviteImageUpload,
  instanceStore,
  useNotificationStore,
  showEditProfileDialog,
});

watch(
  () => userDialog.value.loading,
  () => {
    if (userDialog.value.visible) {
      if (!userDialog.value.loading) {
        loadLastActiveTab();
      }
    }
  }
);

watch(
  () => userDialog.value.visible,
  (isVisible) => {
    if (isVisible && !userDialog.value.loading) {
      loadLastActiveTab();
    }
  }
);

const treeData = ref<Record<string, unknown>>({});

const treeDataKey = computed(() => {
  const user = treeData.value["user"];
  if (typeof user !== "object" || user === null || !("id" in user)) {
    return null;
  }
  return typeof user.id === "string" || typeof user.id === "number" ? user.id : null;
});

function getUserStateText(user: { state?: string; status?: string }) {
  let state: string;
  if (user.state === "active") {
    state = t("dialog.user.status.active");
  } else if (user.state === "offline") {
    state = t("dialog.user.status.offline");
  } else {
    return getUserStatusText(user.status);
  }
  if (user.status && user.status !== "active") {
    state += ` (${getUserStatusText(user.status)})`;
  }
  return state;
}

function getUserStatusText(status: string | undefined) {
  if (status === "active") {
    return t("dialog.user.status.active");
  }
  if (status === "join me") {
    return t("dialog.user.status.join_me");
  }
  if (status === "ask me") {
    return t("dialog.user.status.ask_me");
  }
  if (status === "busy") {
    return t("dialog.user.status.busy");
  }
  return t("dialog.user.status.offline");
}

function refreshUserDialogTreeData() {
  const D = userDialog.value;
  if (D.id === currentUser.value.id) {
    treeData.value = {
      currentUser: formatJsonVars(currentUser.value),
      user: formatJsonVars(D.ref),
      profile: formatJsonVars(D.publicProfileRef ?? {}),
    };
    return;
  }
  treeData.value = {
    user: formatJsonVars(D.ref),
    profile: formatJsonVars(D.publicProfileRef ?? {}),
  };
}

function handleUserDialogTab(tabName: string) {
  userDialog.value.lastActiveTab = tabName;
  const userId = userDialog.value.id;
  if (tabName === "Info") {
    infoTabRef.value?.onTabActivated();
  } else if (tabName === "mutual") {
    if (userId === currentUser.value.id) {
      userDialog.value.activeTab = "Info";
      userDialog.value.lastActiveTab = "Info";
      return;
    }
    if (props.previousIds.mutualFriend !== userId) {
      props.updatePreviousId("mutualFriend", userId);
      mutualFriendsTabRef.value?.getUserMutualFriends(userId);
    }
  } else if (tabName === "Groups") {
    if (props.previousIds.group !== userId) {
      props.updatePreviousId("group", userId);
      groupsTabRef.value?.getUserGroups(userId);
    }
  } else if (tabName === "Avatars") {
    avatarsTabRef.value?.setUserDialogAvatars(userId);
    if (props.previousIds.avatar !== userId) {
      props.updatePreviousId("avatar", userId);
      if (userId === currentUser.value.id) {
        refreshUserDialogAvatars().catch(logError);
      } else {
        avatarsTabRef.value?.setUserDialogAvatarsRemote(userId);
      }
    }
  } else if (tabName === "Worlds") {
    worldsTabRef.value?.setUserDialogWorlds(userId);
    if (props.previousIds.world !== userId) {
      props.updatePreviousId("world", userId);
      worldsTabRef.value?.refreshUserDialogWorlds();
    }
  } else if (tabName === "favorite-worlds") {
    if (props.previousIds.favoriteWorld !== userId) {
      props.updatePreviousId("favoriteWorld", userId);
      favoriteWorldsTabRef.value?.getUserFavoriteWorlds(userId);
    }
  } else if (tabName === "Activity") {
    activityTabRef.value?.loadOnlineFrequency(userId);
  } else if (tabName === "JSON") {
    refreshUserDialogTreeData();
  }
}

function loadLastActiveTab() {
  const tab = userDialog.value.lastActiveTab;
  handleUserDialogTab(tab);
}

function userDialogTabClick(tabName: string) {
  if (tabName === userDialog.value.lastActiveTab) {
    if (tabName === "JSON") {
      refreshUserDialogTreeData();
    }
    return;
  }
  handleUserDialogTab(tabName);
}

function selectUserDialogTab(tabName: string | number) {
  if (typeof tabName === "string") {
    userDialogTabClick(tabName);
  }
}

registerCallbacks({
  showEditProfileDialog,
  showEditNoteAndMemoDialog: () => {
    infoTabRef.value?.showEditNoteAndMemoDialog();
  },
});

async function toggleBadgeVisibility(badge: { badgeId: string; hidden?: boolean | null | undefined; showcased: boolean }) {
  if (badge.hidden) {
    badge.showcased = false;
  }
  const args = await miscRequest.updateBadge({
    badgeId: badge.badgeId,
    hidden: badge.hidden === true,
    showcased: badge.showcased,
  });
  handleBadgeUpdate(args);
}

async function toggleBadgeShowcased(badge: { badgeId: string; hidden?: boolean | null | undefined; showcased: boolean }) {
  if (badge.showcased) {
    badge.hidden = false;
  }
  const args = await miscRequest.updateBadge({
    badgeId: badge.badgeId,
    hidden: badge.hidden === true,
    showcased: badge.showcased,
  });
  handleBadgeUpdate(args);
}

function handleBadgeUpdate(args: { json: unknown }) {
  if (args.json) {
    toast.success(t("message.badge.updated"));
  }
}

function copyUserDisplayName(displayName: string) {
  copyToClipboard(displayName, "User DisplayName copied to clipboard");
}

function closeInviteDialog() {
  clearInviteImageUpload();
}
</script>

<style scoped>
.user-dialog-scrollbars {
  --user-dialog-scrollbar-thumb: transparent;
  --user-dialog-scrollbar-track: transparent;
}

.user-dialog-scrollbars :deep(*) {
  scrollbar-color: var(--user-dialog-scrollbar-thumb) var(--user-dialog-scrollbar-track);
}
</style>
