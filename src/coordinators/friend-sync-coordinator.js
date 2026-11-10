import { toast } from "vue-sonner";

import { AppDebug } from "../services/app-config";
import { migrateMemos } from "./memo-coordinator";
import { syncFriendSearchIndex } from "./search-index-coordinator";
import { reconnectWebSocket } from "../services/websocket";
import { useAuthStore } from "../stores/auth";
import { useFriendStore } from "../stores/friend";
import { useUpdateLoopStore } from "../stores/update-loop";
import { useUserStore } from "../stores/user";
import { getCurrentUser } from "./user-coordinator";
import { watchState } from "../services/watch-state";

import configRepository from "../services/config";

export async function runRefreshFriendsListFlow() {
  const updateLoopStore = useUpdateLoopStore();
  const friendStore = useFriendStore();

  if (updateLoopStore.nextCurrentUserRefresh < 300) {
    await getCurrentUser();
  }
  await friendStore.refreshFriends();
  reconnectWebSocket();
}

export async function runInitFriendsListFlow(t) {
  const userStore = useUserStore();
  const friendStore = useFriendStore();
  const authStore = useAuthStore();

  const userId = userStore.currentUser.id;
  friendStore.setIsRefreshFriendsLoading(true);
  watchState.isFriendsLoaded = false;
  friendStore.resetFriendLog();

  try {
    const currentUser = userStore.currentUser;
    if (await configRepository.getBool(`friendLogInit_${userId}`)) {
      await friendStore.getFriendLog(currentUser);
    } else {
      await friendStore.initFriendLog(currentUser);
    }
  } catch (err) {
    if (!AppDebug.dontLogMeOut) {
      toast.error(t("message.friend.load_failed"));
      authStore.handleLogoutEvent();
      throw err;
    }
  }

  for (const ctx of friendStore.friends.values()) {
    syncFriendSearchIndex(ctx);
  }

  friendStore.tryApplyFriendOrder();
  friendStore.getAllUserStats();

  if (await VRCXStorage.Get(`${userId}_friendLogUpdatedAt`)) {
    VRCXStorage.Remove(`${userId}_feedTable`);
    migrateMemos();
    friendStore.migrateFriendLog(userId);
  }
}
