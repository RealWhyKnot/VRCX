import { useUserStore } from "../stores";
import { userImage as userImagePure, userImageFull as userImageFullPure, userStatusClass as userStatusClassPure } from "../shared/utils/user";

export function useUserDisplay() {
  const userStore = useUserStore();

  function userStatusClass(user, pendingOffline = false) {
    return userStatusClassPure(user, pendingOffline, userStore.currentUser);
  }

  function userImage(user, isIcon = false, resolution = "128") {
    return userImagePure(user, isIcon, resolution);
  }

  function userImageFull(user) {
    return userImageFullPure(user);
  }

  return { userStatusClass, userImage, userImageFull };
}
