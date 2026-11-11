import { extractFileId, extractFileVersion } from "../../shared/utils/file-utils";
import { getNotificationMessage, toNotificationText } from "../../shared/utils/notification-message";
import type { useAdvancedSettingsStore } from "../settings/advanced";
import type { useNotificationsSettingsStore } from "../settings/notifications";
import { logFailure } from "../log-failure";
import type { NotificationRecord } from "../../types/notification.ts";
import type { NotyEntry } from "./types";

type OverlayNoty = NotyEntry & {
  thumbnailImageUrl?: string;
  imageUrl?: string;
};

export function asNotificationRecord(noty: OverlayNoty): NotificationRecord {
  return {
    ...noty,
    displayName: noty.displayName ?? undefined,
    previousDisplayName: noty.previousDisplayName ?? undefined,
    senderUsername: noty.senderUsername ?? undefined,
    senderUserId: noty.senderUserId ?? undefined,
    userId: noty.userId ?? undefined,
    location: noty.location ?? undefined,
    title: noty.title ?? undefined,
    message: noty.message ?? undefined,
    notyName: noty.notyName ?? undefined,
    data: typeof noty.data === "string" ? noty.data : undefined,
  };
}

type UserImageArgs = {
  json?:
    | {
        iconUrl?: string;
        profilePicOverride?: string;
        currentAvatarThumbnailImageUrl?: string;
      }
    | null
    | undefined;
};

function firstNonEmpty(...values: (string | undefined)[]) {
  return values.find((value) => value) ?? "";
}

type OverlayDispatchDeps = {
  getUserIdFromNoty: (noty: NotyEntry) => string;
  queryRequest: { fetch: (endpoint: "user", params: { userId: string }) => Promise<UserImageArgs | undefined> };
  notificationsSettingsStore: Pick<ReturnType<typeof useNotificationsSettingsStore>, "notificationTimeout">;
  advancedSettingsStore: Pick<ReturnType<typeof useAdvancedSettingsStore>, "notificationOpacity">;
};

export function createOverlayDispatch({ getUserIdFromNoty, queryRequest, notificationsSettingsStore, advancedSettingsStore }: OverlayDispatchDeps) {
  function notificationTimeoutSeconds() {
    return Math.floor(notificationsSettingsStore.notificationTimeout / 1000);
  }

  function notificationOpacityFraction() {
    return advancedSettingsStore.notificationOpacity / 100;
  }

  async function notySaveImage(noty: OverlayNoty): Promise<string> {
    const imageUrl = await notyGetImage(noty);
    let fileId = extractFileId(imageUrl);
    let fileVersion = extractFileVersion(imageUrl);
    let imageLocation = "";
    try {
      if (fileId && fileVersion) {
        imageLocation = await AppApi.GetImage(imageUrl, fileId, fileVersion);
      } else if (imageUrl.startsWith("http")) {
        const fileName = imageUrl.split("/").pop() ?? "";
        fileVersion = fileName;
        fileId = fileName.split(".")[0] ?? "";
        imageLocation = await AppApi.GetImage(imageUrl, fileId, fileVersion);
      }
    } catch (err) {
      console.error(imageUrl, err);
    }
    return imageLocation;
  }

  function displayDesktopToast(noty: OverlayNoty, message: string | undefined, image: string) {
    const result = getNotificationMessage(asNotificationRecord(noty), message);
    if (result) {
      desktopNotification(result.title ?? "", result.body, image);
    }
  }

  function displayOverlayNotification(noty: OverlayNoty, message: string | undefined, imageFile: string) {
    let image = "";
    if (imageFile) {
      image = `file:///${imageFile}`;
    }
    AppApi.ExecuteVrOverlayFunction("playNoty", JSON.stringify({ noty, message, image })).catch(logFailure("Sending the overlay notification failed:"));
  }

  function displayXSNotification(noty: OverlayNoty, message: string | undefined, image: string) {
    const result = getNotificationMessage(asNotificationRecord(noty), message);
    if (!result) return;
    const text = toNotificationText(result.title, result.body, noty.type) ?? "";
    Promise.resolve(AppApi.XSNotification("VRCX", text, notificationTimeoutSeconds(), notificationOpacityFraction(), image)).catch(
      logFailure("Sending the XSOverlay notification failed:")
    );
  }

  function displayOvrtNotification(
    isPlayOvrtHudNotifications: boolean,
    isPlayOvrtWristNotifications: boolean,
    noty: OverlayNoty,
    message: string | undefined,
    image: string
  ) {
    const result = getNotificationMessage(asNotificationRecord(noty), message);
    if (!result) return;
    const text = toNotificationText(result.title, result.body, noty.type) ?? "";
    AppApi.OVRTNotification(
      isPlayOvrtHudNotifications,
      isPlayOvrtWristNotifications,
      "VRCX",
      text,
      notificationTimeoutSeconds(),
      notificationOpacityFraction(),
      image
    ).catch(logFailure("Sending the OVRT notification failed:"));
  }

  async function notyGetImage(noty: OverlayNoty): Promise<string> {
    let imageUrl = "";
    const userId = getUserIdFromNoty(noty);
    const detailsImageUrl = noty.details?.["imageUrl"];

    if (noty.thumbnailImageUrl) {
      imageUrl = noty.thumbnailImageUrl;
    } else if (typeof detailsImageUrl === "string" && detailsImageUrl) {
      imageUrl = detailsImageUrl;
    } else if (noty.imageUrl) {
      imageUrl = noty.imageUrl;
    } else if (userId && !userId.startsWith("grp_")) {
      imageUrl = await queryRequest
        .fetch("user", {
          userId,
        })
        .catch((err: unknown) => {
          console.error(err);
          return undefined;
        })
        .then((args: UserImageArgs | undefined) => {
          const json = args?.json;
          if (!json) {
            return "";
          }
          return firstNonEmpty(json.iconUrl, json.profilePicOverride, json.currentAvatarThumbnailImageUrl);
        });
    }
    return imageUrl;
  }

  function desktopNotification(displayName: string, message: string | undefined, image: string | undefined) {
    if (isHostWindows) {
      Promise.resolve(AppApi.DesktopNotification(displayName, message, image)).catch(logFailure("Sending the desktop notification failed:"));
    } else {
      window.electron.desktopNotification(displayName, message, image).catch(logFailure("Sending the desktop notification failed:"));
    }
  }

  return {
    notySaveImage,
    displayDesktopToast,
    displayOverlayNotification,
    displayXSNotification,
    displayOvrtNotification,
    notyGetImage,
    desktopNotification,
  };
}
