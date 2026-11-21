import type { Ref } from "vue";
import type { ComposerTranslation } from "vue-i18n";
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
import { database, dbVars } from "../../services/database";
import { AppDebug } from "../../services/app-config";
import { configRepository } from "../../services/config";
import { handleFriendAdd } from "../../coordinators/friend-relationship-coordinator";
import type { useInstanceStore } from "../instance";
import type { useNotificationsSettingsStore } from "../settings/notifications";
import type { useSharedFeedStore } from "../shared-feed";
import type { useUiStore } from "../ui";
import type { useUserStore } from "../user";
import { hasStatus, logError } from "./errors";
import {
  isFriendRequestOutcome,
  isFriendRequestType,
  loadFriendRequestHistory,
  recordFriendRequest,
  restoreFriendRequestRecord,
} from "./friend-request-history";
import { type InviteReply, recordInviteReply } from "./invite-reply-history";
import {
  findLastStoredNotification,
  findStoredNotification,
  forEachNotificationPage,
  hasBoopFields,
  isStringArray,
  readMaxTableSize,
  toStoredNotifications,
} from "./helpers";
import {
  addFailedFreeListingIds as addFailedFreeListingIdsFor,
  checkFreeStoreItems as runFreeStoreItemCheck,
  checkInventoryBundles as runInventoryBundleCheck,
} from "./offer-checks";
import type { createNotyPlayback } from "./noty-playback";
import type {
  FreeStoreItemDialog,
  InventoryBundleDialog,
  NotificationArgs,
  NotificationEntry,
  NotificationJson,
  NotificationTable,
  StoredNotificationEntry,
} from "./types";

type NotificationHandlerDeps = {
  t: ComposerTranslation;
  notificationTable: Ref<NotificationTable>;
  unseenNotifications: Ref<string[]>;
  notificationInitStatus: Ref<boolean>;
  isNotificationsLoading: Ref<boolean>;
  isNotificationHistoryLoading: Ref<boolean>;
  inventoryBundleDialog: Ref<InventoryBundleDialog>;
  freeStoreItemDialog: Ref<FreeStoreItemDialog>;
  shownBundleIds: Set<string>;
  shownFreeListingIds: Set<string>;
  notificationsSettingsStore: ReturnType<typeof useNotificationsSettingsStore>;
  userStore: ReturnType<typeof useUserStore>;
  uiStore: ReturnType<typeof useUiStore>;
  instanceStore: ReturnType<typeof useInstanceStore>;
  sharedFeedStore: ReturnType<typeof useSharedFeedStore>;
  queueNotificationNoty: ReturnType<typeof createNotyPlayback>["queueNotificationNoty"];
  playNoty: ReturnType<typeof createNotyPlayback>["playNoty"];
};

