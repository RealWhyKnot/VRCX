import { computed } from "vue";
import type { Ref } from "vue";
import type { ComposerTranslation } from "vue-i18n";
import { toast } from "vue-sonner";
import { instanceRequest } from "../../../api/instance";
import { notificationRequest } from "../../../api/notification";
import { queryRequest } from "../../../api/query-request";
import type { useInviteChecks } from "../../../composables/use-invite-checks";
import { recordRecentAction } from "../../../composables/use-recent-actions";
import { isRealInstance } from "../../../shared/utils/instance";
import { parseLocation } from "../../../shared/utils/location-parser";
import type { FriendContext } from "../../../stores/friend-types";
import type { useLaunchStore } from "../../../stores/launch";
import type { LastLocation } from "../../../stores/location";
import { logFailure } from "../../../stores/log-failure";

type FriendSidebarActionsDeps = {
  t: ComposerTranslation;
  lastLocation: Ref<LastLocation>;
  lastLocationDestination: Ref<string>;
  checkCanInvite: ReturnType<typeof useInviteChecks>["checkCanInvite"];
  checkCanInviteSelf: ReturnType<typeof useInviteChecks>["checkCanInviteSelf"];
  showSendBoopDialog: (userId: string) => void;
  launchStore: ReturnType<typeof useLaunchStore>;
};

export function useFriendSidebarActions({
  t,
  lastLocation,
  lastLocationDestination,
  checkCanInvite,
  checkCanInviteSelf,
  showSendBoopDialog,
  launchStore,
}: FriendSidebarActionsDeps) {
  const canInviteToMyLocation = computed(() => checkCanInvite(lastLocation.value.location));

  function hasFriendLocation(friend: FriendContext): boolean {
    const loc = friend.ref?.location;
    return !!loc && isRealInstance(loc);
  }

  function canJoinFriend(friend: FriendContext): boolean {
    const loc = friend.ref?.location;
    if (!loc || !isRealInstance(loc)) return false;
    return checkCanInviteSelf(loc);
  }

  function friendRequestInvite(friend: FriendContext) {
    void notificationRequest
      .sendRequestInvite({ platform: "standalonewindows" }, friend.id)
      .then(() => {
        recordRecentAction(friend.id, "Request Invite");
        toast.success("Request invite sent");
      })
      .catch(logFailure("send request invite"));
  }

  function friendInvite(friend: FriendContext) {
    let currentLocation = lastLocation.value.location;
    if (currentLocation === "traveling") {
      currentLocation = lastLocationDestination.value;
    }
    const L = parseLocation(currentLocation);
    void queryRequest
      .fetch("world.location", { worldId: L.worldId })
      .then((args) => {
        return notificationRequest
          .sendInvite(
            {
              instanceId: L.tag,
              worldId: L.tag,
              worldName: args.ref.name,
            },
            friend.id
          )
          .then(() => {
            recordRecentAction(friend.id, "Invite");
            toast.success(t("message.invite.sent"));
          });
      })
      .catch(logFailure("send invite"));
  }

  function friendSendBoop(friend: FriendContext) {
    showSendBoopDialog(friend.id);
  }

  function friendJoin(friend: FriendContext) {
    const loc = friend.ref?.location;
    if (!loc) return;
    void launchStore.showLaunchDialog(loc).catch(logFailure("show launch dialog"));
  }

  function friendInviteSelf(friend: FriendContext) {
    const loc = friend.ref?.location;
    if (!loc) return;
    const L = parseLocation(loc);
    void instanceRequest
      .selfInvite({
        instanceId: L.instanceId,
        worldId: L.worldId,
      })
      .then(() => {
        toast.success(t("message.invite.self_sent"));
      })
      .catch(logFailure("send self invite"));
  }

  return {
    canInviteToMyLocation,
    hasFriendLocation,
    canJoinFriend,
    friendRequestInvite,
    friendInvite,
    friendSendBoop,
    friendJoin,
    friendInviteSelf,
  };
}
