import { replaceBioSymbols } from "./base/string";

type NotificationJson = Record<string, unknown>;

type BoopNotificationRef = {
  type: string;
  title: string;
  message: string;
  imageUrl: string;
  details: Record<string, unknown>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function replaceBioSymbolsOrEmpty(value: unknown): string {
  return typeof value === "string" ? replaceBioSymbols(value) : "";
}

export function sanitizeNotificationJson(json: NotificationJson): NotificationJson {
  for (const key in json) {
    if (json[key] === null || typeof json[key] === "undefined") {
      Reflect.deleteProperty(json, key);
    }
  }
  if (json["message"]) {
    json["message"] = replaceBioSymbolsOrEmpty(json["message"]);
  }
  if (json["title"]) {
    json["title"] = replaceBioSymbolsOrEmpty(json["title"]);
  }
  return json;
}

export function parseNotificationDetails(details: unknown): Record<string, unknown> {
  if (isRecord(details)) {
    return details;
  }
  if (details !== "{}" && typeof details === "string") {
    try {
      const object: unknown = JSON.parse(details);
      if (isRecord(object)) {
        return object;
      }
    } catch (err) {
      console.log(err);
    }
  }
  return {};
}

export function createDefaultNotificationRef(json: NotificationJson) {
  const ref = {
    id: "",
    senderUserId: "",
    senderUsername: "",
    receiverUserId: "",
    type: "",
    message: "",
    details: {},
    seen: false,
    created_at: "",

    $isExpired: false,

    ...json,
  };
  ref.details = parseNotificationDetails(ref.details);
  return ref;
}

export function createDefaultNotificationV2Ref(json: NotificationJson) {
  return {
    id: "",
    createdAt: "",
    updatedAt: "",
    expiresAt: "",
    type: "",
    link: "",
    linkText: "",
    message: "",
    title: "",
    imageUrl: "",
    seen: false,
    senderUserId: "",
    senderUsername: "",
    receiverUserId: "",
    data: {},
    responses: [] as unknown[],
    details: {},
    version: 2,
    canDelete: false,
    category: "",
    displayData: null,
    expiryAfterSeen: 0,
    ignoreDND: false,
    isSystem: false,
    linkTextKey: "",
    messageKey: "",
    relatedNotificationsId: "",
    requireSeen: false,
    titleKey: "",
    ...json,
  };
}

export function applyBoopLegacyHandling(ref: BoopNotificationRef, endpointDomain: string): void {
  if (ref.type !== "boop" || !ref.title) {
    return;
  }
  ref.message = ref.title;
  ref.title = "";
  const { emojiId, emojiVersion } = ref.details;
  if (typeof emojiId === "string" && emojiId.startsWith("default_")) {
    ref.imageUrl = emojiId;
    ref.message += ` ${emojiId.replace("default_", "")}`;
  } else {
    ref.imageUrl = `${endpointDomain}/file/${String(emojiId)}/${String(emojiVersion)}`;
  }
}
