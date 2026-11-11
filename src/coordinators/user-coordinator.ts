import { toast } from "vue-sonner";
import type { Avatar, CurrentUser, GetLicensedAvatars, SearchAvatars } from "vrchat";
import type { Json, VrcxUser } from "../types/vrcx";
import { i18n } from "../plugins/i18n";
import { extractFileId } from "../shared/utils/file-utils";
import { findUserByDisplayName, getReadableProfileThemeColor } from "../shared/utils/user";
import { getWorldName } from "../shared/utils/world";
import { getUserMemo } from "./memo-coordinator";
import { avatarRequest } from "../api/avatar";
import { queryRequest } from "../api/query-request";
import { userRequest } from "../api/user";
import { requestJson } from "../api/request-json";
import { processBulk } from "../services/request";
import { AppDebug } from "../services/app-config";
import { database } from "../services/database";
import { watchState } from "../services/watch-state";
import { applyAvatar, showAvatarDialog } from "./avatar-coordinator";
import { runHandleUserUpdateFlow } from "./user-event-coordinator";
import { handleGroupRepresented } from "./group-membership-coordinator";
import { useAppearanceSettingsStore } from "../stores/settings/appearance";
import { useAuthStore } from "../stores/auth";
import { useAvatarStore } from "../stores/avatar";
import { useFavoriteStore } from "../stores/favorite";
import { useFriendStore } from "../stores/friend";
import { useGameStore } from "../stores/game";
import { useLocationStore } from "../stores/location";
import { useModerationStore } from "../stores/moderation";
import { useNotificationStore } from "../stores/notification";
import { useSearchStore } from "../stores/search";
import { removeAvatarFromCache } from "./avatar-coordinator";
import { useUiStore } from "../stores/ui";
import { useUserStore } from "../stores/user";
import { refreshStaleUserProfile } from "./user-profile-apply";

export const getRobotUrl = () => `${AppDebug.endpointDomain}/file/file_0e8c4e32-7444-44ea-ade4-313c010d4bae/1/file`;

export function logError(err: unknown) {
  console.error(err);
}

export type BioFeed = {
  created_at: string;
  type: "Bio";
  userId: string;
  displayName: string;
  bio: string;
  previousBio: string | null;
  bioLinks: string[];
  previousBioLinks: string[];
};

