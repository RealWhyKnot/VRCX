import { HueToHex } from "./base/ui";
import { convertFileUrlToImageUrl } from "./common";
import { languageMappings } from "../constants/language";

type ClassMap = Record<string, boolean>;

type RgbColour = { r: number; g: number; b: number };

type UserTimestampContext = {
  ref: {
    state?: string | undefined;
    $online_for?: number | null | undefined;
    $active_for?: number | null | undefined;
    $offline_for?: number | null | undefined;
  };
};

type StatusUser = {
  id?: string;
  userId?: string;
  status?: string | undefined;
  location?: string;
  state?: string;
  isFriend?: boolean;
  $platform?: string | undefined;
};

type StatusCurrentUser = {
  id?: string;
  presence?: { platform?: string | null | undefined } | undefined;
  onlineFriends?: string[];
  activeFriends?: string[];
};

type ImageUser = {
  iconUrl?: string | undefined;
  thumbnailUrl?: string | undefined;
  currentAvatarThumbnailImageUrl?: string | undefined;
  currentAvatarImageUrl?: string | undefined;
  profilePicOverride?: string | undefined;
};

const THEME_COLOR_LIMITS = Object.freeze({
  darkMinLuminance: 0.06,
  lightMaxLuminance: 0.74,
});

const languageFlagClasses: Readonly<Record<string, string | undefined>> = languageMappings;

function userOnlineForTimestamp(ctx: UserTimestampContext): string | null {
  if (ctx.ref.state === "online" && ctx.ref.$online_for) {
    return new Date(ctx.ref.$online_for).toJSON();
  } else if (ctx.ref.state === "active" && ctx.ref.$active_for) {
    return new Date(ctx.ref.$active_for).toJSON();
  } else if (ctx.ref.$offline_for) {
    return new Date(ctx.ref.$offline_for).toJSON();
  }
  return null;
}

function languageClass(language: string): ClassMap {
  const style: ClassMap = {};
  const mapping = languageFlagClasses[language];
  if (typeof mapping !== "undefined") {
    style[mapping] = true;
  } else {
    style["unknown"] = true;
  }
  return style;
}

async function getNameColour(userId: string, isDarkMode: boolean): Promise<string> {
  const hue = await AppApi.GetColourFromUserID(userId);
  return HueToHex(hue, isDarkMode);
}

function normalizeProfileHex(value: string | null | undefined): string | null {
  const hex = (value ?? "").trim().replace(/^#/, "").toLowerCase();
  if (!/^[0-9a-f]{6}$/.test(hex)) {
    return null;
  }
  return `#${hex}`;
}

function hexToRgb(hex: string): RgbColour | null {
  const value = /^#?([0-9a-f]{6})$/i.exec(hex)?.[1];
  if (value === undefined) {
    return null;
  }
  return {
    r: parseInt(value.slice(0, 2), 16),
    g: parseInt(value.slice(2, 4), 16),
    b: parseInt(value.slice(4, 6), 16),
  };
}

function rgbToHex(rgb: RgbColour): string {
  const toHex = (value: number): string => {
    const n = Math.max(0, Math.min(255, Math.round(value)));
    return n.toString(16).padStart(2, "0");
  };
  return `#${toHex(rgb.r)}${toHex(rgb.g)}${toHex(rgb.b)}`;
}

function getRelativeLuminance(rgb: RgbColour): number {
  const channel = (value: number): number => {
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

function mixRgb(from: RgbColour, to: RgbColour, weight: number): RgbColour {
  return {
    r: from.r + (to.r - from.r) * weight,
    g: from.g + (to.g - from.g) * weight,
    b: from.b + (to.b - from.b) * weight,
  };
}

function getReadableProfileThemeColor(colorValue: string | null | undefined, fallback: string, isDarkMode: boolean): string {
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
  const needsAdjustment = isDarkMode ? luminance < luminanceThreshold : luminance > luminanceThreshold;
  if (!needsAdjustment) {
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

function invertHexColor(colorValue: string): string {
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

function isMobilePlatform(platform: string | null | undefined): boolean {
  return platform !== undefined && platform !== "standalonewindows" && platform !== "web";
}

function userStatusClass(user: StatusUser | undefined, isPendingOffline = false, currentUser?: StatusCurrentUser): ClassMap | null {
  const style: ClassMap = {
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
    return {
      ...style,
      ...statusClass(user.status),
      mobile: isMobilePlatform(currentUser.presence?.platform),
    };
  }
  if (!user.isFriend) {
    return null;
  }
  if (isPendingOffline) {
    style["offline"] = true;
  } else if (user.status !== "active" && user.location === "private" && user.state === "" && id && !(currentUser?.onlineFriends ?? []).includes(id)) {
    if ((currentUser?.activeFriends ?? []).includes(id)) {
      if (user.status === "join me") {
        style["active-joinme"] = true;
      } else if (user.status === "ask me") {
        style["active-askme"] = true;
      } else if (user.status === "busy") {
        style["active-busy"] = true;
      } else {
        style["active-default"] = true;
      }
    } else {
      style["offline"] = true;
    }
  } else if (user.state === "active") {
    if (user.status === "join me") {
      style["active-joinme"] = true;
    } else if (user.status === "ask me") {
      style["active-askme"] = true;
    } else if (user.status === "busy") {
      style["active-busy"] = true;
    } else {
      style["active-default"] = true;
    }
  } else if (user.location === "offline") {
    style["offline"] = true;
  } else if (user.status === "active") {
    style["online"] = true;
  } else if (user.status === "join me") {
    style["joinme"] = true;
  } else if (user.status === "ask me") {
    style["askme"] = true;
  } else if (user.status === "busy") {
    style["busy"] = true;
  } else {
    return null;
  }
  if (user.$platform && user.$platform !== "standalonewindows" && user.$platform !== "web" && user.state === "online") {
    style["mobile"] = true;
  }
  return style;
}

function statusClass(status: string | undefined): ClassMap | null {
  if (typeof status === "undefined") {
    return null;
  }
  const style: ClassMap = {
    "status-icon": true,
  };
  if (status === "active") {
    style["online"] = true;
  } else if (status === "join me") {
    style["joinme"] = true;
  } else if (status === "ask me") {
    style["askme"] = true;
  } else if (status === "busy") {
    style["busy"] = true;
  } else {
    return null;
  }
  return style;
}

function userImage(user: ImageUser | null | undefined, isIcon = false, resolution = "128"): string {
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

function userImageFull(user: ImageUser | null | undefined): string | undefined {
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

function parseUserUrl(user: string): string | undefined {
  const url = new URL(user);
  const urlPath = url.pathname;
  if (urlPath.substring(5, 11) === "/user/") {
    const userId = urlPath.substring(11);
    return userId;
  }
  return undefined;
}

function findUserByDisplayName<Ref extends { displayName: string }>(
  cachedUsers: ReadonlyMap<string, Ref>,
  displayName: string,
  cachedUserIdsByDisplayName?: ReadonlyMap<string, Iterable<string>>
): Ref | undefined {
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
