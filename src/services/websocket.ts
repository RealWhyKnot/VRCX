import { reactive } from "vue";
import { toast } from "vue-sonner";
import { useFriendStore } from "../stores/friend";
import { useGalleryStore } from "../stores/gallery";
import { useInstanceStore } from "../stores/instance";
import { useNotificationStore } from "../stores/notification";
import { useSharedFeedStore } from "../stores/shared-feed";
import { useUiStore } from "../stores/ui";
import { useUserStore } from "../stores/user";
import { applyCurrentUser } from "../coordinators/current-user-apply";
import { applyUser } from "../coordinators/user-profile-apply";
import { onGroupLeft } from "../coordinators/group-membership-coordinator";
import { applyGroup, handleGroupMember } from "../coordinators/group-coordinator";
import { handleFriendAdd, handleFriendDelete } from "../coordinators/friend-relationship-coordinator";
import { parseLocation } from "../shared/utils/location-parser";
import { debounce } from "../shared/utils/common";
import { AppDebug } from "./app-config";
import { groupRequest } from "../api/group";
import { request } from "./request";
import { runUpdateFriendFlow } from "../coordinators/friend-presence-coordinator";
import { runSetCurrentUserLocationFlow } from "../coordinators/location-coordinator";
import { watchState } from "./watch-state";
import * as workerTimers from "worker-timers";
import type { PipelineMessage, PipelineRecord, UserUpdate } from "./websocket-guards";
import {
  field,
  isCurrentUserUpdate,
  isGroupMemberUpdate,
  isNotificationEntry,
  isRecord,
  isUnknownArray,
  isUserUpdate,
  numberField,
  parsePipelineMessage,
  stringField,
  userWithId,
} from "./websocket-guards";

let webSocket: WebSocket | null = null;

let lastWebSocketMessage = "";

let isWebSocketClosedGracefully = true;

const ignoredContentRefreshTypes = new Set(["sticker", "prints", "avatar", "world", "created", "avatargallery", "invitePhoto"]);

const refreshOwnedItems = debounce(() => {
  useUserStore().getAllProductPurchases().catch(logError);
}, 5000);

export const wsState = reactive({
  connected: false,
  messageCount: 0,
  bytesReceived: 0,
});

function logError(err: unknown): void {
  console.error(err);
}

export function initWebsocket() {
  if (!watchState.isFriendsLoaded || webSocket !== null) {
    return;
  }
  return request("auth", {
    method: "GET",
  })
    .then((json) => {
      if (!isRecord(json)) {
        throw new Error("WebSocket auth response is not an object");
      }
      const token = field(json, "token");
      if (field(json, "ok") && typeof token === "string") {
        connectWebSocket(token);
      }
    })
    .catch((err: unknown) => {
      console.error("WebSocket init error:", err);
    });
}

function connectWebSocket(token: string) {
  const userStore = useUserStore();
  const notificationStore = useNotificationStore();
  const friendStore = useFriendStore();
  if (webSocket !== null) {
    return;
  }
  const socket = new WebSocket(`${AppDebug.websocketDomain}/?auth=${token}`);
  socket.onopen = () => {
    wsState.connected = true;
    if (!isWebSocketClosedGracefully && watchState.isLoggedIn && watchState.isFriendsLoaded) {
      console.warn("WebSocket reconnected after unexpected closure");
      isWebSocketClosedGracefully = true;
      notificationStore.refreshNotifications().catch(logError);
      friendStore.refreshFriends().catch(logError);
    }
    if (AppDebug.debugWebSocket) {
      console.log("WebSocket connected");
    }
  };
  socket.onclose = ({ code, reason }) => {
    wsState.connected = false;
    const isCurrentSocket = webSocket === socket;
    if (isCurrentSocket) {
      webSocket = null;
    }
    try {
      socket.close();
    } catch (err) {
      console.error("Error closing WebSocket:", err);
    }
    isWebSocketClosedGracefully = code === 1000 || code === 1001;
    if (!isWebSocketClosedGracefully || AppDebug.debugWebSocket) {
      console.log("WebSocket closed", { code, reason });
    }
    workerTimers.setTimeout(() => {
      if (watchState.isLoggedIn && watchState.isFriendsLoaded && webSocket === null) {
        void initWebsocket()?.catch(logError);
      }
    }, 5000);
  };
  socket.onerror = () => {
    if (AppDebug.errorNoty) {
      toast.dismiss(AppDebug.errorNoty);
    }
    AppDebug.errorNoty = toast.error("WebSocket Error");
    socket.onclose?.(
      new CloseEvent("close", {
        code: 1006,
        reason: "WebSocket Error",
      })
    );
  };
  socket.onmessage = ({ data }: MessageEvent<string>) => {
    try {
      wsState.messageCount++;
      wsState.bytesReceived += data.length;
      if (lastWebSocketMessage === data) {
        return;
      }
      lastWebSocketMessage = data;
      const json = parsePipelineMessage(data);
      handlePipeline({
        json,
      });
      if (AppDebug.debugWebSocket && json.content) {
        let displayName = "";
        const userId = isRecord(json.content) ? field(json.content, "userId") : undefined;
        const user = typeof userId === "string" ? userStore.cachedUsers.get(userId) : undefined;
        if (user) {
          displayName = user.displayName;
        }
        console.log("WebSocket", json.type, displayName, json.content);
      }
    } catch (err) {
      console.error(err);
    }
  };
  webSocket = socket;
}

