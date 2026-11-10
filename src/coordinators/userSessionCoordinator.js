import { getWorldName, parseLocation } from "../shared/utils";
import { runUpdateFriendshipsFlow, updateUserCurrentStatus } from "./friendRelationshipCoordinator";
import { useAuthStore } from "../stores/auth";
import { addAvatarToHistory, addAvatarWearTime } from "./avatarCoordinator";
import { useGameStore } from "../stores/game";
import { applyPresenceGroups } from "./groupCoordinator";
import { useInstanceStore } from "../stores/instance";
import { useUserStore } from "../stores/user";

export function runAvatarSwapFlow({ json, ref, isLoggedIn }, { now = Date.now } = {}) {
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

export function runFirstLoginFlow(ref, { now = Date.now } = {}) {
  const gameStore = useGameStore();
  const authStore = useAuthStore();
  const userStore = useUserStore();

  if (gameStore.isGameRunning) {
    ref.$previousAvatarSwapTime = now();
  }
  userStore.clearCachedUsers();
  userStore.setCurrentUser(ref);
  authStore.loginComplete();
}

export function runPostApplySyncFlow(ref) {
  const instanceStore = useInstanceStore();

  applyPresenceGroups(ref);
  instanceStore.applyQueuedInstance(ref.queuedInstance);
  updateUserCurrentStatus(ref);
  if (typeof ref.friends !== "undefined") {
    runUpdateFriendshipsFlow(ref);
  }
}

export function runHomeLocationSyncFlow(ref) {
  const userStore = useUserStore();

  if (ref.homeLocation === ref.$homeLocation?.tag) {
    return;
  }
  ref.$homeLocation = parseLocation(ref.homeLocation);

  if (userStore.userDialog.visible && userStore.userDialog.id === ref.id) {
    getWorldName(userStore.currentUser.homeLocation).then((worldName) => {
      userStore.userDialog.$homeLocationName = worldName;
    });
  }
}
