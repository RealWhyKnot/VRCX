import { useUserStore } from "../stores/user";
import { userImage as userImagePure, userImageFull as userImageFullPure, userStatusClass as userStatusClassPure } from "../shared/utils/user";

export function useUserDisplay() {
  const userStore = useUserStore();

  function userStatusClass(user: Parameters<typeof userStatusClassPure>[0], isPendingOffline = false) {
    return userStatusClassPure(user, isPendingOffline, userStore.currentUser);
  }

  function userImage(user: Parameters<typeof userImagePure>[0], isIcon = false, resolution = "128") {
    return userImagePure(user, isIcon, resolution);
  }

  function userImageFull(user: Parameters<typeof userImageFullPure>[0]) {
    return userImageFullPure(user);
  }

  return { userStatusClass, userImage, userImageFull };
}
