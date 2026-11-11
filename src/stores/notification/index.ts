import { computed, ref, watch } from "vue";
import { defineStore } from "pinia";
import { useI18n } from "vue-i18n";

import dayjs from "dayjs";

import { getNotificationCategory, getNotificationTs } from "../../shared/utils/notification-category";
import { queryRequest } from "../../api/query-request";
import { watchState } from "../../services/watch-state";
import { createOverlayDispatch } from "./overlay-dispatch";
import { createNotyPlayback, resolveNotyUserId } from "./noty-playback";
import { createPipelineHandler } from "./pipeline";
import { openNotificationLink } from "./open-link";
import { createSeenQueue } from "./seen-queue";
import { createNotificationActions } from "./actions";
import { createNotificationHandlers } from "./notification-handlers";
import { logError } from "./errors";
import { isNotificationExpired } from "./helpers";
import type { FreeStoreItemDialog, InventoryBundleDialog, NotificationEntry, NotificationTable, NotyEntry } from "./types";
import { useAdvancedSettingsStore } from "../settings/advanced";
import { useFavoriteStore } from "../favorite";
import { useFriendStore } from "../friend";
import { useGameStore } from "../game";
import { useGeneralSettingsStore } from "../settings/general";
import { useInstanceStore } from "../instance";
import { useLocationStore } from "../location";
import { useModalStore } from "../modal";
import { useNotificationsSettingsStore } from "../settings/notifications";
import { useSharedFeedStore } from "../shared-feed";
import { useUiStore } from "../ui";
import { useUserStore } from "../user";
import { useWristOverlaySettingsStore } from "../settings/wrist-overlay";

