import type { useFriendStore } from "../friend";
import type { useGameStore } from "../game";
import type { useLocationStore } from "../location";
import type { useNotificationsSettingsStore } from "../settings/notifications";
import type { useWristOverlaySettingsStore } from "../settings/wrist-overlay";
import type { useUserStore } from "../user";
import { asNotificationRecord, type createOverlayDispatch } from "./overlay-dispatch";
import type { NotyEntry } from "./types";
import { getUserMemo } from "../../coordinators/memo-coordinator";
import { watchState } from "../../services/watch-state";
import { getNotificationMessage, getUserIdFromNoty as getUserIdFromNotyBase, toNotificationText } from "../../shared/utils/notification-message";
import { findUserByDisplayName } from "../../shared/utils/user";
import { logError } from "./errors";

type UserStore = ReturnType<typeof useUserStore>;
type FriendStore = ReturnType<typeof useFriendStore>;
type GameStore = ReturnType<typeof useGameStore>;
type LocationStore = ReturnType<typeof useLocationStore>;
type NotificationsSettingsStore = ReturnType<typeof useNotificationsSettingsStore>;
type WristOverlaySettingsStore = ReturnType<typeof useWristOverlaySettingsStore>;
type OverlayDispatch = ReturnType<typeof createOverlayDispatch>;

export type NotyPlaybackDeps = {
  userStore: UserStore;
  friendStore: FriendStore;
  gameStore: GameStore;
  locationStore: LocationStore;
  notificationsSettingsStore: NotificationsSettingsStore;
  wristOverlaySettingsStore: WristOverlaySettingsStore;
  overlay: OverlayDispatch;
};

const MESSAGE_KEYS = ["inviteMessage", "requestMessage", "responseMessage"];

function userIdOf(user: unknown): string | undefined {
  return typeof user === "object" && user !== null && "id" in user && typeof user.id === "string" ? user.id : undefined;
}

function detailText(value: unknown): string | undefined {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return undefined;
}

export function resolveNotyUserId(noty: NotyEntry, userStore: UserStore): string {
  const id = getUserIdFromNotyBase(asNotificationRecord(noty));
  if (id) return id;
  if (noty.displayName) {
    return userIdOf(findUserByDisplayName(userStore.cachedUsers, noty.displayName, userStore.cachedUserIdsByDisplayName)) ?? "";
  }
  return "";
}

