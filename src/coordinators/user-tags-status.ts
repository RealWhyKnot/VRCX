import { toast } from "vue-sonner";
import type { UpdateUserRequest, UserStatus } from "vrchat";
import { parseLocation } from "../shared/utils/location-parser";
import { userRequest } from "../api/user";
import { AppDebug } from "../services/app-config";
import { useFavoriteStore } from "../stores/favorite";
import { useGameStore } from "../stores/game";
import { useGeneralSettingsStore } from "../stores/settings/general";
import { useLocationStore } from "../stores/location";
import { useSharedFeedStore } from "../stores/shared-feed";
import { useUserStore } from "../stores/user";
import { logError } from "./user-coordinator";

export function addCustomTag(data: { UserId: string; Tag: string; TagColour: string }) {
  const userStore = useUserStore();
  const sharedFeedStore = useSharedFeedStore();

  if (data.Tag) {
    userStore.customUserTags.set(data.UserId, {
      tag: data.Tag,
      colour: data.TagColour,
    });
  } else {
    userStore.customUserTags.delete(data.UserId);
  }
  const feedUpdate = {
    userId: data.UserId,
    colour: data.TagColour,
  };
  void AppApi.ExecuteVrOverlayFunction("updateHudFeedTag", JSON.stringify(feedUpdate)).catch(logError);
  const ref = userStore.cachedUsers.get(data.UserId);
  if (typeof ref !== "undefined") {
    ref.$customTag = data.Tag;
    ref.$customTagColour = data.TagColour;
  }
  sharedFeedStore.addTag(data.UserId, data.TagColour);
}

const USER_STATUSES: readonly UserStatus[] = ["active", "ask me", "busy", "join me", "offline"];

function isUserStatus(value: string): value is UserStatus {
  return USER_STATUSES.some((status) => status === value);
}

export function updateAutoStateChange() {
  const userStore = useUserStore();
  const generalSettingsStore = useGeneralSettingsStore();
  const gameStore = useGameStore();
  const locationStore = useLocationStore();
  const favoriteStore = useFavoriteStore();

  if (
    !generalSettingsStore.autoStateChangeEnabled ||
    !gameStore.isGameRunning ||
    !locationStore.lastLocation.playerList.size ||
    locationStore.lastLocation.location === "" ||
    locationStore.lastLocation.location === "traveling"
  ) {
    return;
  }

  const $location = parseLocation(locationStore.lastLocation.location);
  let instanceType = $location.accessType;
  if (instanceType === "group") {
    if ($location.groupAccessType === "members") {
      instanceType = "groupOnly";
    } else if ($location.groupAccessType === "plus") {
      instanceType = "groupPlus";
    } else {
      instanceType = "groupPublic";
    }
  }
  if (generalSettingsStore.autoStateChangeInstanceTypes.length > 0 && !generalSettingsStore.autoStateChangeInstanceTypes.includes(instanceType)) {
    return;
  }

  let isWithCompany = locationStore.lastLocation.playerList.size > 1;
  if (generalSettingsStore.autoStateChangeNoFriends) {
    const selectedGroups = generalSettingsStore.autoStateChangeGroups;
    if (selectedGroups.length > 0) {
      const groupFriendIds = new Set();
      for (const ref of favoriteStore.cachedFavorites.values()) {
        if (ref.type === "friend" && selectedGroups.includes(ref.$groupKey)) {
          groupFriendIds.add(ref.favoriteId);
        }
      }
      for (const selectedKey of selectedGroups) {
        if (selectedKey.startsWith("local:")) {
          const groupName = selectedKey.slice(6);
          const userIds = favoriteStore.localFriendFavorites[groupName];
          if (userIds) {
            for (const userId of userIds) {
              groupFriendIds.add(userId);
            }
          }
        }
      }
      isWithCompany = false;
      for (const friendId of locationStore.lastLocation.friendList.keys()) {
        if (groupFriendIds.has(friendId)) {
          isWithCompany = true;
          break;
        }
      }
    } else {
      isWithCompany = locationStore.lastLocation.friendList.size >= 1;
    }
  }

  const currentStatus = userStore.currentUser.status;
  const newStatus = isWithCompany ? generalSettingsStore.autoStateChangeCompanyStatus : generalSettingsStore.autoStateChangeAloneStatus;
  if (!isUserStatus(newStatus)) {
    return;
  }

  if (currentStatus === newStatus) {
    return;
  }

  const params: UpdateUserRequest = { status: newStatus };
  if (isWithCompany && generalSettingsStore.autoStateChangeCompanyDescEnabled) {
    params.statusDescription = generalSettingsStore.autoStateChangeCompanyDesc;
  } else if (!isWithCompany && generalSettingsStore.autoStateChangeAloneDescEnabled) {
    params.statusDescription = generalSettingsStore.autoStateChangeAloneDesc;
  }

  void userRequest
    .saveCurrentUser(params)
    .then(() => {
      const text = `Status automatically changed to ${newStatus}`;
      if (AppDebug.errorNoty) {
        toast.dismiss(AppDebug.errorNoty);
      }
      AppDebug.errorNoty = toast.info(text);
      console.log(text);
    })
    .catch(logError);
}
