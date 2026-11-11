import { useFriendStore } from "../stores/friend";
import { useInstanceStore } from "../stores/instance";
import { useLocationStore } from "../stores/location";
import { useUserStore } from "../stores/user";
import { checkCanInvite as checkCanInvitePure, checkCanInviteSelf as checkCanInviteSelfPure } from "../shared/utils/invite";

export function useInviteChecks() {
  const userStore = useUserStore();
  const locationStore = useLocationStore();
  const instanceStore = useInstanceStore();
  const friendStore = useFriendStore();

  function checkCanInvite(location: string | null | undefined) {
    return checkCanInvitePure(location, {
      currentUserId: userStore.currentUser.id,
      lastLocationStr: locationStore.lastLocation.location,
      cachedInstances: instanceStore.cachedInstances,
    });
  }

  function checkCanInviteSelf(location: string | null | undefined) {
    return checkCanInviteSelfPure(location, {
      currentUserId: userStore.currentUser.id,
      cachedInstances: instanceStore.cachedInstances,
      friends: friendStore.friends,
    });
  }

  return { checkCanInvite, checkCanInviteSelf };
}