export function createNotyPlayback(deps: NotyPlaybackDeps) {
  const { userStore, friendStore, gameStore, locationStore, notificationsSettingsStore, wristOverlaySettingsStore, overlay } = deps;
  const notyMap = new Map<string, string>();

  async function playNotyTTS(noty: NotyEntry, displayName: string, message: string) {
    let speakName = displayName;
    if (notificationsSettingsStore.notificationTTSNickName) {
      const userId = resolveNotyUserId(noty, userStore);
      const memo = await getUserMemo(userId);
      if (memo.memo) {
        const array = memo.memo.split("\n");
        const nickName = array[0];
        speakName = nickName ?? "";
      }
    }
    const msg = getNotificationMessage(asNotificationRecord(noty), message, speakName);
    if (msg) {
      const text = toNotificationText(msg.title, msg.body, noty.type);
      if (text) {
        notificationsSettingsStore.speak(text);
      }
    }
  }

  function playNoty(noty: NotyEntry) {
    if (userStore.currentUser.status === "busy" || !watchState.isFriendsLoaded) {
      return;
    }
    let displayName = "";
    if (noty.type === "DisplayName" && noty.previousDisplayName) {
      displayName = noty.previousDisplayName;
    } else if (noty.displayName) {
      displayName = noty.displayName;
    } else if (noty.senderUsername) {
      displayName = noty.senderUsername;
    } else if (noty.sourceDisplayName) {
      displayName = noty.sourceDisplayName;
    }
    if (displayName) {
      const notyId = `${noty.type},${displayName}`;
      const previous = notyMap.get(notyId);
      if (previous && previous >= noty.created_at) {
        return;
      }
      notyMap.set(notyId, noty.created_at);
    }
    const bias = new Date(Date.now() - 60000).toJSON();
    for (const [notyId, createdAt] of notyMap) {
      if (createdAt < bias) {
        notyMap.delete(notyId);
      }
    }
    if (noty.created_at < bias) {
      return;
    }

    const notiConditions = new Map<string, () => boolean>([
      ["Always", () => true],
      ["Inside VR", () => gameStore.isSteamVRRunning],
      ["Outside VR", () => !gameStore.isSteamVRRunning],
      ["Game Closed", () => !gameStore.isGameRunning],
      ["Game Running", () => gameStore.isGameRunning],
      ["Desktop Mode", () => gameStore.isGameNoVR === true && gameStore.isGameRunning],
      ["AFK", () => notificationsSettingsStore.afkDesktopToast && gameStore.isHmdAfk && gameStore.isGameRunning && gameStore.isGameNoVR !== true],
    ]);
    const isConditionMet = (key: string) => notiConditions.get(key)?.() === true;

    const shouldPlayNotificationTTS = isConditionMet(notificationsSettingsStore.notificationTTS);
    const shouldPlayDesktopToast = isConditionMet(notificationsSettingsStore.desktopToast) || isConditionMet("AFK");

    const shouldPlayOverlayToast = isConditionMet(notificationsSettingsStore.overlayToast);
    const shouldPlayOverlayNotification = notificationsSettingsStore.overlayNotifications && shouldPlayOverlayToast;
    const shouldPlayXSNotification = notificationsSettingsStore.xsNotifications && shouldPlayOverlayToast;
    const shouldPlayOvrtHudNotifications = notificationsSettingsStore.ovrtHudNotifications && shouldPlayOverlayToast;
    const shouldPlayOvrtWristNotifications = notificationsSettingsStore.ovrtWristNotifications && shouldPlayOverlayToast;

    let message = "";
    if (noty.title) {
      message = `${noty.title}, ${noty.message}`;
    } else if (noty.message) {
      message = noty.message;
    }
    for (const key of MESSAGE_KEYS) {
      const detail = detailText(noty.details?.[key]);
      if (detail !== undefined) {
        message = `, ${detail}`;
      }
    }
    if (shouldPlayNotificationTTS) {
      void playNotyTTS(noty, displayName, message).catch(logError);
    }
    if (
      shouldPlayDesktopToast ||
      shouldPlayXSNotification ||
      shouldPlayOvrtHudNotifications ||
      shouldPlayOvrtWristNotifications ||
      shouldPlayOverlayNotification
    ) {
      if (notificationsSettingsStore.imageNotifications) {
        void overlay
          .notySaveImage(noty)
          .then((image: string) => {
            if (shouldPlayXSNotification) {
              overlay.displayXSNotification(noty, message, image);
            }
            if (shouldPlayOvrtHudNotifications || shouldPlayOvrtWristNotifications) {
              overlay.displayOvrtNotification(shouldPlayOvrtHudNotifications, shouldPlayOvrtWristNotifications, noty, message, image);
            }
            if (shouldPlayDesktopToast) {
              overlay.displayDesktopToast(noty, message, image);
            }
            if (shouldPlayOverlayNotification) {
              overlay.displayOverlayNotification(noty, message, image);
            }
          })
          .catch(logError);
      } else {
        if (shouldPlayXSNotification) {
          overlay.displayXSNotification(noty, message, "");
        }
        if (shouldPlayOvrtHudNotifications || shouldPlayOvrtWristNotifications) {
          overlay.displayOvrtNotification(shouldPlayOvrtHudNotifications, shouldPlayOvrtWristNotifications, noty, message, "");
        }
        if (shouldPlayDesktopToast) {
          overlay.displayDesktopToast(noty, message, "");
        }
        if (shouldPlayOverlayNotification) {
          overlay.displayOverlayNotification(noty, message, "");
        }
      }
    }
  }

  function notyFilterMode(noty: NotyEntry): string | undefined {
    const notyFilter: Record<string, string | undefined> = notificationsSettingsStore.sharedFeedFilters.noty;
    return notyFilter[noty.type];
  }

  function queueNotificationNoty(noty: NotyEntry) {
    noty.isFriend = friendStore.friends.has(noty.senderUserId ?? "");
    noty.isFavorite = friendStore.localFavoriteFriends.has(noty.senderUserId ?? "");
    const mode = notyFilterMode(noty);
    if (mode && (mode === "On" || mode === "Friends" || (mode === "VIP" && noty.isFavorite))) {
      playNoty(noty);
    }
  }

  function queueGameLogNoty(gamelog: NotyEntry) {
    const noty = structuredClone(gamelog);

    if (noty.type === "OnPlayerJoined") {
      const bias = (locationStore.lastLocation.date ?? 0) + 30 * 1000;
      if (Date.parse(noty.created_at) <= bias) {
        return;
      }
    }
    if (noty.type === "OnPlayerLeft" || noty.type === "BlockedOnPlayerLeft" || noty.type === "MutedOnPlayerLeft") {
      const bias = locationStore.lastLocationDestinationTime + 5 * 1000;
      if (Date.parse(noty.created_at) <= bias) {
        return;
      }
    }
    if (noty.type === "Notification" || noty.type === "LocationDestination") {
      return;
    }
    if (noty.type === "VideoPlay") {
      if (!noty.videoName) {
        return;
      }
      noty.notyName = noty.videoName;
      if (noty.displayName) {
        noty.notyName = `${noty.videoName} (${noty.displayName})`;
      }
    }
    if (noty.type !== "VideoPlay" && noty.displayName === userStore.currentUser.displayName) {
      return;
    }
    noty.isFriend = false;
    noty.isFavorite = false;
    if (noty.userId) {
      noty.isFriend = friendStore.friends.has(noty.userId);
      noty.isFavorite = friendStore.localFavoriteFriends.has(noty.userId);
    } else if (noty.displayName) {
      const refId = userIdOf(findUserByDisplayName(userStore.cachedUsers, noty.displayName, userStore.cachedUserIdsByDisplayName));
      if (refId !== undefined) {
        noty.isFriend = friendStore.friends.has(refId);
        noty.isFavorite = friendStore.localFavoriteFriends.has(refId);
      }
    }
    const mode = notyFilterMode(noty);
    if (mode && (mode === "On" || mode === "Everyone" || (mode === "Friends" && noty.isFriend) || (mode === "VIP" && noty.isFavorite))) {
      playNoty(noty);
    }
  }

  function queueFeedNoty(feed: NotyEntry) {
    const noty = { ...feed };
    if (noty.type === "Avatar") {
      return;
    }

    if (wristOverlaySettingsStore.hidePrivateFromFeed && noty.type === "GPS" && noty.location === "private") {
      return;
    }
    noty.isFriend = friendStore.friends.has(noty.userId ?? "");
    noty.isFavorite = friendStore.localFavoriteFriends.has(noty.userId ?? "");
    const mode = notyFilterMode(noty);
    if (mode && (mode === "Everyone" || (mode === "Friends" && noty.isFriend) || (mode === "VIP" && noty.isFavorite))) {
      playNoty(noty);
    }
  }

  function queueFriendLogNoty(noty: NotyEntry) {
    if (noty.type === "FriendRequest") {
      return;
    }
    noty.isFriend = friendStore.friends.has(noty.userId ?? "");
    noty.isFavorite = friendStore.localFavoriteFriends.has(noty.userId ?? "");
    const mode = notyFilterMode(noty);
    if (mode && (mode === "On" || mode === "Friends" || (mode === "VIP" && noty.isFavorite))) {
      playNoty(noty);
    }
  }

  function queueModerationNoty(noty: NotyEntry) {
    noty.isFriend = false;
    noty.isFavorite = false;
    if (noty.userId) {
      noty.isFriend = friendStore.friends.has(noty.userId);
      noty.isFavorite = friendStore.localFavoriteFriends.has(noty.userId);
    }
    if (notyFilterMode(noty) === "On") {
      playNoty(noty);
    }
  }

  return {
    playNoty,
    queueNotificationNoty,
    queueGameLogNoty,
    queueFeedNoty,
    queueFriendLogNoty,
    queueModerationNoty,
  };
}
