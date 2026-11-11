import { HueToHex } from "./base/ui";
import { convertFileUrlToImageUrl } from "./common";
import { languageMappings } from "../constants/language";

const THEME_COLOR_LIMITS = Object.freeze({
  darkMinLuminance: 0.06,
  lightMaxLuminance: 0.74,
});

function userOnlineForTimestamp(ctx) {
  if (ctx.ref.state === "online" && ctx.ref.$online_for) {
    return new Date(ctx.ref.$online_for).toJSON();
  } else if (ctx.ref.state === "active" && ctx.ref.$active_for) {
    return new Date(ctx.ref.$active_for).toJSON();
  } else if (ctx.ref.$offline_for) {
    return new Date(ctx.ref.$offline_for).toJSON();
  }
  return null;
}

function languageClass(language) {
  const style = {};
  const mapping = languageMappings[language];
  if (typeof mapping !== "undefined") {
    style[mapping] = true;
  } else {
    style.unknown = true;
  }
  return style;
}

async function getNameColour(userId, isDarkMode) {
  const hue = await AppApi.GetColourFromUserID(userId);
  return HueToHex(hue, isDarkMode);
}

function normalizeProfileHex(value) {
  const hex = String(value || "")
    .trim()
    .replace(/^#/, "")
    .toLowerCase();
  if (!/^[0-9a-f]{6}$/.test(hex)) {
    return null;
  }
  return `#${hex}`;
}

function hexToRgb(hex) {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!match) {
    return null;
  }
  const value = match[1];
  return {
    r: parseInt(value.slice(0, 2), 16),
    g: parseInt(value.slice(2, 4), 16),
    b: parseInt(value.slice(4, 6), 16),
  };
}

function rgbToHex(rgb) {
  const toHex = (value) => {
    const n = Math.max(0, Math.min(255, Math.round(value)));
    return n.toString(16).padStart(2, "0");
  };
  return `#${toHex(rgb.r)}${toHex(rgb.g)}${toHex(rgb.b)}`;
}

