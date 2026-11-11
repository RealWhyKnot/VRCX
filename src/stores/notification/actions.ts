import type { Ref } from "vue";
import type { useI18n } from "vue-i18n";
import { toast } from "vue-sonner";
import type { useLocationStore } from "../location";
import type { useModalStore } from "../modal";
import type { useUserStore } from "../user";
import type { NotificationEntry, NotificationResponse, NotificationTable } from "./types";
import { database } from "../../services/database";
import { friendRequest } from "../../api/friend";
import { notificationRequest } from "../../api/notification";
import { queryRequest } from "../../api/query-request";
import { parseLocation } from "../../shared/utils/location-parser";
import { hasStatus, logError } from "./errors";
import { isStoredNotification } from "./helpers";

type Translate = ReturnType<typeof useI18n>["t"];
type ModalStore = ReturnType<typeof useModalStore>;
type LocationStore = ReturnType<typeof useLocationStore>;
type UserStore = ReturnType<typeof useUserStore>;

export type NotificationActionsDeps = {
  t: Translate;
  modalStore: ModalStore;
  locationStore: LocationStore;
  userStore: UserStore;
  notificationTable: Ref<NotificationTable>;
  handleNotificationAccept: (args: { params: { notificationId: string }; ref?: NotificationEntry }) => void;
  handleNotificationHide: (notificationId: string) => void;
  handleNotificationV2Hide: (notificationId: string) => void;
};

function isConfirmed(result: unknown): boolean {
  return typeof result === "object" && result !== null && "ok" in result && result.ok === true;
}

export function createNotificationActions(deps: NotificationActionsDeps) {
  const { t, modalStore, locationStore, userStore, notificationTable, handleNotificationAccept, handleNotificationHide, handleNotificationV2Hide } = deps;

  function confirmAction(options: { description: string; title: string }): Promise<boolean> {
    return modalStore.confirm(options).then((result: unknown) => isConfirmed(result));
  }

  function acceptFriendRequestNotification(row: NotificationEntry) {
    if (!isStoredNotification(row)) return;
    void confirmAction({
      description: t("confirm.accept_friend_request"),
      title: t("confirm.title"),
    })
      .then((isOk) => {
        if (!isOk) return;
        void notificationRequest
          .acceptFriendRequestNotification({
            notificationId: row.id,
          })
          .then((args) => {
            handleNotificationAccept(args);
          })
          .catch((err: unknown) => {
            if (hasStatus(err, 404)) {
              handleNotificationHide(row.id);
            }
          });
      })
      .catch(logError);
  }

  async function hideNotification(row: NotificationEntry) {
    if (!isStoredNotification(row)) return;
    if (row.type === "ignoredFriendRequest") {
      if (row.senderUserId === undefined) return;
      await friendRequest.deleteHiddenFriendRequest({ notificationId: row.id }, row.senderUserId);
      handleNotificationHide(row.id);
    } else {
      void notificationRequest
        .hideNotification({
          notificationId: row.id,
        })
        .then(() => {
          handleNotificationHide(row.id);
        })
        .catch(logError);
    }
  }

  function hideNotificationPrompt(row: NotificationEntry) {
    void confirmAction({
      description: t("confirm.decline_type", { type: row.type }),
      title: t("confirm.title"),
    })
      .then((isOk) => {
        if (isOk) void hideNotification(row).catch(logError);
      })
      .catch(logError);
  }

  function acceptRequestInvite(row: NotificationEntry) {
    if (!isStoredNotification(row)) return;
    const senderUserId = row.senderUserId;
    if (senderUserId === undefined) return;
    void confirmAction({
      description: t("confirm.send_invite"),
      title: t("confirm.title"),
    })
      .then((isOk) => {
        if (!isOk) return;
        let currentLocation = locationStore.lastLocation.location;
        if (locationStore.lastLocation.location === "traveling") {
          currentLocation = locationStore.lastLocationDestination;
        }
        if (!currentLocation) {
          currentLocation = userStore.currentUser.$locationTag;
        }
        const L = parseLocation(currentLocation);
        void queryRequest
          .fetch("world", { worldId: L.worldId })
          .then((args) => {
            void notificationRequest
              .sendInvite(
                {
                  instanceId: L.tag,
                  worldId: L.tag,
                  worldName: args.ref.name,
                  rsvp: true,
                },
                senderUserId
              )
              .then(() => {
                toast(t("message.invite.sent"));
                void notificationRequest
                  .hideNotification({
                    notificationId: row.id,
                  })
                  .then(() => {
                    handleNotificationHide(row.id);
                  })
                  .catch(logError);
              })
              .catch(logError);
          })
          .catch(logError);
      })
      .catch(logError);
  }

  function sendNotificationResponse(notificationId: string, responses: NotificationResponse[], responseType: string) {
    if (!Array.isArray(responses) || responses.length === 0) return;
    const responseData = responses.find((response) => response.type === responseType)?.data ?? "";
    const params = { notificationId, responseType, responseData };
    void notificationRequest
      .sendNotificationResponse(params)
      .then((args) => {
        console.log("Notification response", args);
        if (!args.json) return;
        handleNotificationV2Hide(notificationId);
        toast.success(args.json);
      })
      .catch(() => {
        handleNotificationV2Hide(notificationId);
        void notificationRequest.hideNotificationV2(notificationId).catch(logError);
      });
  }

  function deleteNotificationLog(row: NotificationEntry) {
    const idx = notificationTable.value.data.findIndex((e) => e.id === row.id);
    if (idx !== -1) {
      notificationTable.value.data.splice(idx, 1);
    }
    if (!isStoredNotification(row)) return;
    if (row.type !== "friendRequest" && row.type !== "ignoredFriendRequest") {
      if (!row.version || row.version < 2) {
        database.deleteNotification(row.id);
      } else {
        database.deleteNotificationV2(row.id);
      }
    }
  }

  function deleteNotificationLogPrompt(row: NotificationEntry) {
    void confirmAction({
      description: t("confirm.delete_type", { type: row.type }),
      title: t("confirm.title"),
    })
      .then((isOk) => {
        if (isOk) deleteNotificationLog(row);
      })
      .catch(logError);
  }

  return {
    acceptFriendRequestNotification,
    hideNotification,
    hideNotificationPrompt,
    acceptRequestInvite,
    sendNotificationResponse,
    deleteNotificationLog,
    deleteNotificationLogPrompt,
  };
}
