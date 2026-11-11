import type { CurrentUser } from "vrchat";
import type { Json } from "../types/vrcx";
import { getWorldName } from "../shared/utils/world";
import { parseLocation } from "../shared/utils/location-parser";
import { runUpdateFriendshipsFlow, updateUserCurrentStatus } from "./friend-relationship-coordinator";
import { useAuthStore } from "../stores/auth";
import { addAvatarToHistory, addAvatarWearTime } from "./avatar-coordinator";
import { useGameStore } from "../stores/game";
import { applyPresenceGroups } from "./group-membership-coordinator";
import { useInstanceStore } from "../stores/instance";
import { useUserStore } from "../stores/user";
import type { CurrentUserState } from "../stores/user-state";

type ClockOptions = { now?: () => number };

export function runAvatarSwapFlow(
  { json, ref, isLoggedIn }: { json: Json<CurrentUser>; ref: CurrentUserState; isLoggedIn: boolean },
  { now = Date.now }: ClockOptions = {}
) {
  const gameStore = useGameStore();

  if (!isLoggedIn) {
    return;
  }
  if (json.currentAvatar !== ref.currentAvatar) {
    addAvatarToHistory(json.currentAvatar);
    if (gameStore.isGameRunning) {
      addAvatarWearTime(ref.currentAvatar);
      ref.$previousAvatarSwapTime = now();
    }
  }
}

export function runFirstLoginFlow(ref: CurrentUserState, { now = Date.now }: ClockOptions = {}) {
  const gameStore = useGameStore();
  const authStore = useAuthStore();
  const userStore = useUserStore();

  if (gameStore.isGameRunning) {
    ref.$previousAvatarSwapTime = now();
  }
  userStore.clearCachedUsers();
  userStore.setCurrentUser(ref);
  void authStore.loginComplete().catch((err: unknown) => {
    console.error(err);
  });
}

export function runPostApplySyncFlow(ref: CurrentUserState) {
  const instanceStore = useInstanceStore();

  applyPresenceGroups(ref);
  instanceStore.applyQueuedInstance(ref.queuedInstance ?? "");
  updateUserCurrentStatus(ref);
  if (typeof ref.friends !== "undefined") {
    runUpdateFriendshipsFlow(ref);
  }
}

export function runHomeLocationSyncFlow(ref: CurrentUserState) {
  const userStore = useUserStore();

  if (ref.homeLocation === ref.$homeLocation.tag) {
    return;
  }
  ref.$homeLocation = parseLocation(ref.homeLocation);

  if (userStore.userDialog.visible && userStore.userDialog.id === ref.id) {
    void getWorldName(userStore.currentUser.homeLocation)
      .then((worldName) => {
        userStore.userDialog.$homeLocationName = worldName;
      })
      .catch((err: unknown) => {
        console.error(err);
      });
  }
}