export function showUserDialog(userId: unknown) {
  if (!userId || typeof userId !== "string" || userId === "usr_00000000-0000-0000-0000-000000000000") {
    return;
  }
  const userStore = useUserStore();
  const uiStore = useUiStore();
  const friendStore = useFriendStore();
  const moderationStore = useModerationStore();
  const favoriteStore = useFavoriteStore();
  const locationStore = useLocationStore();
  const appearanceSettingsStore = useAppearanceSettingsStore();
  const t = i18n.global.t;

  const { currentUser, userDialog, showUserDialogHistory } = userStore;

  const isMainDialogOpen = uiStore.openDialog({
    type: "user",
    id: userId,
  });
  const D = userDialog;
  D.visible = true;
  if (isMainDialogOpen && D.id === userId) {
    uiStore.setDialogCrumbLabel("user", D.id, typeof D.ref.displayName === "string" && D.ref.displayName !== "" ? D.ref.displayName : D.id);
    userStore.applyUserDialogLocation(true);
    return;
  }
  D.id = userId;
  D.ref = {};
  D.publicProfileRef = {};
  D.memo = "";
  D.note = "";
  void getUserMemo(userId)
    .then((memo) => {
      if (memo.userId === userId) {
        D.memo = memo.memo;
      }
    })
    .catch(logError);

  D.loading = true;
  D.avatars = [];
  D.worlds = [];
  D.instance = {
    id: "",
    tag: "",
    $location: {},
    friendCount: 0,
    users: [],
    shortName: "",
    ref: {},
  };
  D.isRepresentedGroupLoading = true;
  D.representedGroup = {
    bannerId: "",
    bannerUrl: "",
    description: "",
    discriminator: "",
    groupId: "",
    id: "",
    iconUrl: "",
    isRepresenting: false,
    memberCount: 0,
    memberVisibility: "",
    name: "",
    ownerId: "",
    privacy: "",
    shortCode: "",
    $thumbnailUrl: "",
    $memberId: "",
  };
  D.lastSeen = "";
  D.joinCount = 0;
  D.timeSpent = 0;
  D.avatarModeration = 0;
  D.isHideAvatar = false;
  D.isShowAvatar = false;
  D.previousDisplayNames = [];
  D.dateFriended = "";
  D.unFriended = false;
  D.dateFriendedInfo = [];
  D.mutualFriendCount = 0;
  D.mutualGroupCount = 0;
  D.theme = {
    iconColor: "var(--muted-foreground)",
    buttonColor: "var(--primary)",
    subtextColor: "var(--muted-foreground)",
  };
  if (userId === currentUser.id) {
    void getWorldName(currentUser.homeLocation)
      .then((worldName) => {
        D.$homeLocationName = worldName;
      })
      .catch(logError);
  }
  updateUserDialogProfile();
  void AppApi.SendIpc("ShowUserDialog", userId).catch(logError);
  void queryRequest
    .fetch("user", {
      userId,
    })
    .catch((err: unknown) => {
      D.loading = false;
      D.id = "";
      D.visible = false;
      uiStore.jumpBackDialogCrumb();
      toast.error(t("message.user.load_failed"));
      throw err;
    })
    .then((args) => {
      if (args.ref.id === D.id) {
        D.loading = false;

        D.ref = args.ref;
        uiStore.setDialogCrumbLabel("user", D.id, args.ref.displayName ? args.ref.displayName : D.id);
        D.friend = friendStore.friends.get(D.id);
        D.isFriend = Boolean(D.friend);
        D.note = args.ref.note ?? "";
        D.incomingRequest = false;
        D.outgoingRequest = false;
        D.isBlock = false;
        D.isMute = false;
        D.isInteractOff = false;
        D.isMuteChat = false;
        for (const ref of moderationStore.cachedPlayerModerations.values()) {
          if (ref.targetUserId === D.id && ref.sourceUserId === currentUser.id) {
            if (ref.type === "block") {
              D.isBlock = true;
            } else if (ref.type === "mute") {
              D.isMute = true;
            } else if (ref.type === "interactOff") {
              D.isInteractOff = true;
            } else if (ref.type === "muteChat") {
              D.isMuteChat = true;
            }
          }
        }
        D.isFavorite = Boolean(favoriteStore.getCachedFavoritesByObjectId(D.id) ?? favoriteStore.isInAnyLocalFriendGroup(D.id));
        if (args.ref.friendRequestStatus === "incoming") {
          D.incomingRequest = true;
        } else if (args.ref.friendRequestStatus === "outgoing") {
          D.outgoingRequest = true;
        }
        let isInCurrentWorld = false;
        if (locationStore.lastLocation.playerList.has(args.ref.id)) {
          isInCurrentWorld = true;
        }
        if (userId !== currentUser.id && watchState.isFriendsLoaded) {
          void database
            .getUserStats(args.ref, isInCurrentWorld)
            .then(async (ref1) => {
              if (ref1.userId === D.id) {
                D.lastSeen = ref1.lastSeen;
                D.joinCount = ref1.joinCount;
                D.timeSpent = ref1.timeSpent;
              }
              const displayNameMap = ref1.previousDisplayNames;
              const userNotifications = await database.getFriendLogHistoryForUserId(D.id, ["DisplayName", "Friend", "Unfriend"]);
              const dateFriendedInfo = [];
              for (const notification of userNotifications) {
                if (notification.userId !== D.id) {
                  continue;
                }
                if (notification.type === "DisplayName") {
                  displayNameMap.set(notification.previousDisplayName ?? null, notification.created_at);
                }
                if (notification.type === "Friend" || (notification.type === "Unfriend" && !appearanceSettingsStore.hideUnfriends)) {
                  dateFriendedInfo.unshift(notification);
                }
              }
              D.dateFriendedInfo = dateFriendedInfo;
              const latestFriendedInfo = dateFriendedInfo[0];
              if (latestFriendedInfo !== undefined) {
                D.unFriended = latestFriendedInfo.type === "Unfriend";
                D.dateFriended = latestFriendedInfo.created_at ?? "";
              }
              displayNameMap.forEach((updatedAt, displayName) => {
                D.previousDisplayNames.push({
                  displayName,
                  updated_at: updatedAt,
                });
              });
            })
            .catch(logError);
          void AppApi.GetVRChatUserModeration(currentUser.id, userId)
            .then((result) => {
              D.avatarModeration = result;
              if (result === 4) {
                D.isHideAvatar = true;
              } else if (result === 5) {
                D.isShowAvatar = true;
              }
            })
            .catch(logError);
          if (!currentUser.hasSharedConnectionsOptOut) {
            try {
              void queryRequest
                .fetch("mutualCounts", { userId })
                .then((args) => {
                  if (args.params.userId === D.id) {
                    D.mutualFriendCount = args.json.friends;
                    D.mutualGroupCount = args.json.groups;
                  }
                })
                .catch(logError);
            } catch (error) {
              console.error(error);
            }
          }
        } else {
          D.previousDisplayNames = currentUser.pastDisplayNames;
          void database
            .getUserStats(args.ref, isInCurrentWorld)
            .then((ref1) => {
              if (ref1.userId === D.id) {
                D.lastSeen = ref1.lastSeen;
                D.joinCount = ref1.joinCount;
                D.timeSpent = ref1.timeSpent;
              }
            })
            .catch(logError);
        }
        void queryRequest
          .fetch("representedGroup", { userId })
          .then((args1) => {
            handleGroupRepresented(args1);
          })
          .catch(logError);
        D.visible = true;
        userStore.applyUserDialogLocation(true);
      }
    })
    .catch(logError);
  showUserDialogHistory.delete(userId);
  showUserDialogHistory.add(userId);
}