export function createNotificationHandlers({
  t,
  notificationTable,
  unseenNotifications,
  notificationInitStatus,
  isNotificationsLoading,
  isNotificationHistoryLoading,
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
}: NotificationHandlerDeps) {
  let historySession = 0;
  let historyPromise: Promise<void> | null = null;
  let isHistoryLoaded = false;
  const knownIds = new Map<string, string | null>();
  const expiredIds = new Set<string>();
  const seenIds = new Set<string>();

  async function init() {
    const raw: unknown = JSON.parse(await configRepository.getString("VRCX_notificationTableFilters", "[]"));
    notificationTable.value.filters[0].value = isStringArray(raw) ? raw : [];
  }

  function handleNotification(args: NotificationArgs) {
    const ref = applyNotification(args.json);
    args.ref = ref;
    if (isFriendRequestType(ref.type) && ref.senderUserId !== userStore.currentUser.id) {
      void recordFriendRequest(ref, ref.type === "ignoredFriendRequest" ? "declined" : "").catch(logError);
    }
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
      const isNotificationInitReady = !knownIds.has(ref.id) && (!notificationInitStatus.value || !isNotificationsLoading.value);
      const isMatchingTypeFilter = notificationTable.value.filters[0].value.length === 0 || notificationTable.value.filters[0].value.includes(ref.type);

      if (!isExcludedType && !knownIds.has(ref.id)) {
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
    expiredIds.add(notificationId);
    const ref = findStoredNotification(notificationTable.value.data, notificationId);
    if (typeof ref === "undefined") {
      return;
    }
    if (isFriendRequestType(ref.type)) {
      ref.$isExpired = true;
      void recordFriendRequest(ref, "declined").catch(logError);
    } else if (ref.type.includes(".")) {
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

  function markFriendRequestAutoDeclined(notificationId: string) {
    const ref = findLastStoredNotification(notificationTable.value.data, notificationId);
    if (ref === undefined || !isFriendRequestType(ref.type)) {
      return;
    }
    void recordFriendRequest(ref, "autoDeclined").catch(logError);
  }

  function markInviteReplied(notificationId: string, reply: InviteReply, location: string, worldName: string) {
    const ref = findLastStoredNotification(notificationTable.value.data, notificationId);
    if (ref?.type !== "requestInvite") {
      return;
    }
    void recordInviteReply(ref, reply, location, worldName).catch(logError);
  }

  function appendNotificationTableEntry(entry: NotificationEntry) {
    notificationTable.value.data.push(entry);
  }

  function setNotificationInitStatus(isReady: boolean) {
    notificationInitStatus.value = isReady;
    if (!isReady) {
      historySession += 1;
      historyPromise = null;
      isNotificationHistoryLoading.value = false;
      isHistoryLoaded = false;
      knownIds.clear();
      expiredIds.clear();
      seenIds.clear();
    }
  }

  function clearUnseenNotifications() {
    unseenNotifications.value = [];
  }

  function handleNotificationSee(notificationId: string) {
    seenIds.add(notificationId);
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
    if (ref.type === "friendRequest") {
      void recordFriendRequest(ref, "accepted").catch(logError);
    }
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
      const outcome = knownIds.get(ref.id);
      if (isFriendRequestType(ref.type) && isFriendRequestOutcome(outcome)) {
        ref.$friendRequestOutcome = outcome;
      }
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

    const isNotificationInitReady = !knownIds.has(ref.id) && (!notificationInitStatus.value || !isNotificationsLoading.value);
    const isMatchingTypeFilter = notificationTable.value.filters[0].value.length === 0 || notificationTable.value.filters[0].value.includes(ref.type);
    if (isNotificationInitReady && isMatchingTypeFilter) {
      uiStore.notifyMenu("notification");
    }
    database.addNotificationV2ToDatabase(ref);
    notificationTable.value.data.push(ref);
    if (!knownIds.has(ref.id)) {
      queueNotificationNoty(ref);
      void sharedFeedStore.addEntry(ref).catch(logError);
    }
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
    expiredIds.add(notificationId);
    seenIds.add(notificationId);
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
      const entry = array[i];
      if (entry === undefined || !isFriendRequestType(entry.type)) {
        continue;
      }
      if (entry.$friendRequestOutcome === undefined) {
        array.splice(i, 1);
      } else {
        entry.$isExpired = true;
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
    const request = fetchAllNotifications().finally(() => {
      if (refreshNotificationsPromise === request) {
        refreshNotificationsPromise = null;
      }
    });
    refreshNotificationsPromise = request;
    return request;
  }

  async function readKnownNotifications<Row extends { id: string }>(call: Promise<{ json: Row[] }>, session: number): Promise<{ json: Row[] }> {
    const result = await call;
    for (const entry of await database.getNotificationHistoryState(result.json.map((row) => row.id))) {
      if (session === historySession) {
        knownIds.set(entry.id, entry.friendRequestOutcome);
      }
    }
    return result;
  }

  async function fetchAllNotifications() {
    const session = historySession;
    isNotificationsLoading.value = true;
    try {
      expireFriendRequestNotifications();
      await forEachNotificationPage(
        (params) => readKnownNotifications(notificationRequest.getNotifications(params), session),
        (json) => {
          if (session !== historySession) {
            return;
          }
          handleNotification({
            json,
            params: {
              notificationId: json.id,
            },
          });
        }
      );
      await forEachNotificationPage(
        (params) => readKnownNotifications(notificationRequest.getNotificationsV2(params), session),
        (json) => {
          if (session !== historySession) {
            return;
          }
          handleNotificationV2({
            json,
            params: {
              notificationId: json.id,
            },
          });
        }
      );
      await forEachNotificationPage(
        (params) => readKnownNotifications(notificationRequest.getHiddenFriendRequests(params), session),
        (json) => {
          if (session !== historySession) {
            return;
          }
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
      if (session === historySession) {
        isNotificationsLoading.value = false;
        notificationInitStatus.value = true;
      }
    }
  }

  async function initNotifications(): Promise<void> {
    setNotificationInitStatus(false);
    refreshNotificationsPromise = null;
    await refreshNotifications();
  }

  function loadNotificationHistory(): Promise<void> {
    if (isHistoryLoaded) {
      return Promise.resolve();
    }
    if (historyPromise !== null) {
      return historyPromise;
    }
    isNotificationHistoryLoading.value = true;
    const request = readNotificationHistory().finally(() => {
      if (historyPromise === request) {
        historyPromise = null;
        isNotificationHistoryLoading.value = false;
      }
    });
    historyPromise = request;
    return request;
  }

  async function readNotificationHistory(): Promise<void> {
    const session = historySession;
    const v2Entries = toStoredNotifications(await database.getNotificationsV2());
    const legacyEntries = toStoredNotifications(await database.getNotifications()).map(restoreFriendRequestRecord);
    const v2Ids = new Set(v2Entries.map((entry) => entry.id));
    const tableData = [...v2Entries, ...legacyEntries.filter((entry) => !v2Ids.has(entry.id))];
    tableData.sort((left, right) => Date.parse(right.created_at) - Date.parse(left.created_at));
    tableData.splice(readMaxTableSize(dbVars));
    const shownIds = new Set(tableData.map((entry) => entry.id));
    for (const entry of await loadFriendRequestHistory()) {
      if (!shownIds.has(entry.id)) {
        tableData.push(entry);
      }
    }
    if (session !== historySession) {
      return;
    }
    const live = notificationTable.value.data;
    const liveIds = new Set(live.flatMap((entry) => (entry.id ? [entry.id] : [])));
    const restored = tableData.filter((entry) => !liveIds.has(entry.id));
    for (const entry of restored) {
      if (expiredIds.has(entry.id)) {
        entry.$isExpired = true;
        if (entry.version === 2) {
          entry.expiresAt = new Date().toJSON();
          entry.seen = true;
        }
      }
      if (seenIds.has(entry.id)) {
        entry.seen = true;
      }
    }
    notificationTable.value.data = [...live, ...restored];
    isHistoryLoaded = true;
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
    init,
    initNotifications,
    loadNotificationHistory,
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
    markFriendRequestAutoDeclined,
    markInviteReplied,
    testNotification,
    appendNotificationTableEntry,
    setNotificationInitStatus,
    clearUnseenNotifications,
  };
}