export const useNotificationStore = defineStore("Notification", () => {
  const { t } = useI18n();
  const generalSettingsStore = useGeneralSettingsStore();
  const locationStore = useLocationStore();
  const favoriteStore = useFavoriteStore();
  const friendStore = useFriendStore();
  const notificationsSettingsStore = useNotificationsSettingsStore();
  const advancedSettingsStore = useAdvancedSettingsStore();
  const userStore = useUserStore();
  const wristOverlaySettingsStore = useWristOverlaySettingsStore();
  const uiStore = useUiStore();
  const gameStore = useGameStore();
  const sharedFeedStore = useSharedFeedStore();
  const instanceStore = useInstanceStore();
  const modalStore = useModalStore();

  const notificationInitStatus = ref(false);
  const notificationTable = ref<NotificationTable>({
    data: [],
    filters: [
      {
        prop: "type",
        value: [],
      },
      {
        prop: ["senderUsername", "message"],
        value: "",
      },
    ],
    pageSize: 20,
    pageSizeLinked: true,
    paginationProps: {
      layout: "sizes,prev,pager,next,total",
    },
  });
  const unseenNotifications = ref<string[]>([]);
  const isNotificationsLoading = ref(false);
  const isNotificationCenterOpen = ref(false);
  const inventoryBundleDialog = ref<InventoryBundleDialog>({
    visible: false,
    bundles: [],
  });
  const shownBundleIds = new Set<string>();

  const freeStoreItemDialog = ref<FreeStoreItemDialog>({
    visible: false,
    listings: [],
  });
  const shownFreeListingIds = new Set<string>();

  const friendNotifications = computed(() => notificationTable.value.data.filter((n) => getNotificationCategory(n.type) === "friend"));
  const groupNotifications = computed(() => notificationTable.value.data.filter((n) => getNotificationCategory(n.type) === "group"));
  const otherNotifications = computed(() => notificationTable.value.data.filter((n) => getNotificationCategory(n.type) === "other"));
  const unseenSet = computed(() => new Set(unseenNotifications.value));
  const isUnseen = (n: NotificationEntry) => typeof n.id !== "undefined" && unseenSet.value.has(n.id);
  const unseenFriendNotifications = computed(() => friendNotifications.value.filter((n) => isUnseen(n)));
  const unseenGroupNotifications = computed(() => groupNotifications.value.filter((n) => isUnseen(n)));
  const unseenOtherNotifications = computed(() => otherNotifications.value.filter((n) => isUnseen(n)));
  const recentCutoff = computed(() => dayjs().subtract(24, "hour").valueOf());
  const recentFriendNotifications = computed(() =>
    friendNotifications.value.filter((n) => !isUnseen(n) && n.seen !== false && getNotificationTs(n) > recentCutoff.value)
  );
  const recentGroupNotifications = computed(() =>
    groupNotifications.value.filter((n) => !isUnseen(n) && n.seen !== false && getNotificationTs(n) > recentCutoff.value)
  );
  const recentOtherNotifications = computed(() =>
    otherNotifications.value.filter((n) => !isUnseen(n) && n.seen !== false && getNotificationTs(n) > recentCutoff.value)
  );
  const hasUnseenNotifications = computed(() => unseenNotifications.value.length > 0);

  const overlay = createOverlayDispatch({
    getUserIdFromNoty: (noty: NotyEntry) => resolveNotyUserId(noty, userStore),
    queryRequest,
    notificationsSettingsStore,
    advancedSettingsStore,
  });

  const { playNoty, queueNotificationNoty, queueGameLogNoty, queueFeedNoty, queueFriendLogNoty, queueModerationNoty } = createNotyPlayback({
    userStore,
    friendStore,
    gameStore,
    locationStore,
    notificationsSettingsStore,
    wristOverlaySettingsStore,
    overlay,
  });

  const {
    init,
    initNotifications,
    refreshNotifications,
    checkInventoryBundles,
    checkFreeStoreItems,
    addFailedFreeListingIds,
    expireNotification,
    handleNotification,
    handleNotificationV2,
    handleNotificationV2Update,
    handleNotificationV2Hide,
    handleNotificationHide,
    handleNotificationSee,
    handleNotificationAccept,
    testNotification,
    appendNotificationTableEntry,
    setNotificationInitStatus,
    clearUnseenNotifications,
  } = createNotificationHandlers({
    t,
    notificationTable,
    unseenNotifications,
    notificationInitStatus,
    isNotificationsLoading,
    inventoryBundleDialog,
    freeStoreItemDialog,
    shownBundleIds,
    shownFreeListingIds,
    notificationsSettingsStore,
    userStore,
    uiStore,
    instanceStore,
    sharedFeedStore,
    queueNotificationNoty,
    playNoty,
  });

  const { handlePipelineNotification } = createPipelineHandler({
    generalSettingsStore,
    favoriteStore,
    locationStore,
    userStore,
    instanceStore,
    handleNotificationHide,
  });

  const { queueMarkAsSeen, markAllAsSeen } = createSeenQueue({
    notificationTable,
    unseenNotifications,
    uiStore,
    handleNotificationSee,
    handleNotificationV2Update,
    handleNotificationV2Hide,
  });

  const {
    acceptFriendRequestNotification,
    hideNotification,
    hideNotificationPrompt,
    acceptRequestInvite,
    sendNotificationResponse,
    deleteNotificationLog,
    deleteNotificationLogPrompt,
  } = createNotificationActions({
    t,
    modalStore,
    locationStore,
    userStore,
    notificationTable,
    handleNotificationAccept,
    handleNotificationHide,
    handleNotificationV2Hide,
  });

  watch(
    () => watchState.isLoggedIn,
    (isLoggedIn) => {
      isNotificationsLoading.value = false;
      notificationTable.value.data = [];
      inventoryBundleDialog.value.visible = false;
      freeStoreItemDialog.value.visible = false;
      if (isLoggedIn) {
        void initNotifications().catch(logError);
      }
    },
    { flush: "sync" }
  );

  watch(
    () => notificationsSettingsStore.inventoryBundleNotifications,
    (isEnabled) => {
      if (!isEnabled) {
        inventoryBundleDialog.value.visible = false;
      } else if (watchState.isLoggedIn) {
        void checkInventoryBundles().catch(logError);
      }
    }
  );

  watch(
    () => notificationsSettingsStore.freeStoreItemNotifications,
    (isEnabled) => {
      if (!isEnabled) {
        freeStoreItemDialog.value.visible = false;
      } else if (watchState.isLoggedIn) {
        void checkFreeStoreItems().catch(logError);
      }
    }
  );

  void init().catch(logError);

  return {
    notificationInitStatus,
    notificationTable,
    unseenNotifications,
    isNotificationsLoading,
    inventoryBundleDialog,
    freeStoreItemDialog,

    initNotifications,
    expireNotification,
    refreshNotifications,
    checkInventoryBundles,
    checkFreeStoreItems,
    addFailedFreeListingIds,
    queueNotificationNoty,
    playNoty,
    queueGameLogNoty,
    queueFeedNoty,
    queueFriendLogNoty,
    queueModerationNoty,
    handleNotificationAccept,
    handleNotificationSee,
    handlePipelineNotification,
    handleNotificationV2Update,
    handleNotificationHide,
    handleNotificationV2Hide,
    handleNotification,
    handleNotificationV2,
    testNotification,

    acceptFriendRequestNotification,
    hideNotification,
    hideNotificationPrompt,
    acceptRequestInvite,
    sendNotificationResponse,
    deleteNotificationLog,
    deleteNotificationLogPrompt,

    isNotificationCenterOpen,
    friendNotifications,
    groupNotifications,
    otherNotifications,
    unseenFriendNotifications,
    unseenGroupNotifications,
    unseenOtherNotifications,
    recentFriendNotifications,
    recentGroupNotifications,
    recentOtherNotifications,
    hasUnseenNotifications,
    getNotificationCategory,
    isNotificationExpired,
    openNotificationLink,
    queueMarkAsSeen,
    markAllAsSeen,
    appendNotificationTableEntry,
    setNotificationInitStatus,
    clearUnseenNotifications,
  };
});
