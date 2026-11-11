import { reactive } from "vue";
import { toast } from "vue-sonner";

import { useFriendStore } from "../stores/friend";
import { useGalleryStore } from "../stores/gallery";
import { useInstanceStore } from "../stores/instance";
import { useNotificationStore } from "../stores/notification";
import { useSharedFeedStore } from "../stores/shared-feed";
import { useUiStore } from "../stores/ui";
import { useUserStore } from "../stores/user";
import { applyUser, applyCurrentUser } from "../coordinators/user-coordinator";
import { onGroupLeft, applyGroup, handleGroupMember } from "../coordinators/group-coordinator";
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

let webSocket = null;
let lastWebSocketMessage = "";
let webSocketClosedGracefully = true;

const refreshOwnedItems = debounce(() => useUserStore().getAllProductPurchases(), 5000);

export const wsState = reactive({
  connected: false,
  messageCount: 0,
  bytesReceived: 0,
});

export function initWebsocket() {
  if (!watchState.isFriendsLoaded || webSocket !== null) {
    return;
  }
  return request("auth", {
    method: "GET",
  })
    .then((json) => {
      const args = {
        json,
      };
      if (args.json.ok) {
        connectWebSocket(args.json.token);
      }
    })
    .catch((err) => {
      console.error("WebSocket init error:", err);
    });
}

