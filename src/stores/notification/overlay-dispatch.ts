import { extractFileId, extractFileVersion } from "../../shared/utils/file-utils";
import { getNotificationMessage, toNotificationText } from "../../shared/utils/notification-message";

export function createOverlayDispatch({ getUserIdFromNoty, queryRequest, notificationsSettingsStore, advancedSettingsStore }) {
  async function notySaveImage(noty) {
    const imageUrl = await notyGetImage(noty);
    let fileId = extractFileId(imageUrl);
    let fileVersion = extractFileVersion(imageUrl);
    let imageLocation = "";
    try {
      if (fileId && fileVersion) {
        imageLocation = await AppApi.GetImage(imageUrl, fileId, fileVersion);
      } else if (imageUrl && imageUrl.startsWith("http")) {
        fileVersion = imageUrl.split("/").pop();
        fileId = fileVersion.split(".").shift();
        imageLocation = await AppApi.GetImage(imageUrl, fileId, fileVersion);
      }
    } catch (err) {
      console.error(imageUrl, err);
    }
    return imageLocation;
  }

  function displayDesktopToast(noty, message, image) {
    const result = getNotificationMessage(noty, message);
    if (result) {
      desktopNotification(result.title, result.body, image);
    }
  }

  function displayOverlayNotification(noty, message, imageFile) {
    let image = "";
    if (imageFile) {
      image = `file:///${imageFile}`;
    }
    AppApi.ExecuteVrOverlayFunction("playNoty", JSON.stringify({ noty, message, image }));
  }

  function displayXSNotification(noty, message, image) {
    const result = getNotificationMessage(noty, message);
    if (!result) return;
    const timeout = Math.floor(parseInt(notificationsSettingsStore.notificationTimeout.toString(), 10) / 1000);
    const opacity = parseFloat(advancedSettingsStore.notificationOpacity.toString()) / 100;
    const text = toNotificationText(result.title, result.body, noty.type);
    AppApi.XSNotification("VRCX", text, timeout, opacity, image);
  }

  function displayOvrtNotification(playOvrtHudNotifications, playOvrtWristNotifications, noty, message, image) {
    const result = getNotificationMessage(noty, message);
    if (!result) return;
    const timeout = Math.floor(parseInt(notificationsSettingsStore.notificationTimeout.toString(), 10) / 1000);
    const opacity = parseFloat(advancedSettingsStore.notificationOpacity.toString()) / 100;
    const text = toNotificationText(result.title, result.body, noty.type);
    AppApi.OVRTNotification(playOvrtHudNotifications, playOvrtWristNotifications, "VRCX", text, timeout, opacity, image);
  }

  async function notyGetImage(noty) {
    let imageUrl = "";
    const userId = getUserIdFromNoty(noty);

    if (noty.thumbnailImageUrl) {
      imageUrl = noty.thumbnailImageUrl;
    } else if (noty.details && noty.details.imageUrl) {
      imageUrl = noty.details.imageUrl;
    } else if (noty.imageUrl) {
      imageUrl = noty.imageUrl;
    } else if (userId && !userId.startsWith("grp_")) {
      imageUrl = await queryRequest
        .fetch("user", {
          userId,
        })
        .catch((err) => {
          console.error(err);
          return "";
        })
        .then((args) => {
          if (!args.json) {
            return "";
          }
          if (args.json.iconUrl) {
            return args.json.iconUrl;
          }
          if (args.json.profilePicOverride) {
            return args.json.profilePicOverride;
          }
          return args.json.currentAvatarThumbnailImageUrl;
        });
    }
    return imageUrl;
  }

  function desktopNotification(displayName, message, image) {
    if (isHostWindows) {
      AppApi.DesktopNotification(displayName, message, image);
    } else {
      window.electron.desktopNotification(displayName, message, image);
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