function getRelativeLuminance(rgb) {
  const channel = (value) => {
    const normalized = value / 255;
    if (normalized <= 0.03928) {
      return normalized / 12.92;
    }
    return ((normalized + 0.055) / 1.055) ** 2.4;
  };
  const r = channel(rgb.r);
  const g = channel(rgb.g);
  const b = channel(rgb.b);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function mixRgb(from, to, weight) {
  return {
    r: from.r + (to.r - from.r) * weight,
    g: from.g + (to.g - from.g) * weight,
    b: from.b + (to.b - from.b) * weight,
  };
}

function getReadableProfileThemeColor(colorValue, fallback, isDarkMode) {
  const normalized = normalizeProfileHex(colorValue);
  if (!normalized) {
    return fallback;
  }
  let rgb = hexToRgb(normalized);
  if (!rgb) {
    return fallback;
  }

  const luminanceThreshold = isDarkMode ? THEME_COLOR_LIMITS.darkMinLuminance : THEME_COLOR_LIMITS.lightMaxLuminance;
  let luminance = getRelativeLuminance(rgb);
  const requiresAdjustment = isDarkMode ? luminance < luminanceThreshold : luminance > luminanceThreshold;
  if (!requiresAdjustment) {
    return normalized;
  }

  const targetRgb = isDarkMode ? { r: 255, g: 255, b: 255 } : { r: 0, g: 0, b: 0 };
  for (let i = 0; i < 14; i++) {
    rgb = mixRgb(rgb, targetRgb, 0.18);
    luminance = getRelativeLuminance(rgb);
    if ((isDarkMode && luminance >= luminanceThreshold) || (!isDarkMode && luminance <= luminanceThreshold)) {
      break;
    }
  }
  return rgbToHex(rgb);
}

function invertHexColor(colorValue) {
  const normalized = normalizeProfileHex(colorValue);
  if (!normalized) {
    return colorValue;
  }
  const rgb = hexToRgb(normalized);
  if (!rgb) {
    return colorValue;
  }
  const invertedRgb = {
    r: 255 - rgb.r,
    g: 255 - rgb.g,
    b: 255 - rgb.b,
  };
  return rgbToHex(invertedRgb);
}

function userStatusClass(user, pendingOffline = false, currentUser) {
  const style = {
    "status-icon": true,
  };
  if (typeof user === "undefined") {
    return null;
  }
  let id = "";
  if (user.id) {
    id = user.id;
  } else if (user.userId) {
    id = user.userId;
  }
  if (id === currentUser?.id) {
    const platform = currentUser.presence?.platform;
    return {
      ...style,
      ...statusClass(user.status),
      mobile: platform && platform !== "standalonewindows" && platform !== "web",
    };
  }
  if (!user.isFriend) {
    return null;
  }
  if (pendingOffline) {
    style.offline = true;
  } else if (user.status !== "active" && user.location === "private" && user.state === "" && id && !(currentUser?.onlineFriends || []).includes(id)) {
    if ((currentUser?.activeFriends || []).includes(id)) {
      if (user.status === "join me") {
        style["active-joinme"] = true;
      } else if (user.status === "ask me") {
        style["active-askme"] = true;
      } else if (user.status === "busy") {
        style["active-busy"] = true;
      } else {
        style.active = true;
      }
    } else {
      style.offline = true;
    }
  } else if (user.state === "active") {
    if (user.status === "join me") {
      style["active-joinme"] = true;
    } else if (user.status === "ask me") {
      style["active-askme"] = true;
    } else if (user.status === "busy") {
      style["active-busy"] = true;
    } else {
      style.active = true;
    }
  } else if (user.location === "offline") {
    style.offline = true;
  } else if (user.status === "active") {
    style.online = true;
  } else if (user.status === "join me") {
    style.joinme = true;
  } else if (user.status === "ask me") {
    style.askme = true;
  } else if (user.status === "busy") {
    style.busy = true;
  } else {
    return null;
  }
  if (user.$platform && user.$platform !== "standalonewindows" && user.$platform !== "web" && user.state === "online") {
    style.mobile = true;
  }
  return style;
}

function statusClass(status) {
  if (typeof status === "undefined") {
    return null;
  }
  const style = {
    "status-icon": true,
  };
  if (status === "active") {
    style.online = true;
  } else if (status === "join me") {
    style.joinme = true;
  } else if (status === "ask me") {
    style.askme = true;
  } else if (status === "busy") {
    style.busy = true;
  } else {
    return null;
  }
  return style;
}

function userImage(user, isIcon = false, resolution = "128") {
  if (!user) {
    return "";
  }
  if (user.iconUrl) {
    if (isIcon) {
      return convertFileUrlToImageUrl(user.iconUrl);
    }
    return user.iconUrl;
  }
  if (user.thumbnailUrl) {
    return user.thumbnailUrl;
  }
  if (user.currentAvatarThumbnailImageUrl) {
    if (isIcon) {
      return user.currentAvatarThumbnailImageUrl.replace("/256", `/${resolution}`);
    }
    return user.currentAvatarThumbnailImageUrl;
  }
  if (user.currentAvatarImageUrl) {
    if (isIcon) {
      return convertFileUrlToImageUrl(user.currentAvatarImageUrl);
    }
    return user.currentAvatarImageUrl;
  }
  return "";
}

function userImageFull(user) {
  if (!user) {
    return "";
  }
  if (user.iconUrl) {
    return user.iconUrl;
  }
  if (user.profilePicOverride) {
    return user.profilePicOverride;
  }
  return user.currentAvatarImageUrl;
}

function parseUserUrl(user) {
  const url = new URL(user);
  const urlPath = url.pathname;
  if (urlPath.substring(5, 11) === "/user/") {
    const userId = urlPath.substring(11);
    return userId;
  }
}

function findUserByDisplayName(cachedUsers, displayName, cachedUserIdsByDisplayName) {
  const indexedUserIds = cachedUserIdsByDisplayName?.get(displayName);
  if (indexedUserIds) {
    for (const userId of indexedUserIds) {
      const ref = cachedUsers.get(userId);
      if (ref?.displayName === displayName) {
        return ref;
      }
    }
  }
  for (const ref of cachedUsers.values()) {
    if (ref.displayName === displayName) {
      return ref;
    }
  }
  return undefined;
}

export {
  userOnlineForTimestamp,
  languageClass,
  getNameColour,
  getReadableProfileThemeColor,
  invertHexColor,
  userStatusClass,
  statusClass,
  userImage,
  userImageFull,
  parseUserUrl,
  findUserByDisplayName,
};
