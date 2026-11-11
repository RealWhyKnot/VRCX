import { toast } from "vue-sonner";
import type { useFavoriteStore } from "../favorite";
import type { useGeneralSettingsStore } from "../settings/general";
import type { useInstanceStore } from "../instance";
import type { useLocationStore } from "../location";
import type { useUserStore } from "../user";
import type { NotificationEntry, StoredNotificationEntry } from "./types";
import { database } from "../../services/database";
import { AppDebug } from "../../services/app-config";
import { notificationRequest } from "../../api/notification";
import { queryRequest } from "../../api/query-request";
import { checkCanInvite } from "../../shared/utils/invite";
import { parseLocation } from "../../shared/utils/location-parser";
import { logError } from "./errors";
import { isStoredNotification } from "./helpers";

type GeneralSettingsStore = ReturnType<typeof useGeneralSettingsStore>;
type FavoriteStore = ReturnType<typeof useFavoriteStore>;
type LocationStore = ReturnType<typeof useLocationStore>;
type UserStore = ReturnType<typeof useUserStore>;
type InstanceStore = ReturnType<typeof useInstanceStore>;

export type PipelineDeps = {
  generalSettingsStore: GeneralSettingsStore;
  favoriteStore: FavoriteStore;
  locationStore: LocationStore;
  userStore: UserStore;
  instanceStore: InstanceStore;
  handleNotificationHide: (notificationId: string) => void;
};

export function createPipelineHandler(deps: PipelineDeps) {
  const { generalSettingsStore, favoriteStore, locationStore, userStore, instanceStore, handleNotificationHide } = deps;

  async function handleAutoDeclineFriendRequest(ref: StoredNotificationEntry) {
    const senderUserId = ref.senderUserId;
    if (senderUserId === undefined) return;
    const joinInfo = await database.getJoinCount({
      id: senderUserId,
      displayName: ref.senderUsername,
    });
    if (joinInfo.joinCount !== 0) {
      return;
    }

    const text = `Auto declined friend request from ${ref.senderUsername}`;
    if (AppDebug.errorNoty) {
      toast.dismiss(AppDebug.errorNoty);
    }
    AppDebug.errorNoty = toast.info(text);
    console.log(text);
    await notificationRequest.hideNotification({
      notificationId: ref.id,
    });
    handleNotificationHide(ref.id);
  }

  function isFavoriteFriend(userId: string): boolean {
    const favoriteFriends: readonly { id: string }[] = favoriteStore.state.favoriteFriends_;
    return favoriteFriends.some((x) => x.id === userId) || favoriteStore.isInAnyLocalFriendGroup(userId);
  }

  function favoriteGroupKey(value: unknown): unknown {
    return typeof value === "object" && value !== null && "$groupKey" in value ? value.$groupKey : undefined;
  }

  function isInSelectedFavoriteGroup(userId: string): boolean {
    const groups: readonly string[] = generalSettingsStore.autoAcceptInviteGroups;
    const localFriendFavorites: Record<string, readonly string[] | undefined> = favoriteStore.localFriendFavorites;
    const cachedFavorites: ReadonlyMap<string, unknown> = favoriteStore.cachedFavoritesByObjectId;
    for (const groupKey of groups) {
      if (groupKey.startsWith("local:")) {
        const localFavs = localFriendFavorites[groupKey.slice(6)];
        if (localFavs?.includes(userId)) {
          return true;
        }
      } else if (favoriteGroupKey(cachedFavorites.get(userId)) === groupKey) {
        return true;
      }
    }
    return false;
  }

  function resolveCurrentLocation(): string | undefined {
    let currentLocation = locationStore.lastLocation.location;
    if (locationStore.lastLocation.location === "traveling") {
      currentLocation = locationStore.lastLocationDestination;
    }
    if (!currentLocation) {
      currentLocation = userStore.currentUser.$locationTag;
      if (userStore.currentUser.$travelingToLocation) {
        currentLocation = userStore.currentUser.$travelingToLocation;
      }
    }
    return currentLocation || undefined;
  }

  function handlePipelineNotification(args: { json: NotificationEntry }) {
    const ref = args.json;
    if (!isStoredNotification(ref)) return;
    if (ref.type === "friendRequest" && generalSettingsStore.autoDeclineFriendRequests) {
      void handleAutoDeclineFriendRequest(ref).catch(logError);
    }
    if (ref.type !== "requestInvite" || generalSettingsStore.autoAcceptInviteRequests === "Off") {
      return;
    }
    const senderUserId = ref.senderUserId;
    if (senderUserId === undefined) return;
    const allowedStatuses: readonly string[] = generalSettingsStore.autoAcceptInviteStatuses;
    if (allowedStatuses.length && !allowedStatuses.includes(userStore.currentUser.status)) {
      return;
    }

    const currentLocation = resolveCurrentLocation();
    if (!currentLocation) {
      return;
    }
    if (generalSettingsStore.autoAcceptInviteRequests === "All Favorites" && !isFavoriteFriend(senderUserId)) {
      return;
    }
    if (generalSettingsStore.autoAcceptInviteRequests === "Selected Favorites") {
      if (generalSettingsStore.autoAcceptInviteGroups.length === 0) {
        return;
      }
      if (!isInSelectedFavoriteGroup(senderUserId)) {
        return;
      }
    }
    if (
      !checkCanInvite(currentLocation, {
        currentUserId: userStore.currentUser.id,
        lastLocationStr: locationStore.lastLocation.location,
        cachedInstances: instanceStore.cachedInstances,
      })
    ) {
      return;
    }

    const L = parseLocation(currentLocation);
    void queryRequest
      .fetch("world", {
        worldId: L.worldId,
      })
      .then((args1) => {
        void notificationRequest
          .sendInvite(
            {
              instanceId: L.tag,
              worldId: L.tag,
              worldName: args1.ref.name,
              rsvp: true,
            },
            senderUserId
          )
          .then((_args) => {
            const text = `Auto invite sent to ${ref.senderUsername}`;
            if (AppDebug.errorNoty) {
              toast.dismiss(AppDebug.errorNoty);
            }
            AppDebug.errorNoty = toast.info(text);
            console.log(text);
            void notificationRequest
              .hideNotification({
                notificationId: ref.id,
              })
              .then(() => {
                handleNotificationHide(ref.id);
              })
              .catch(logError);
            return _args;
          })
          .catch(logError);
      })
      .catch(logError);
  }

  return { handlePipelineNotification };
}
