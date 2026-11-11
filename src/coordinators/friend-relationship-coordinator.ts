import { i18n } from "../plugins/i18n";

import { database } from "../services/database";
import { friendRequest } from "../api/friend";
import { userRequest } from "../api/user";
import { getNameColour } from "../shared/utils/user";
import { handleFavoriteDelete } from "./favorite-coordinator";
import { useAppearanceSettingsStore } from "../stores/settings/appearance";
import { useFriendStore } from "../stores/friend";
import type { FriendStatusSource } from "../stores/friend-types";
import { useModalStore } from "../stores/modal";
import { useNotificationStore } from "../stores/notification";
import { useSharedFeedStore } from "../stores/shared-feed";
import { useUiStore } from "../stores/ui";
import { useUserStore } from "../stores/user";
import type { VrcxUser } from "../types/vrcx";
import { removeFriendSearchIndex, syncFriendSearchIndex } from "./search-index-coordinator";
import { watchState } from "../services/watch-state";

import { configRepository } from "../services/config";
import { storeToRefs } from "pinia";

type FriendStatusResponse = Awaited<ReturnType<typeof friendRequest.getFriendStatus>>;

function logFriendRelationshipError(message: string) {
  return (error: unknown) => {
    console.error(message, error);
  };
}

export function handleFriendStatus(args: FriendStatusResponse) {
  const userStore = useUserStore();
  const D = userStore.userDialog;
  if (!D.visible || D.id !== args.params.userId) {
    return;
  }
  const { json } = args;
  D.isFriend = json.isFriend;
  D.incomingRequest = json.incomingRequest;
  D.outgoingRequest = json.outgoingRequest;
}

export function handleFriendDelete(args: { params: { userId: string } }) {
  const userStore = useUserStore();
  const friendStore = useFriendStore();
  const D = userStore.userDialog;
  if (!D.visible || D.id !== args.params.userId) {
    return;
  }
  D.isFriend = false;
  runDeleteFriendshipFlow(args.params.userId);
  friendStore.deleteFriend(args.params.userId);
  removeFriendSearchIndex(args.params.userId);
}

export function handleFriendAdd(args: { params: { userId: string } }) {
  const friendStore = useFriendStore();
  addFriendship(args.params.userId);
  friendStore.addFriend(args.params.userId);
  const ctx = friendStore.friends.get(args.params.userId);
  if (ctx) {
    syncFriendSearchIndex(ctx);
  }
}

export function getFriendRequest(userId: string) {
  const notificationStore = useNotificationStore();
  const array = notificationStore.notificationTable.data;
  for (let i = array.length - 1; i >= 0; i--) {
    const entry = array[i];
    if (entry?.type === "friendRequest" && entry.senderUserId === userId) {
      return entry.id;
    }
  }
  return "";
}

function deleteFriendRequest(userId: string) {
  const notificationStore = useNotificationStore();
  const array = notificationStore.notificationTable.data;
  for (let i = array.length - 1; i >= 0; i--) {
    const entry = array[i];
    if (entry?.type === "friendRequest" && entry.senderUserId === userId) {
      array.splice(i, 1);
      return;
    }
  }
}

export function addFriendship(id: string) {
  const friendStore = useFriendStore();
  const userStore = useUserStore();
  const notificationStore = useNotificationStore();
  const sharedFeedStore = useSharedFeedStore();
  const uiStore = useUiStore();

  const { friendLogTable } = storeToRefs(friendStore);
  const { friendLog, state } = friendStore;

  if (!watchState.isFriendsLoaded || friendLog.has(id) || id === userStore.currentUser.id) {
    return;
  }
  const ref = userStore.cachedUsers.get(id);
  if (typeof ref === "undefined") {
    return;
  }
  friendRequest
    .getFriendStatus({
      userId: id,
      currentUserId: userStore.currentUser.id,
    })
    .then((args) => {
      if (args.params.currentUserId !== userStore.currentUser.id) {
        return;
      }
      handleFriendStatus(args);
      if (args.json.isFriend && !friendLog.has(id)) {
        if (state.friendNumber === 0) {
          state.friendNumber = friendStore.friends.size;
        }
        ref.$friendNumber = ++state.friendNumber;
        void configRepository
          .setInt(`VRCX_friendNumber_${userStore.currentUser.id}`, state.friendNumber)
          .catch(logFriendRelationshipError("Error saving friend number:"));
        friendStore.addFriend(id, ref.state);
        const friendCtx = friendStore.friends.get(id);
        if (friendCtx) {
          syncFriendSearchIndex(friendCtx);
        }
        const friendLogHistory = {
          rowId: null,
          created_at: new Date().toJSON(),
          type: "Friend",
          userId: id,
          displayName: ref.displayName,
          friendNumber: ref.$friendNumber,
        };
        friendLogTable.value.data.push(friendLogHistory);
        database.addFriendLogHistory(friendLogHistory);
        notificationStore.queueFriendLogNoty(friendLogHistory);
        void sharedFeedStore.addEntry(friendLogHistory).catch(logFriendRelationshipError("Error adding shared feed entry:"));
        const friendLogCurrent = {
          userId: id,
          displayName: ref.displayName,
          trustLevel: ref.$trustLevel,
          friendNumber: ref.$friendNumber,
        };
        friendLog.set(id, friendLogCurrent);
        database.setFriendLogCurrent(friendLogCurrent);
        uiStore.notifyMenu("friend-log");
        deleteFriendRequest(id);
        userRequest
          .getUser({
            userId: id,
          })
          .then(() => {
            if (userStore.userDialog.visible && id === userStore.userDialog.id) {
              userStore.applyUserDialogLocation(true);
            }
          })
          .catch(logFriendRelationshipError("Error loading user for friend add:"));
      }
    })
    .catch(logFriendRelationshipError("Error loading friend status:"));
}