function connectWebSocket(token) {
  const userStore = useUserStore();
  const notificationStore = useNotificationStore();
  const friendStore = useFriendStore();
  if (webSocket !== null) {
    return;
  }
  const socket = new WebSocket(`${AppDebug.websocketDomain}/?auth=${token}`);
  socket.onopen = () => {
    wsState.connected = true;
    if (!webSocketClosedGracefully && watchState.isLoggedIn && watchState.isFriendsLoaded) {
      console.warn("WebSocket reconnected after unexpected closure");
      webSocketClosedGracefully = true;
      notificationStore.refreshNotifications();
      friendStore.refreshFriends();
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
    webSocketClosedGracefully = code === 1000 || code === 1001;
    if (!webSocketClosedGracefully || AppDebug.debugWebSocket) {
      console.log("WebSocket closed", { code, reason });
    }
    workerTimers.setTimeout(() => {
      if (watchState.isLoggedIn && watchState.isFriendsLoaded && webSocket === null) {
        initWebsocket();
      }
    }, 5000);
  };
  socket.onerror = () => {
    if (AppDebug.errorNoty) {
      toast.dismiss(AppDebug.errorNoty);
    }
    AppDebug.errorNoty = toast.error("WebSocket Error");
    socket.onclose(
      new CloseEvent("close", {
        code: 1006,
        reason: "WebSocket Error",
      })
    );
  };
  socket.onmessage = ({ data }) => {
    try {
      wsState.messageCount++;
      wsState.bytesReceived += data.length;
      if (lastWebSocketMessage === data) {
        return;
      }
      lastWebSocketMessage = data;
      let json;
      try {
        json = JSON.parse(data);
        json.content = JSON.parse(json.content);
      } catch {}
      handlePipeline({
        json,
      });
      if (AppDebug.debugWebSocket && json.content) {
        let displayName = "";
        const user = userStore.cachedUsers.get(json.content.userId);
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
  initWebsocket();
}

function handlePipeline(args) {
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
    AppDebug.errorNoty = toast.error(`WebSocket Error: ${err}`);
    return;
  }
  if (typeof content === "undefined") {
    console.error("PIPELINE: missing content", args);
    return;
  }
  if (typeof content.user !== "undefined") {
    delete content.user.state;
  }
  switch (type) {
    case "notification":
      notificationStore.handleNotification({
        json: content,
        params: {
          notificationId: content.id,
        },
      });
      notificationStore.handlePipelineNotification({
        json: content,
        params: {
          notificationId: content.id,
        },
      });
      break;

    case "notification-v2":
      console.log("notification-v2", content);
      notificationStore.handleNotificationV2({
        json: content,
        params: {
          notificationId: content.id,
        },
      });
      break;

    case "notification-v2-delete":
      console.log("notification-v2-delete", content);
      for (const id of content.ids) {
        notificationStore.handleNotificationV2Hide(id);
        notificationStore.handleNotificationSee(id);
      }
      break;

    case "notification-v2-update":
      console.log("notification-v2-update", content);
      notificationStore.handleNotificationV2Update({
        json: content.updates,
        params: {
          notificationId: content.id,
        },
      });
      break;

    case "see-notification":
      notificationStore.handleNotificationSee(content);
      break;

    case "hide-notification":
      notificationStore.handleNotificationHide(content);
      notificationStore.handleNotificationSee(content);
      break;

    case "response-notification":
      notificationStore.handleNotificationHide(content.notificationId);
      notificationStore.handleNotificationSee(content.notificationId);
      break;

    case "friend-add":
      applyUser(content.user);
      handleFriendAdd({
        params: {
          userId: content.userId,
        },
      });
      break;

    case "friend-delete":
      handleFriendDelete({
        params: {
          userId: content.userId,
        },
      });
      break;

    case "friend-online": {
      const $location = parseLocation(content.location);
      const $travelingToLocation = parseLocation(content.travelingToLocation);
      if (content?.user?.id) {
        const onlineJson = {
          id: content.userId,
          platform: content.platform,
          state: "online",

          location: content.location,
          worldId: content.worldId,
          instanceId: $location.instanceId,
          travelingToLocation: content.travelingToLocation,
          travelingToWorld: $travelingToLocation.worldId,
          travelingToInstance: $travelingToLocation.instanceId,

          ...content.user,
        };
        applyUser(onlineJson);
      } else {
        console.error("friend-online missing user id", content);
        runUpdateFriendFlow(content.userId, "online");
      }
      break;
    }

    case "friend-active":
      if (content?.user?.id) {
        const activeJson = {
          id: content.userId,
          platform: content.platform,
          state: "active",

          location: "offline",
          worldId: "offline",
          instanceId: "offline",
          travelingToLocation: "offline",
          travelingToWorld: "offline",
          travelingToInstance: "offline",

          ...content.user,
        };
        applyUser(activeJson);
      } else {
        console.error("friend-active missing user id", content);
        runUpdateFriendFlow(content.userId, "active");
      }
      break;

    case "friend-offline": {
      const offlineJson = {
        id: content.userId,
        platform: content.platform,
        state: "offline",

        location: "offline",
        worldId: "offline",
        instanceId: "offline",
        travelingToLocation: "offline",
        travelingToWorld: "offline",
        travelingToInstance: "offline",
      };

      applyUser(offlineJson);
      break;
    }

    case "friend-update":
      applyUser(content.user);
      break;

    case "friend-location": {
      const $location1 = parseLocation(content.location);
      const $travelingToLocation1 = parseLocation(content.travelingToLocation);
      if (!content?.user?.id) {
        console.error("friend-location missing user id", content);
        const jankLocationJson = {
          id: content.userId,
          location: content.location,
          worldId: content.worldId,
          instanceId: $location1.instanceId,
          travelingToLocation: content.travelingToLocation,
          travelingToWorld: $travelingToLocation1.worldId,
          travelingToInstance: $travelingToLocation1.instanceId,
        };

        applyUser(jankLocationJson);
        break;
      }
      const locationJson = {
        location: content.location,
        worldId: content.worldId,
        instanceId: $location1.instanceId,
        travelingToLocation: content.travelingToLocation,
        travelingToWorld: $travelingToLocation1.worldId,
        travelingToInstance: $travelingToLocation1.instanceId,
        ...content.user,
        state: "online",
      };
      applyUser(locationJson);

      break;
    }

    case "user-update":
      applyCurrentUser(content.user);
      break;

    case "user-location":
      if (content.userId !== userStore.currentUser.id) {
        console.error("user-location wrong userId", content);
        break;
      }

      runSetCurrentUserLocationFlow(content.location, content.travelingToLocation);
      break;

    case "group-joined":
      break;

    case "group-left":
      onGroupLeft(content.groupId);
      break;

    case "group-role-updated": {
      const groupId = content.role.groupId;
      groupRequest.getGroup({ groupId, includeRoles: true }).then((args) => applyGroup(args.json));
      console.log("group-role-updated", content);

      break;
    }

    case "group-member-updated":
      var member = content.member;
      if (!member) {
        console.error("group-member-updated missing member", content);
        break;
      }
      handleGroupMember({
        json: member,
        params: {
          groupId: member.groupId,
        },
      });
      console.log("group-member-updated", member);
      break;

    case "instance-queue-joined":
    case "instance-queue-position":
      var instanceId = content.instanceLocation;
      var position = content.position ?? 0;
      var queueSize = content.queueSize ?? 0;
      instanceStore.instanceQueueUpdate(instanceId, position, queueSize);
      break;

    case "instance-queue-ready":
      instanceStore.instanceQueueReady(content.instanceLocation);
      break;

    case "instance-queue-left":
      instanceStore.removeQueuedInstance(content.instanceLocation);

      break;

    case "content-refresh":
      var contentType = content.contentType;
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
      } else if (contentType === "sticker") {
      } else if (contentType === "print") {
        if (content.actionType === "created") {
          galleryStore.tryDeleteOldPrints();
        } else if (galleryStore.galleryDialogVisible && !galleryStore.galleryDialogPrintsLoading) {
          galleryStore.refreshPrintTable();
        }
      } else if (contentType === "prints") {
      } else if (contentType === "avatar") {
      } else if (contentType === "world") {
      } else if (contentType === "created") {
      } else if (contentType === "avatargallery") {
      } else if (contentType === "invitePhoto") {
      } else if (contentType === "inventory") {
        if (galleryStore.galleryDialogVisible && !galleryStore.galleryDialogInventoryLoading) {
          galleryStore.getInventory();
        }
        refreshOwnedItems();
      } else if (!contentType) {
        console.log("content-refresh without contentType", content);
      } else {
        console.log("Unknown content-refresh type", content.contentType);
      }
      break;

    case "instance-closed": {
      const noty = {
        type: "instance.closed",
        location: content.instanceLocation,
        message: "Instance Closed",
        created_at: new Date().toJSON(),
      };
      if (notificationStore.notificationTable.filters[0].value.length === 0 || notificationStore.notificationTable.filters[0].value.includes(noty.type)) {
        uiStore.notifyMenu("notification");
      }
      notificationStore.queueNotificationNoty(noty);
      notificationStore.appendNotificationTableEntry(noty);
      sharedFeedStore.addEntry(noty);
      break;
    }

    case "economy-update":
      userStore.setCurrentUserCredits(content?.walletBalance);
      break;

    default:
      console.log("Unknown pipeline type", args.json);
  }
}
