import type { CurrentUserState } from "../stores/user-state";
import { useUserStore } from "../stores/user";
import { userImage as userImagePure, userImageFull as userImageFullPure, userStatusClass as userStatusClassPure } from "../shared/utils/user";

type StatusCurrentUser = NonNullable<Parameters<typeof userStatusClassPure>[2]>;

function toStatusCurrentUser(currentUser: CurrentUserState): StatusCurrentUser {
  return {
    id: currentUser.id,
    presence: { platform: currentUser.presence.platform ?? "" },
    onlineFriends: currentUser.onlineFriends,
    activeFriends: currentUser.activeFriends,
  };
}

export function useUserDisplay() {
  const userStore = useUserStore();

  function userStatusClass(user: Parameters<typeof userStatusClassPure>[0], isPendingOffline = false) {
    return userStatusClassPure(user, isPendingOffline, toStatusCurrentUser(userStore.currentUser));
  }

  function userImage(user: Parameters<typeof userImagePure>[0], isIcon = false, resolution = "128") {
    return userImagePure(user, isIcon, resolution);
  }

  function userImageFull(user: Parameters<typeof userImageFullPure>[0]) {
    return userImageFullPure(user);
  }

  return { userStatusClass, userImage, userImageFull };
}