export function updateFriendship(ref: VrcxUser) {
  const friendStore = useFriendStore();
  const notificationStore = useNotificationStore();
  const sharedFeedStore = useSharedFeedStore();
  const uiStore = useUiStore();

  const { friendLogTable } = storeToRefs(friendStore);
  const { friendLog } = friendStore;

  const ctx = friendLog.get(ref.id);
  if (!watchState.isFriendsLoaded || typeof ctx === "undefined") {
    return;
  }
  if (ctx.friendNumber) {
    ref.$friendNumber = ctx.friendNumber;
  }
  if (!ref.$friendNumber) {
    ref.$friendNumber = 0;
  }
  if (ctx.displayName !== ref.displayName) {
    if (ctx.displayName) {
      const friendLogHistoryDisplayName = {
        rowId: null,
        created_at: new Date().toJSON(),
        type: "DisplayName",
        userId: ref.id,
        displayName: ref.displayName,
        previousDisplayName: ctx.displayName,
        friendNumber: ref.$friendNumber,
      };

      friendLogTable.value.data.push(friendLogHistoryDisplayName);
      database.addFriendLogHistory(friendLogHistoryDisplayName);
      notificationStore.queueFriendLogNoty(friendLogHistoryDisplayName);
      void sharedFeedStore.addEntry(friendLogHistoryDisplayName).catch(logFriendRelationshipError("Error adding shared feed entry:"));
      const friendLogCurrent = {
        userId: ref.id,
        displayName: ref.displayName,
        trustLevel: ref.$trustLevel,
        friendNumber: ref.$friendNumber,
      };
      friendLog.set(ref.id, friendLogCurrent);
      database.setFriendLogCurrent(friendLogCurrent);
      ctx.displayName = ref.displayName;
      uiStore.notifyMenu("friend-log");
    }
  }
  if (ref.$trustLevel && ctx.trustLevel && ctx.trustLevel !== ref.$trustLevel) {
    if (
      (ctx.trustLevel === "Trusted User" && ref.$trustLevel === "Veteran User") ||
      (ctx.trustLevel === "Veteran User" && ref.$trustLevel === "Trusted User")
    ) {
      const friendLogCurrent3 = {
        userId: ref.id,
        displayName: ref.displayName,
        trustLevel: ref.$trustLevel,
        friendNumber: ref.$friendNumber,
      };
      friendLog.set(ref.id, friendLogCurrent3);
      database.setFriendLogCurrent(friendLogCurrent3);
      return;
    }
    const friendLogHistoryTrustLevel = {
      rowId: null,
      created_at: new Date().toJSON(),
      type: "TrustLevel",
      userId: ref.id,
      displayName: ref.displayName,
      trustLevel: ref.$trustLevel,
      previousTrustLevel: ctx.trustLevel,
      friendNumber: ref.$friendNumber,
    };
    friendLogTable.value.data.push(friendLogHistoryTrustLevel);
    database.addFriendLogHistory(friendLogHistoryTrustLevel);
    notificationStore.queueFriendLogNoty(friendLogHistoryTrustLevel);
    void sharedFeedStore.addEntry(friendLogHistoryTrustLevel).catch(logFriendRelationshipError("Error adding shared feed entry:"));
    const friendLogCurrent2 = {
      userId: ref.id,
      displayName: ref.displayName,
      trustLevel: ref.$trustLevel,
      friendNumber: ref.$friendNumber,
    };
    friendLog.set(ref.id, friendLogCurrent2);
    database.setFriendLogCurrent(friendLogCurrent2);
    uiStore.notifyMenu("friend-log");
  }
  ctx.trustLevel = ref.$trustLevel;
}