export function closeWebSocket() {
  const socket = webSocket;
  if (socket === null) {
    return;
  }
  socket.onclose = null;
  webSocket = null;
  wsState.connected = false;
  try {
    socket.close();
  } catch (err) {
    console.error("Error closing WebSocket:", err);
  }
}

export function reconnectWebSocket() {
  if (!watchState.isLoggedIn || !watchState.isFriendsLoaded) {
    return;
  }
  closeWebSocket();
  void initWebsocket()?.catch(logError);
}

function handlePipeline(args: { json: PipelineMessage }) {
  const userStore = useUserStore();

  const galleryStore = useGalleryStore();
  const notificationStore = useNotificationStore();
  const sharedFeedStore = useSharedFeedStore();

  const uiStore = useUiStore();
  const instanceStore = useInstanceStore();
  const { type, content, err } = args.json;
  if (typeof err !== "undefined") {
    console.error("PIPELINE: error", args);
    if (AppDebug.errorNoty) {
      toast.dismiss(AppDebug.errorNoty);
    }
    AppDebug.errorNoty = toast.error(`WebSocket Error: ${JSON.stringify(err)}`);
    return;
  }
  if (typeof content === "undefined") {
    console.error("PIPELINE: missing content", args);
    return;
  }
  const record: PipelineRecord = isRecord(content) ? content : {};
  const recordUser = field(record, "user");
  if (isRecord(recordUser)) {
    delete recordUser["state"];
  }
  switch (type) {
    case "notification": {
      const notificationId = stringField(record, "id");
      notificationStore.handleNotification({
        json: record,
        params: {
          notificationId,
        },
      });
      if (isNotificationEntry(record)) {
        notificationStore.handlePipelineNotification({
          json: record,
        });
      }
      break;
    }

    case "notification-v2": {
      console.log("notification-v2", content);
      notificationStore.handleNotificationV2({
        json: record,
        params: {
          notificationId: stringField(record, "id"),
        },
      });
      break;
    }

    case "notification-v2-delete": {
      console.log("notification-v2-delete", content);
      const ids = field(record, "ids");
      if (isUnknownArray(ids)) {
        for (const id of ids) {
          if (typeof id !== "string") continue;
          notificationStore.handleNotificationV2Hide(id);
          notificationStore.handleNotificationSee(id);
        }
      }
      break;
    }

    case "notification-v2-update": {
      console.log("notification-v2-update", content);
      const updates = field(record, "updates");
      const notificationId = stringField(record, "id");
      if (isRecord(updates) && notificationId !== undefined) {
        notificationStore.handleNotificationV2Update({
          json: updates,
          params: {
            notificationId,
          },
        });
      }
      break;
    }

    case "see-notification":
      if (typeof content === "string") {
        notificationStore.handleNotificationSee(content);
      }
      break;

    case "hide-notification":
      if (typeof content === "string") {
        notificationStore.handleNotificationHide(content);
        notificationStore.handleNotificationSee(content);
      }
      break;

    case "response-notification": {
      const notificationId = stringField(record, "notificationId");
      if (notificationId !== undefined) {
        notificationStore.handleNotificationHide(notificationId);
        notificationStore.handleNotificationSee(notificationId);
      }
      break;
    }

    case "friend-add": {
      const userId = stringField(record, "userId");
      const addedUser = field(record, "user");
      if (isUserUpdate(addedUser)) {
        applyUser(addedUser);
      }
      if (userId !== undefined) {
        handleFriendAdd({
          params: {
            userId,
          },
        });
      }
      break;
    }

    case "friend-delete": {
      const userId = stringField(record, "userId");
      if (userId !== undefined) {
        handleFriendDelete({
          params: {
            userId,
          },
        });
      }
      break;
    }

    case "friend-online": {
      const location = stringField(record, "location");
      const travelingToLocation = stringField(record, "travelingToLocation");
      const parsedLocation = parseLocation(location);
      const parsedTravelingToLocation = parseLocation(travelingToLocation);
      const user = userWithId(record);
      if (user) {
        const onlineJson: UserUpdate = {
          platform: stringField(record, "platform"),
          state: "online",

          location,
          worldId: stringField(record, "worldId"),
          instanceId: parsedLocation.instanceId,
          travelingToLocation,
          travelingToWorld: parsedTravelingToLocation.worldId,
          travelingToInstance: parsedTravelingToLocation.instanceId,

          ...user,
        };
        applyUser(onlineJson);
      } else {
        console.error("friend-online missing user id", content);
        const userId = stringField(record, "userId");
        if (userId !== undefined) {
          runUpdateFriendFlow(userId, "online").catch(logError);
        }
      }
      break;
    }

    case "friend-active": {
      const user = userWithId(record);
      if (user) {
        const activeJson: UserUpdate = {
          platform: stringField(record, "platform"),
          state: "active",

          location: "offline",
          worldId: "offline",
          instanceId: "offline",
          travelingToLocation: "offline",
          travelingToWorld: "offline",
          travelingToInstance: "offline",

          ...user,
        };
        applyUser(activeJson);
      } else {
        console.error("friend-active missing user id", content);
        const userId = stringField(record, "userId");
        if (userId !== undefined) {
          runUpdateFriendFlow(userId, "active").catch(logError);
        }
      }
      break;
    }

    case "friend-offline": {
      const userId = stringField(record, "userId");
      if (userId !== undefined) {
        const offlineJson: UserUpdate = {
          id: userId,
          platform: stringField(record, "platform"),
          state: "offline",

          location: "offline",
          worldId: "offline",
          instanceId: "offline",
          travelingToLocation: "offline",
          travelingToWorld: "offline",
          travelingToInstance: "offline",
        };

        applyUser(offlineJson);
      }
      break;
    }

    case "friend-update": {
      const updatedUser = field(record, "user");
      if (isUserUpdate(updatedUser)) {
        applyUser(updatedUser);
      }
      break;
    }

    case "friend-location": {
      const location = stringField(record, "location");
      const travelingToLocation = stringField(record, "travelingToLocation");
      const parsedLocation = parseLocation(location);
      const parsedTravelingToLocation = parseLocation(travelingToLocation);
      const user = userWithId(record);
      if (!user) {
        console.error("friend-location missing user id", content);
        const userId = stringField(record, "userId");
        if (userId !== undefined) {
          const jankLocationJson: UserUpdate = {
            id: userId,
            location,
            worldId: stringField(record, "worldId"),
            instanceId: parsedLocation.instanceId,
            travelingToLocation,
            travelingToWorld: parsedTravelingToLocation.worldId,
            travelingToInstance: parsedTravelingToLocation.instanceId,
          };

          applyUser(jankLocationJson);
        }
        break;
      }
      const locationJson: UserUpdate = {
        location,
        worldId: stringField(record, "worldId"),
        instanceId: parsedLocation.instanceId,
        travelingToLocation,
        travelingToWorld: parsedTravelingToLocation.worldId,
        travelingToInstance: parsedTravelingToLocation.instanceId,
        ...user,
        state: "online",
      };
      applyUser(locationJson);

      break;
    }

    case "user-update": {
      const currentUser = field(record, "user");
      if (isCurrentUserUpdate(currentUser)) {
        applyCurrentUser(currentUser);
      }
      break;
    }

    case "user-location": {
      const location = stringField(record, "location");
      const travelingToLocation = stringField(record, "travelingToLocation");
      if (field(record, "userId") !== userStore.currentUser.id) {
        console.error("user-location wrong userId", content);
        break;
      }
      if (location === undefined || travelingToLocation === undefined) {
        break;
      }

      runSetCurrentUserLocationFlow(location, travelingToLocation).catch(logError);
      break;
    }

    case "group-joined":
      break;

    case "group-left": {
      const groupId = stringField(record, "groupId");
      if (groupId !== undefined) {
        onGroupLeft(groupId).catch(logError);
      }
      break;
    }

    case "group-role-updated": {
      const role = field(record, "role");
      const groupId = isRecord(role) ? stringField(role, "groupId") : undefined;
      if (groupId !== undefined) {
        groupRequest
          .getGroup({ groupId, includeRoles: true })
          .then((args) => applyGroup(args.json))
          .catch(logError);
      }
      console.log("group-role-updated", content);

      break;
    }

    case "group-member-updated": {
      const member = field(record, "member");
      if (!member) {
        console.error("group-member-updated missing member", content);
        break;
      }
      if (isGroupMemberUpdate(member)) {
        handleGroupMember({
          json: member,
        });
      }
      console.log("group-member-updated", member);
      break;
    }

    case "instance-queue-joined":
    case "instance-queue-position": {
      const instanceId = stringField(record, "instanceLocation");
      const position = numberField(record, "position") ?? 0;
      const queueSize = numberField(record, "queueSize") ?? 0;
      if (instanceId !== undefined) {
        instanceStore.instanceQueueUpdate(instanceId, position, queueSize).catch(logError);
      }
      break;
    }

    case "instance-queue-ready": {
      const instanceId = stringField(record, "instanceLocation");
      if (instanceId !== undefined) {
        instanceStore.instanceQueueReady(instanceId);
      }
      break;
    }

    case "instance-queue-left": {
      const instanceId = stringField(record, "instanceLocation");
      if (instanceId !== undefined) {
        instanceStore.removeQueuedInstance(instanceId);
      }

      break;
    }

    case "content-refresh": {
      const contentType = stringField(record, "contentType");
      console.log("content-refresh", content);
      if (contentType === "icon") {
        if (galleryStore.galleryDialogVisible && !galleryStore.galleryDialogIconsLoading) {
          galleryStore.refreshVRCPlusIconsTable();
        }
      } else if (contentType === "gallery") {
        if (galleryStore.galleryDialogVisible && !galleryStore.galleryDialogGalleryLoading) {
          galleryStore.refreshGalleryTable();
        }
      } else if (contentType === "emoji") {
        if (galleryStore.galleryDialogVisible && !galleryStore.galleryDialogEmojisLoading) {
          galleryStore.refreshEmojiTable();
        }
      } else if (contentType === "print") {
        if (stringField(record, "actionType") === "created") {
          galleryStore.tryDeleteOldPrints().catch(logError);
        } else if (galleryStore.galleryDialogVisible && !galleryStore.galleryDialogPrintsLoading) {
          galleryStore.refreshPrintTable().catch(logError);
        }
      } else if (contentType === "inventory") {
        if (galleryStore.galleryDialogVisible && !galleryStore.galleryDialogInventoryLoading) {
          galleryStore.getInventory().catch(logError);
        }
        refreshOwnedItems();
      } else if (!contentType) {
        console.log("content-refresh without contentType", content);
      } else if (!ignoredContentRefreshTypes.has(contentType)) {
        console.log("Unknown content-refresh type", contentType);
      }
      break;
    }

    case "instance-closed": {
      const noty = {
        type: "instance.closed",
        location: stringField(record, "instanceLocation"),
        message: "Instance Closed",
        created_at: new Date().toJSON(),
      };
      if (notificationStore.notificationTable.filters[0].value.length === 0 || notificationStore.notificationTable.filters[0].value.includes(noty.type)) {
        uiStore.notifyMenu("notification");
      }
      notificationStore.queueNotificationNoty(noty);
      notificationStore.appendNotificationTableEntry(noty);
      sharedFeedStore.addEntry(noty).catch(logError);
      break;
    }

    case "economy-update": {
      const walletBalance = numberField(record, "walletBalance");
      userStore.setCurrentUserCredits(walletBalance ?? null);
      break;
    }

    default:
      console.log("Unknown pipeline type", args.json);
  }
}
