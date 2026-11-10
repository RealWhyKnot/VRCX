import { replaceBioSymbols } from "./base/string";

export function sanitizeNotificationJson(json) {
  for (const key in json) {
    if (json[key] === null || typeof json[key] === "undefined") {
      delete json[key];
    }
  }
  if (json.message) {
    json.message = replaceBioSymbols(json.message);
  }
  if (json.title) {
    json.title = replaceBioSymbols(json.title);
  }
  return json;
}

export function parseNotificationDetails(details) {
  if (details === Object(details)) {
    return details;
  }
  if (details !== "{}" && typeof details === "string") {
    try {
      const object = JSON.parse(details);
      if (object === Object(object)) {
        return object;
      }
    } catch (err) {
      console.log(err);
    }
  }
  return {};
}

export function createDefaultNotificationRef(json) {
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

export function createDefaultNotificationV2Ref(json) {
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
    responses: [],
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

export function applyBoopLegacyHandling(ref, endpointDomain) {
  if (ref.type !== "boop" || !ref.title) {
    return;
  }
  ref.message = ref.title;
  ref.title = "";
  if (ref.details?.emojiId?.startsWith("default_")) {
    ref.imageUrl = ref.details.emojiId;
    ref.message += ` ${ref.details.emojiId.replace("default_", "")}`;
  } else {
    ref.imageUrl = `${endpointDomain}/file/${ref.details.emojiId}/${ref.details.emojiVersion}`;
  }
}
