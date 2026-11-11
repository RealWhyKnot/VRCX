import { computed, ref, watch } from "vue";
import { defineStore } from "pinia";
import { useI18n } from "vue-i18n";

import dayjs from "dayjs";

import {
  applyBoopLegacyHandling,
  createDefaultNotificationRef,
  createDefaultNotificationV2Ref,
  parseNotificationDetails,
  sanitizeNotificationJson,
} from "../../shared/utils/notification-transforms";
import { parseLocation } from "../../shared/utils/location-parser";
import { removeFromArray } from "../../shared/utils/base/array";
import { instanceRequest } from "../../api/instance";
import { notificationRequest } from "../../api/notification";
import { queryRequest } from "../../api/query-request";
import { database, dbVars } from "../../services/database";
import { getNotificationCategory, getNotificationTs } from "../../shared/utils/notification-category";
import { AppDebug } from "../../services/app-config";
import { createOverlayDispatch } from "./overlay-dispatch";
import { createNotyPlayback, resolveNotyUserId } from "./noty-playback";
import { createPipelineHandler } from "./pipeline";
import { openNotificationLink } from "./open-link";
import { createSeenQueue } from "./seen-queue";
import { createNotificationActions } from "./actions";
import { hasStatus, logError } from "./errors";
import {
  findLastStoredNotification,
  findStoredNotification,
  forEachNotificationPage,
  hasBoopFields,
  isNotificationExpired,
  isStringArray,
  readMaxTableSize,
  toStoredNotifications,
} from "./helpers";
import {
  addFailedFreeListingIds as addFailedFreeListingIdsFor,
  checkFreeStoreItems as runFreeStoreItemCheck,
  checkInventoryBundles as runInventoryBundleCheck,
} from "./offer-checks";
import type {
  FreeStoreItemDialog,
  InventoryBundleDialog,
  NotificationArgs,
  NotificationEntry,
  NotificationJson,
  NotificationTable,
  NotyEntry,
  StoredNotificationEntry,
} from "./types";
import { useAdvancedSettingsStore } from "../settings/advanced";
import { useFavoriteStore } from "../favorite";
import { useFriendStore } from "../friend";
import { handleFriendAdd } from "../../coordinators/friend-relationship-coordinator";
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
import { watchState } from "../../services/watch-state";