export function confirmDeleteFriend(id: string) {
  const t = i18n.global.t;
  const modalStore = useModalStore();
  modalStore
    .confirm({
      description: t("confirm.unfriend"),
      title: t("confirm.title"),
    })
    .then(async ({ ok }) => {
      if (!ok) return;
      const args = await friendRequest.deleteFriend({
        userId: id,
      });
      handleFriendDelete(args);
    })
    .catch(logFriendRelationshipError("Error deleting friend:"));
}

export function userOnFriend(ref: VrcxUser) {
  const friendStore = useFriendStore();
  const userStore = useUserStore();

  updateFriendship(ref);
  if (watchState.isFriendsLoaded && ref.isFriend && !friendStore.friendLog.has(ref.id) && ref.id !== userStore.currentUser.id) {
    addFriendship(ref.id);
  }
}

export function updateUserCurrentStatus(ref: FriendStatusSource) {
  const friendStore = useFriendStore();
  const userStore = useUserStore();
  const appearanceSettingsStore = useAppearanceSettingsStore();

  if (watchState.isFriendsLoaded) {
    const { added, removed } = friendStore.refreshFriendsStatus(ref);
    for (const id of added) {
      const ctx = friendStore.friends.get(id);
      if (ctx) {
        syncFriendSearchIndex(ctx);
      }
    }
    for (const id of removed) {
      removeFriendSearchIndex(id);
    }
  }
  friendStore.updateOnlineFriendCounter();

  if (appearanceSettingsStore.randomUserColours) {
    getNameColour(userStore.currentUser.id, appearanceSettingsStore.isDarkMode)
      .then((colour) => {
        userStore.setCurrentUserColour(colour);
      })
      .catch(logFriendRelationshipError("Error loading name colour:"));
  }
}

export function runDeleteFriendshipFlow(id: string, { nowIso = () => new Date().toJSON() } = {}) {
  const friendStore = useFriendStore();
  const userStore = useUserStore();
  const notificationStore = useNotificationStore();
  const sharedFeedStore = useSharedFeedStore();
  const uiStore = useUiStore();
  const appearanceSettingsStore = useAppearanceSettingsStore();

  const { friendLogTable } = storeToRefs(friendStore);
  const { friendLog } = friendStore;

  const ctx = friendLog.get(id);
  if (typeof ctx === "undefined") {
    return;
  }
  friendRequest
    .getFriendStatus({
      userId: id,
      currentUserId: userStore.currentUser.id,
    })
    .then((args) => {
      if (args.params.currentUserId !== userStore.currentUser.id) {
        return;
      }
      handleFriendStatus(args);
      if (!args.json.isFriend && friendLog.has(id)) {
        const friendLogHistory = {
          rowId: null,
          friendNumber: null,
          created_at: nowIso(),
          type: "Unfriend",
          userId: id,
          displayName: ctx.displayName === null || ctx.displayName === "" ? id : ctx.displayName,
        };
        friendLogTable.value.data.push(friendLogHistory);
        database.addFriendLogHistory(friendLogHistory);
        notificationStore.queueFriendLogNoty(friendLogHistory);
        void sharedFeedStore.addEntry(friendLogHistory).catch(logFriendRelationshipError("Error adding shared feed entry:"));
        friendLog.delete(id);
        database.deleteFriendLogCurrent(id);
        handleFavoriteDelete(id);
        if (!appearanceSettingsStore.hideUnfriends) {
          uiStore.notifyMenu("friend-log");
        }
        friendStore.deleteFriend(id);
        removeFriendSearchIndex(id);
      }
    })
    .catch(logFriendRelationshipError("Error loading friend status:"));
}

export function runUpdateFriendshipsFlow(ref: Pick<FriendStatusSource, "friends">, { nowIso = () => new Date().toJSON() } = {}) {
  const friendStore = useFriendStore();
  const userStore = useUserStore();
  const { friendLog } = friendStore;

  const set = new Set<string>();
  for (const id of ref.friends) {
    set.add(id);
    addFriendship(id);
  }
  for (const id of friendLog.keys()) {
    if (id === userStore.currentUser.id) {
      friendLog.delete(id);
      database.deleteFriendLogCurrent(id);
    } else if (!set.has(id)) {
      runDeleteFriendshipFlow(id, { nowIso });
    }
  }
}
