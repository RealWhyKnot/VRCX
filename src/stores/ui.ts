import { ref, watch } from "vue";
import { defineStore } from "pinia";
import { toast } from "vue-sonner";
import { useMagicKeys } from "@vueuse/core";
import { useRouter } from "vue-router";

import { AppDebug } from "../services/app-config";
import { refreshCustomCss } from "../shared/utils/base/ui";
import { updateLocalizedStrings } from "../plugins/i18n";
import { useAppearanceSettingsStore } from "./settings/appearance";
import { useAvatarStore } from "./avatar";
import { useGroupStore } from "./group";
import {
  clearGroupMemberModerationDialog,
  showGroupDialog,
  showGroupMemberModerationDialog,
  showGroupRolesDialog,
} from "../coordinators/group-dialog-coordinator";
import { showWorldDialog } from "../coordinators/world-coordinator";
import { showAvatarDialog } from "../coordinators/avatar-coordinator";
import { showUserDialog } from "../coordinators/user-coordinator";
import { useInstanceStore } from "./instance";
import { useNotificationStore } from "./notification";
import { useSearchStore } from "./search";
import { useUserStore } from "./user";
import { useWorldStore } from "./world";
import type { DialogCrumb } from "./ui-types";
import { logFailure } from "./log-failure";

export const useUiStore = defineStore("Ui", () => {
  const notificationStore = useNotificationStore();
  const instanceStore = useInstanceStore();
  const router = useRouter();
  const keys = useMagicKeys();
  const { directAccessPaste } = useSearchStore();
  const appearanceSettings = useAppearanceSettingsStore();

  const shiftHeld = ref(false);
  const notifiedMenus = ref<string[]>([]);
  const trayIconNotify = ref(false);
  const dialogCrumbs = ref<DialogCrumb[]>([]);

  function watchKey(name: string, onChange: (isActive: boolean) => void) {
    const key = keys[name];
    if (key) {
      watch(key, onChange);
    }
  }

  watchKey("Ctrl+R", (isPressed) => {
    if (isPressed) {
      location.reload();
    }
  });

  watchKey("Ctrl+D", (isPressed) => {
    if (isPressed) {
      void directAccessPaste().catch(logFailure("Direct access paste failed:"));
    }
  });

  watchKey("Meta+D", (isPressed) => {
    if (isPressed) {
      void directAccessPaste().catch(logFailure("Direct access paste failed:"));
    }
  });

  watchKey("Shift", (isHeld) => {
    shiftHeld.value = isHeld;
  });

  watchKey("Ctrl+Shift+I", (isPressed) => {
    if (isPressed) {
      showConsole();
    }
  });

  watchKey("Alt+Shift+R", (isPressed) => {
    if (isPressed) {
      void refreshCustomCss().catch(logFailure("Refreshing custom CSS failed:"));
      void updateLocalizedStrings().catch(logFailure("Refreshing localization strings failed:"));
      toast.success("Custom CSS and localization strings refreshed");
    }
  });

  function pushDialogCrumb(data: DialogCrumb) {
    const { type, id, label } = data;
    if (!type || !id) {
      return;
    }
    const items = dialogCrumbs.value;
    const last = items[items.length - 1];
    if (last?.type === type && last.id === id) {
      if (label && last.label !== label) {
        last.label = label;
      }
      return;
    }
    const existing = items.find((item) => item.type === type && item.id === id);
    if (existing) {
      items.splice(items.indexOf(existing) + 1);
      if (label) {
        existing.label = label;
      }
      return;
    }
    if (data.label === undefined || data.label === "") {
      data.label = data.id;
    }
    items.push(data);
  }

  function setDialogCrumbLabel(type: string, id: string, label: string) {
    if (!type || !id || !label) {
      return;
    }
    const item = dialogCrumbs.value.find((entry) => entry.type === type && entry.id === id);
    if (item) {
      item.label = label;
    }
  }

  function jumpDialogCrumb(index: number) {
    if (index < 0 || index >= dialogCrumbs.value.length) {
      return;
    }
    dialogCrumbs.value.splice(index + 1);
  }

  function jumpBackDialogCrumb() {
    if (dialogCrumbs.value.length > 0) {
      dialogCrumbs.value.pop();
    }
    if (dialogCrumbs.value.length === 0) {
      closeMainDialog();
      return;
    }
    handleBreadcrumbClick(dialogCrumbs.value.length - 1);
  }

  function handleBreadcrumbClick(index: number) {
    const item = dialogCrumbs.value[index];
    if (!item) {
      return;
    }
    jumpDialogCrumb(index);
    if (item.type === "user") {
      showUserDialog(item.id);
      return;
    }
    if (item.type === "world") {
      showWorldDialog(item.tag ?? "", item.shortName ?? null);
      return;
    }
    if (item.type === "avatar") {
      showAvatarDialog(item.id);
      return;
    }
    if (item.type === "group") {
      showGroupDialog(item.id);
      return;
    }
    if (item.type === "previous-instances-user") {
      void instanceStore.showPreviousInstancesListDialog("user", item.id).catch(logFailure("Showing previous instances failed:"));
      return;
    }
    if (item.type === "previous-instances-world") {
      void instanceStore.showPreviousInstancesListDialog("world", item.id).catch(logFailure("Showing previous instances failed:"));
      return;
    }
    if (item.type === "previous-instances-group") {
      void instanceStore.showPreviousInstancesListDialog("group", item.id).catch(logFailure("Showing previous instances failed:"));
      return;
    }
    if (item.type === "previous-instances-info") {
      instanceStore.showPreviousInstancesInfoDialog(item.id);
      return;
    }
    if (item.type === "group-member-moderation") {
      showGroupMemberModerationDialog(item.id);
      return;
    }
    if (item.type === "group-roles") {
      showGroupRolesDialog(item.id);
      return;
    }
    console.error(`Unknown dialog crumb type: ${item.type}, closing dialog`);
    closeMainDialog();
  }

  function clearDialogCrumbs() {
    dialogCrumbs.value = [];
  }

  function closeMainDialog() {
    const userStore = useUserStore();
    const worldStore = useWorldStore();
    const avatarStore = useAvatarStore();
    const groupStore = useGroupStore();

    userStore.setUserDialogVisible(false);
    worldStore.setWorldDialogVisible(false);
    avatarStore.setAvatarDialogVisible(false);
    groupStore.setGroupDialogVisible(false);
    groupStore.setGroupMemberModerationVisible(false);
    clearGroupMemberModerationDialog();
    groupStore.setGroupRolesDialogVisible(false);
    instanceStore.hidePreviousInstancesDialogs();
    clearDialogCrumbs();
  }

  function openDialog(data: DialogCrumb): boolean {
    const { type } = data;
    const userStore = useUserStore();
    const worldStore = useWorldStore();
    const avatarStore = useAvatarStore();
    const groupStore = useGroupStore();
    const isPrevInfo = type === "previous-instances-info";
    const isPrevList = type.startsWith("previous-instances-") && type !== "previous-instances-info";
    const isAnyDialogOpen =
      dialogCrumbs.value.length > 0 ||
      userStore.userDialog.visible ||
      worldStore.worldDialog.visible ||
      avatarStore.avatarDialog.visible ||
      groupStore.groupDialog.visible ||
      groupStore.groupMemberModeration.visible ||
      groupStore.groupRolesDialog.visible ||
      (instanceStore.previousInstancesInfoDialog.visible && !isPrevInfo) ||
      (instanceStore.previousInstancesListDialog.visible && !isPrevList);

    if (type !== "user") {
      userStore.setUserDialogVisible(false);
    }
    if (type !== "world") {
      worldStore.setWorldDialogVisible(false);
    }
    if (type !== "avatar") {
      avatarStore.setAvatarDialogVisible(false);
    }
    if (type !== "group") {
      groupStore.setGroupDialogVisible(false);
    }
    if (type !== "group-member-moderation") {
      groupStore.setGroupMemberModerationVisible(false);
    }
    if (type !== "group-roles") {
      groupStore.setGroupRolesDialogVisible(false);
    }
    if (!isPrevInfo) {
      instanceStore.setPreviousInstancesInfoDialogVisible(false);
    }
    if (!isPrevList) {
      instanceStore.setPreviousInstancesListDialogVisible(false);
    }
    if (!isAnyDialogOpen) {
      clearDialogCrumbs();
    }
    pushDialogCrumb(data);
    return isAnyDialogOpen;
  }

  document.body.addEventListener("drop", (event) => {
    event.preventDefault();
  });

  function showConsole() {
    void AppApi.ShowDevTools().catch(logFailure("Showing dev tools failed:"));
    if (AppDebug.debug || AppDebug.debugWebRequests || AppDebug.debugWebSocket || AppDebug.debugUserDiff) {
      return;
    }
    console.log("%cCareful! This might not do what you think.", "background-color: red; color: yellow; font-size: 32px; font-weight: bold");
    console.log("%cIf someone told you to copy-paste something here, it can give them access to your account.", "font-size: 20px;");
  }

  watch(
    () => router.currentRoute.value.name,
    (routeName) => {
      if (routeName) {
        const name = String(routeName);
        removeNotify(name);
        if (name === "notification") {
          notificationStore.clearUnseenNotifications();
        }
      }
    }
  );

  function notifyMenu(index: string) {
    const currentRouteName = router.currentRoute.value.name;
    if (index !== currentRouteName && !notifiedMenus.value.includes(index)) {
      notifiedMenus.value.push(index);
      updateTrayIconNotify();
    }
  }

  function removeNotify(index: string) {
    notifiedMenus.value = notifiedMenus.value.filter((i) => i !== index);
    updateTrayIconNotify();
  }

  function clearAllNotifications() {
    notifiedMenus.value = [];
    updateTrayIconNotify();
  }

  function updateTrayIconNotify(isForced = false) {
    const isNotifyActive =
      appearanceSettings.notificationIconDot && (notifiedMenus.value.includes("notification") || notifiedMenus.value.includes("friend-log"));

    if (trayIconNotify.value !== isNotifyActive || isForced) {
      trayIconNotify.value = isNotifyActive;
      if (isHostLinux) {
        void window.electron.setTrayIconNotification(trayIconNotify.value).catch(logFailure("Setting tray icon notification failed:"));
        return;
      }
      void AppApi.SetTrayIconNotification(trayIconNotify.value).catch(logFailure("Setting tray icon notification failed:"));
    }
  }
  updateTrayIconNotify(true);

  return {
    notifiedMenus,
    shiftHeld,
    dialogCrumbs,

    notifyMenu,
    removeNotify,
    clearAllNotifications,
    showConsole,
    updateTrayIconNotify,
    pushDialogCrumb,
    setDialogCrumbLabel,
    jumpDialogCrumb,
    clearDialogCrumbs,
    closeMainDialog,
    openDialog,
    jumpBackDialogCrumb,
    handleBreadcrumbClick,
  };
});