import { configRepository } from "../../services/config";

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

  async function init() {
    const raw: unknown = JSON.parse(await configRepository.getString("VRCX_notificationTableFilters", "[]"));
    notificationTable.value.filters[0].value = isStringArray(raw) ? raw : [];
  }

  void init().catch(logError);

  function handleNotification(args: NotificationArgs) {
    const ref = applyNotification(args.json);
    args.ref = ref;
    const array = notificationTable.value.data;
    const { length } = array;
    if (ref.seen) {
      removeFromArray(unseenNotifications.value, ref.id);
    } else if (!unseenNotifications.value.includes(ref.id)) {
      unseenNotifications.value.push(ref.id);
    }
    for (let i = 0; i < length; ++i) {
      if (array[i]?.id === ref.id) {
        array[i] = ref;
        return;
      }
    }
    if (ref.senderUserId !== userStore.currentUser.id) {
      const isExcludedType = ref.type === "friendRequest" || ref.type === "ignoredFriendRequest" || ref.type.includes(".");
      const isNotificationInitReady = !notificationInitStatus.value || !isNotificationsLoading.value;
      const isMatchingTypeFilter = notificationTable.value.filters[0].value.length === 0 || notificationTable.value.filters[0].value.includes(ref.type);

      if (!isExcludedType) {
        database.addNotificationToDatabase(ref);
      }
      if (isNotificationInitReady) {
        const worldId = ref.details["worldId"];
        if (typeof worldId === "string" && worldId && !instanceStore.cachedInstances.has(worldId)) {
          const L = parseLocation(worldId);
          if (L.isRealInstance) {
            void instanceRequest
              .getInstance({
                worldId: L.worldId,
                instanceId: L.instanceId,
              })
              .catch(logError);
          }
        }
        queueNotificationNoty(ref);
        void sharedFeedStore.addEntry(ref).catch(logError);
      }
      if (isMatchingTypeFilter && !isExcludedType) {
        uiStore.notifyMenu("notification");
      }
    }
    notificationTable.value.data.push(ref);
    const D = userStore.userDialog;
    if (!D.visible || ref.type !== "friendRequest" || ref.senderUserId !== D.id) {
      return;
    }
    D.incomingRequest = true;
  }

  function handleNotificationHide(notificationId: string) {
    const ref = findStoredNotification(notificationTable.value.data, notificationId);
    if (typeof ref === "undefined") {
      return;
    }
    if (ref.type === "friendRequest" || ref.type === "ignoredFriendRequest" || ref.type.includes(".")) {
      removeFromArray(notificationTable.value.data, ref);
    } else {
      ref.$isExpired = true;
      database.updateNotificationExpired(ref);
    }
    handleNotificationExpire({
      ref,
      params: {
        notificationId: ref.id,
      },
    });
  }

  function appendNotificationTableEntry(entry: NotificationEntry) {
    notificationTable.value.data.push(entry);
  }

  function setNotificationInitStatus(isReady: boolean) {
    notificationInitStatus.value = isReady;
  }

  function clearUnseenNotifications() {
    unseenNotifications.value = [];
  }

  function handleNotificationSee(notificationId: string) {
    removeFromArray(unseenNotifications.value, notificationId);
    if (unseenNotifications.value.length === 0) {
      uiStore.removeNotify("notification");
    }
    const ref = notificationTable.value.data.find((n) => n.id === notificationId);
    if (ref) {
      ref.seen = true;
    }
    database.seenNotificationV2(notificationId);
  }

  function handleNotificationAccept(args: { params: { notificationId: string }; ref?: NotificationEntry }) {
    const ref = findLastStoredNotification(notificationTable.value.data, args.params.notificationId);
    if (typeof ref === "undefined") {
      return;
    }
    ref.$isExpired = true;
    args.ref = ref;
    handleNotificationExpire({
      ref,
      params: {
        notificationId: ref.id,
      },
    });
    if (ref.senderUserId !== undefined) {
      handleFriendAdd({
        params: {
          userId: ref.senderUserId,
        },
      });
    }

    const D = userStore.userDialog;
    if (ref.type !== "friendRequest" || ref.senderUserId !== D.id) {
      return;
    }
    D.isFriend = true;
    D.incomingRequest = false;
  }

  function handleNotificationExpire(args: { ref: StoredNotificationEntry; params?: unknown }) {
    const { ref } = args;
    const D = userStore.userDialog;
    if (ref.type !== "friendRequest" || ref.senderUserId !== D.id) {
      return;
    }
    D.incomingRequest = false;
  }

  function applyNotification(data: NotificationJson): StoredNotificationEntry {
    const json = sanitizeNotificationJson({ ...data });
    const existing = findLastStoredNotification(notificationTable.value.data, json["id"]);
    let ref: StoredNotificationEntry;
    if (existing) {
      Object.assign(existing, json);
      existing.$isExpired = false;
      ref = existing;
    } else {
      ref = createDefaultNotificationRef(json);
    }
    ref.details = parseNotificationDetails(ref.details);
    return ref;
  }

  function applyNotificationV2(data: NotificationJson): StoredNotificationEntry {
    const json = sanitizeNotificationJson({ ...data });
    const existing = findStoredNotification(notificationTable.value.data, json["id"]);
    const ref: StoredNotificationEntry = existing ? Object.assign(existing, json) : { ...createDefaultNotificationV2Ref(json), created_at: "" };
    ref.created_at = ref.createdAt ?? "";
    if (hasBoopFields(ref)) {
      applyBoopLegacyHandling(ref, AppDebug.endpointDomain);
    }
    return ref;
  }

  function handleNotificationV2(args: NotificationArgs) {
    const ref = applyNotificationV2(args.json);
    if (ref.seen) {
      removeFromArray(unseenNotifications.value, ref.id);
    } else if (!unseenNotifications.value.includes(ref.id)) {
      unseenNotifications.value.push(ref.id);
    }
    const existingNotification = findStoredNotification(notificationTable.value.data, ref.id);
    if (existingNotification) {
      Object.assign(existingNotification, ref);
      database.addNotificationV2ToDatabase(existingNotification);
      return;
    }

    const isNotificationInitReady = !notificationInitStatus.value || !isNotificationsLoading.value;
    const isMatchingTypeFilter = notificationTable.value.filters[0].value.length === 0 || notificationTable.value.filters[0].value.includes(ref.type);
    if (isNotificationInitReady && isMatchingTypeFilter) {
      uiStore.notifyMenu("notification");
    }
    database.addNotificationV2ToDatabase(ref);
    notificationTable.value.data.push(ref);
    queueNotificationNoty(ref);
    void sharedFeedStore.addEntry(ref).catch(logError);
  }

  function handleNotificationV2Update(args: { params: { notificationId: string }; json: NotificationJson }) {
    const notificationId = args.params.notificationId;
    const json = { ...args.json };
    json["id"] = notificationId;
    handleNotificationV2({
      json,
      params: {
        notificationId,
      },
    });
    if (json["seen"]) {
      handleNotificationSee(notificationId);
    }
  }

  function handleNotificationV2Hide(notificationId: string) {
    database.expireNotificationV2(notificationId);
    const ref = notificationTable.value.data.find((n) => n.id === notificationId);
    if (ref) {
      ref.expiresAt = new Date().toJSON();
      ref.seen = true;
    }
  }

  function expireFriendRequestNotifications() {
    const array = notificationTable.value.data;
    for (let i = array.length - 1; i >= 0; i--) {
      if (array[i]?.type === "friendRequest" || array[i]?.type === "ignoredFriendRequest") {
        array.splice(i, 1);
      }
    }
  }

  function expireNotification(notificationId: string) {
    const ref = findLastStoredNotification(notificationTable.value.data, notificationId);
    if (typeof ref === "undefined") {
      return;
    }
    ref.$isExpired = true;
    database.updateNotificationExpired(ref);
    handleNotificationExpire({
      ref,
      params: {
        notificationId: ref.id,
      },
    });
  }

  let refreshNotificationsPromise: Promise<void> | null = null;
  let refreshNotificationsBlockedUntil = 0;

  function refreshNotifications(): Promise<void> {
    if (refreshNotificationsPromise) {
      return refreshNotificationsPromise;
    }
    if (Date.now() < refreshNotificationsBlockedUntil) {
      return Promise.resolve();
    }
    refreshNotificationsPromise = fetchAllNotifications().finally(() => {
      refreshNotificationsPromise = null;
    });
    return refreshNotificationsPromise;
  }

  async function fetchAllNotifications() {
    isNotificationsLoading.value = true;
    try {
      expireFriendRequestNotifications();
      await forEachNotificationPage(
        (params) => notificationRequest.getNotifications(params),
        (json) => {
          handleNotification({
            json,
            params: {
              notificationId: json.id,
            },
          });
        }
      );
      await forEachNotificationPage(
        (params) => notificationRequest.getNotificationsV2(params),
        (json) => {
          handleNotificationV2({
            json,
            params: {
              notificationId: json.id,
            },
          });
        }
      );
      await forEachNotificationPage(
        (params) => notificationRequest.getHiddenFriendRequests(params),
        (json) => {
          handleNotification({
            json: { ...json, type: "ignoredFriendRequest" },
            params: {
              notificationId: json.id,
            },
          });
        }
      );
    } catch (err) {
      console.error(err);
      if (hasStatus(err, 429)) {
        refreshNotificationsBlockedUntil = Date.now() + 120000;
      }
    } finally {
      isNotificationsLoading.value = false;
      notificationInitStatus.value = true;
    }
  }

  async function initNotifications() {
    notificationInitStatus.value = false;
    const v2Entries = toStoredNotifications(await database.getNotificationsV2());
    const legacyEntries = toStoredNotifications(await database.getNotifications());
    const tableData = v2Entries.concat(legacyEntries.filter((n) => !v2Entries.some((t) => t.id === n.id)));
    tableData.sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
    tableData.splice(readMaxTableSize(dbVars));
    notificationTable.value.data = tableData;
    void refreshNotifications().catch(logError);
  }

  function checkInventoryBundles() {
    return runInventoryBundleCheck(notificationsSettingsStore, shownBundleIds, inventoryBundleDialog);
  }

  function checkFreeStoreItems() {
    return runFreeStoreItemCheck(notificationsSettingsStore, userStore, shownFreeListingIds, freeStoreItemDialog);
  }

  function addFailedFreeListingIds(listingIds: string[]) {
    return addFailedFreeListingIdsFor(userStore.currentUser.id, listingIds);
  }

  function testNotification() {
    playNoty({
      type: "Event",
      created_at: new Date().toJSON(),
      data: t("view.settings.notifications.notifications.test_message"),
    });
  }

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