export function updateUserDialogProfile() {
  const userStore = useUserStore();
  const D = userStore.userDialog;
  const appearanceSettingsStore = useAppearanceSettingsStore();
  D.publicProfileRef = userStore.cachedProfiles.get(D.id);
  userRequest
    .getPublicProfile({ userId: D.id })
    .then((args1) => {
      if (args1.params.userId !== D.id) {
        return;
      }
      D.publicProfileRef = args1.json;
      if (appearanceSettingsStore.displayVRCProfileThemes) {
        D.theme = {
          iconColor: getReadableProfileThemeColor(args1.json.themeIconColor, "var(--muted-foreground)", appearanceSettingsStore.isDarkMode),
          buttonColor: getReadableProfileThemeColor(args1.json.themeButtonColor, "var(--primary)", appearanceSettingsStore.isDarkMode),
          subtextColor: getReadableProfileThemeColor(args1.json.themeSubtextColor, "var(--muted-foreground)", appearanceSettingsStore.isDarkMode),
        };
      }
    })
    .catch((err: unknown) => {
      console.error("Failed to fetch public profile", err);
      D.publicProfileRef = {};
    });
}

export function onPlayerTraveling(ref: { created_at: string; id: string; displayName: string; travelingToLocation?: string }) {
  const userStore = useUserStore();
  const gameStore = useGameStore();
  const locationStore = useLocationStore();
  const notificationStore = useNotificationStore();

  if (
    !gameStore.isGameRunning ||
    !locationStore.lastLocation.location ||
    locationStore.lastLocation.location !== ref.travelingToLocation ||
    ref.id === userStore.currentUser.id ||
    locationStore.lastLocation.playerList.has(ref.id)
  ) {
    return;
  }

  const onPlayerJoining = {
    created_at: new Date(ref.created_at).toJSON(),
    userId: ref.id,
    displayName: ref.displayName,
    type: "OnPlayerJoining",
  };
  notificationStore.queueFeedNoty(onPlayerJoining);
}

export async function handleUserUpdate(ref: VrcxUser, props: Record<string, true | [unknown, unknown]>) {
  void refreshStaleUserProfile(ref.id).catch(logError);
  await runHandleUserUpdateFlow(ref, props);
}

export async function refreshUserDialogAvatars(fileId?: string) {
  const userStore = useUserStore();
  const avatarStore = useAvatarStore();

  const D = userStore.userDialog;
  const userId = D.id;
  if (D.isAvatarsLoading) {
    return;
  }
  D.isAvatarsLoading = true;
  if (fileId) {
    D.loading = true;
  }
  const params: SearchAvatars["query"] = {
    n: 50,
    offset: 0,
    sort: "updated",
    order: "descending",
    releaseStatus: "all",
    user: "me",
  };
  for (const ref of avatarStore.cachedAvatars.values()) {
    if (ref.authorId === D.id) {
      removeAvatarFromCache(ref.id);
    }
  }
  const map = new Map<string, ReturnType<typeof applyAvatar>>();
  const licensedMap = new Map<string, ReturnType<typeof applyAvatar>>();
  await Promise.all([
    processBulk({
      fn: (fnParams: SearchAvatars["query"]) => avatarRequest.getAvatars(fnParams),
      N: -1,
      params,
      handle: (args: { json: Json<Avatar[]> }) => {
        for (const json of args.json) {
          const ref = applyAvatar(json);
          map.set(ref.id, ref);
        }
      },
    }),
    processBulk({
      fn: (fnParams: GetLicensedAvatars["query"]) => avatarRequest.getLicensedAvatars(fnParams),
      N: -1,
      params: { n: 100, offset: 0 },
      handle: (args: { json: Json<Avatar[]> }) => {
        for (const json of args.json) {
          const ref = applyAvatar(json);
          licensedMap.set(ref.id, ref);
        }
      },
      done: (isSuccess: boolean) => {
        if (isSuccess && userId === D.id) {
          userStore.sortUserDialogLicensedAvatars(Array.from(licensedMap.values()));
        }
      },
    }),
  ]);
  const array = Array.from(map.values());
  if (userId === D.id) {
    userStore.sortUserDialogAvatars(array);
  }
  D.isAvatarsLoading = false;
  if (fileId) {
    D.loading = false;
    for (const ref of array) {
      if (extractFileId(ref.imageUrl) === fileId) {
        showAvatarDialog(ref.id);
        return;
      }
    }
    toast.error("Own avatar not found");
  }
}

export async function lookupUser(ref: { userId?: string | undefined; displayName?: string | undefined }) {
  const userStore = useUserStore();
  const searchStore = useSearchStore();

  if (ref.userId) {
    showUserDialog(ref.userId);
    return;
  }
  if (!ref.displayName || ref.displayName.startsWith("ID:")) {
    return;
  }
  const found = findUserByDisplayName(userStore.cachedUsers, ref.displayName, userStore.cachedUserIdsByDisplayName);
  if (found) {
    showUserDialog(found.id);
    return;
  }
  searchStore.setSearchText(ref.displayName);
  await searchStore.searchUserByDisplayName(ref.displayName);
  for (const ctx of searchStore.searchUserResults) {
    if (ctx.displayName === ref.displayName) {
      searchStore.setSearchText("");
      searchStore.clearSearch();
      showUserDialog(ctx.id);
      return;
    }
  }
}

export function getCurrentUser() {
  const authStore = useAuthStore();
  return requestJson<Json<CurrentUser>>("auth/user", {
    method: "GET",
  }).then((json) => {
    const args = {
      json,
    };
    authStore.handleCurrentUserUpdate(json);
    return args;
  });
}
