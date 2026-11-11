import { reactive } from "vue";
import { toast } from "vue-sonner";
import type {
  ApiConfig,
  Avatar,
  CurrentUser,
  DeveloperType,
  GetLicensedAvatars,
  PublicProfile,
  SearchAvatars,
  UpdateUserRequest,
  User,
  UserStatus,
} from "vrchat";
import type { Json, VrcxUser } from "../types/vrcx";
import type { CurrentUserState } from "../stores/user-state";
import { i18n } from "../plugins/i18n";

import { arraysMatch } from "../shared/utils/base/array";
import { assignDefinedProps, computeUserPlatform, createDefaultUserRef, diffObjectProps, sanitizeUserJson } from "../shared/utils/user-transforms";
import { evictMapCache } from "../shared/utils/cache-utils";
import { extractFileId } from "../shared/utils/file-utils";
import { findUserByDisplayName, getReadableProfileThemeColor } from "../shared/utils/user";
import { getWorldName } from "../shared/utils/world";
import { isRealInstance } from "../shared/utils/instance";
import { parseLocation } from "../shared/utils/location-parser";
import { getUserMemo } from "./memo-coordinator";
import { avatarRequest } from "../api/avatar";
import { instanceRequest } from "../api/instance";
import { queryRequest } from "../api/query-request";
import { userRequest } from "../api/user";
import { requestJson } from "../api/request-json";
import { processBulk } from "../services/request";
import { AppDebug } from "../services/app-config";
import { database } from "../services/database";
import { patchUserFromEvent } from "../queries/entity-cache";
import { watchState } from "../services/watch-state";
import { applyAvatar, showAvatarDialog } from "./avatar-coordinator";
import { applyFavorite } from "./favorite-coordinator";
import { runAvatarSwapFlow, runFirstLoginFlow, runHomeLocationSyncFlow, runPostApplySyncFlow } from "./user-session-coordinator";
import { runHandleUserUpdateFlow } from "./user-event-coordinator";
import { runUpdateCurrentUserLocationFlow } from "./location-coordinator";
import { runUpdateFriendFlow } from "./friend-presence-coordinator";
import { userOnFriend } from "./friend-relationship-coordinator";
import { handleGroupRepresented } from "./group-membership-coordinator";
import { useAppearanceSettingsStore } from "../stores/settings/appearance";
import { useAuthStore } from "../stores/auth";
import { useAvatarStore } from "../stores/avatar";
import { useFavoriteStore } from "../stores/favorite";
import { useFriendStore } from "../stores/friend";
import { useGameStore } from "../stores/game";
import { useGeneralSettingsStore } from "../stores/settings/general";
import { useInstanceStore } from "../stores/instance";
import { useLocationStore } from "../stores/location";
import { useModerationStore } from "../stores/moderation";
import { useNotificationStore } from "../stores/notification";
import { usePhotonStore } from "../stores/photon";
import { useSearchStore } from "../stores/search";
import { syncFriendSearchIndex } from "./search-index-coordinator";
import { removeAvatarFromCache } from "./avatar-coordinator";
import { useSharedFeedStore } from "../stores/shared-feed";
import { useUiStore } from "../stores/ui";
import { useUserStore } from "../stores/user";
import { useFeedStore } from "../stores/feed";

const getRobotUrl = () => `${AppDebug.endpointDomain}/file/file_0e8c4e32-7444-44ea-ade4-313c010d4bae/1/file`;

function logError(err: unknown) {
  console.error(err);
}

type OptionalWithUndefined<T> = { [K in keyof T]?: T[K] | undefined };

function hasBioAndName<T extends { bio?: string; displayName?: string }>(profile: T): profile is T & { bio: string; displayName: string } {
  return typeof profile.bio === "string" && typeof profile.displayName === "string";
}

type BioFeed = {
  created_at: string;
  type: "Bio";
  userId: string;
  displayName: string;
  bio: string;
  previousBio: string | null;
  bioLinks: string[];
  previousBioLinks: string[];
};

type UserUpdate = OptionalWithUndefined<Omit<Json<User>, "last_activity" | "last_login" | "developerType" | "status">> & {
  developerType?: DeveloperType | "" | undefined;
  status?: UserStatus | "" | undefined;
  id: string;
  last_activity?: string | null | undefined;
  last_login?: string | null | undefined;
  location?: string | undefined;
  instanceId?: string | undefined;
  worldId?: string | undefined;
  travelingToLocation?: string | undefined;
  travelingToInstance?: string | undefined;
  travelingToWorld?: string | undefined;
};

export function applyPublicProfile(json: Json<PublicProfile> & { id: string }) {
  const { cachedProfiles } = useUserStore();
  const cachedRef = cachedProfiles.get(json.id);
  let ref: Json<PublicProfile>;
  if (typeof cachedRef === "undefined") {
    ref = reactive({ ...json });
    cachedProfiles.set(json.id, ref);
  } else {
    ref = cachedRef;
    assignDefinedProps(ref, json);
  }

  if (ref.hasVrcPlus && ref.badges?.every((x) => x.badgeId !== "bdg_754f9935-0f97-49d8-b857-95afb9b673fa")) {
    ref.badges.unshift({
      badgeId: "bdg_754f9935-0f97-49d8-b857-95afb9b673fa",
      badgeName: "Supporter",
      badgeDescription: "Supports VRChat through VRC+",
      badgeImageUrl: "https://assets.vrchat.com/badges/fa/bdgai_583f6b13-91ab-4e1b-974e-ab91600b06cb.png",
      hidden: true,
      showcased: false,
    });
  }
  if (useFriendStore().friends.has(json.id)) {
    void updateUserProfile(ref).catch(logError);
  }
  return ref;
}

async function updateUserProfile(ref: Json<PublicProfile>) {
  if (!ref.id || !hasBioAndName(ref)) {
    return;
  }
  const existing = await database.getUserProfile(ref.id);
  if (!existing) {
    database.setUserProfile({ id: ref.id, bio: ref.bio, bioLinks: ref.bioLinks ?? [] });
    return;
  }
  if (existing.bio === ref.bio && arraysMatch(existing.bioLinks, ref.bioLinks)) {
    return;
  }
  const feed: BioFeed = {
    created_at: new Date().toJSON(),
    type: "Bio",
    userId: ref.id,
    displayName: ref.displayName,
    bio: ref.bio,
    previousBio: existing.bio,
    bioLinks: ref.bioLinks ?? [],
    previousBioLinks: existing.bioLinks,
  };
  useNotificationStore().queueFeedNoty(feed);
  void useSharedFeedStore().addEntry(feed).catch(logError);
  const persistedFeed = await database.addBioToDatabase(feed);
  if (persistedFeed) {
    useFeedStore().addFeedEntry(persistedFeed);
  }
  database.setUserProfile({ id: ref.id, bio: ref.bio, bioLinks: ref.bioLinks ?? [] });
}

const PROFILE_REFRESH_INTERVAL = 7 * 24 * 60 * 60 * 1000;
const pendingProfileRefresh = new Set();

async function refreshStaleUserProfile(userId: string) {
  if (pendingProfileRefresh.has(userId)) {
    return;
  }
  pendingProfileRefresh.add(userId);
  try {
    const existing = await database.getUserProfile(userId);
    if (existing && existing.updatedAt !== null && Date.now() - Date.parse(existing.updatedAt) < PROFILE_REFRESH_INTERVAL) {
      return;
    }
    await userRequest.getPublicProfile({ userId });
  } catch (err) {
    console.error("Failed to refresh public profile", err);
  } finally {
    pendingProfileRefresh.delete(userId);
  }
}

export function applyUser(json: UserUpdate) {
  const userStore = useUserStore();
  const appearanceSettingsStore = useAppearanceSettingsStore();
  const friendStore = useFriendStore();
  const locationStore = useLocationStore();
  const instanceStore = useInstanceStore();
  const moderationStore = useModerationStore();
  const photonStore = usePhotonStore();

  const { currentUser, cachedUsers, currentTravelers, customUserTags, rebuildCachedUserDisplayNameIndex, setCachedUser, state, userDialog } = userStore;

  const cachedRef = cachedUsers.get(json.id);
  let ref: VrcxUser;
  let previousDisplayName: string | undefined;
  let hasPropChanged = false;
  let changedProps = Object.fromEntries(new Map<string, true | [unknown, unknown]>());
  sanitizeUserJson(json, getRobotUrl());
  if (typeof cachedRef === "undefined") {
    ref = reactive(createDefaultUserRef(json));
    const player = locationStore.lastLocation.playerList.get(json.id);
    if (player) {
      ref.$location_at = player.joinTime;
      ref.$online_for = player.joinTime;
    }
    if (ref.isFriend || ref.id === currentUser.id) {
      let newCount = state.instancePlayerCount.get(ref.location);
      if (typeof newCount === "undefined") {
        newCount = 0;
      }
      newCount++;
      state.instancePlayerCount.set(ref.location, newCount);
    }
    const tag = customUserTags.get(json.id);
    if (tag) {
      ref.$customTag = tag.tag;
      ref.$customTagColour = tag.colour;
    } else if (ref.$customTag) {
      ref.$customTag = "";
      ref.$customTagColour = "";
    }
    const { deletedCount } = evictMapCache(cachedUsers, friendStore.friends.size + 300, (_value, key) => friendStore.friends.has(key), {
      logLabel: "User cache cleanup",
    });
    if (deletedCount > 0) {
      setCachedUser(ref, "", { skipIndex: true });
      rebuildCachedUserDisplayNameIndex();
    } else {
      setCachedUser(ref);
    }
    void getUserMemo(ref.id).catch(logError);
    void runUpdateFriendFlow(ref.id).catch(logError);
  } else {
    ref = cachedRef;
    if (json.state !== "online") {
      void runUpdateFriendFlow(ref.id, json.state).catch(logError);
    }
    previousDisplayName = ref.displayName;
    const { hasPropChanged: _hasPropChanged, changedProps: _changedProps } = diffObjectProps(ref, json, arraysMatch);
    assignDefinedProps(ref, json);
    setCachedUser(ref, previousDisplayName);
    hasPropChanged = _hasPropChanged;
    changedProps = _changedProps;
  }
  ref.$moderations = moderationStore.getUserModerations(ref.id);
  ref.$isVRCPlus = ref.tags.includes("system_supporter");
  appearanceSettingsStore.applyUserTrustLevel(ref);
  userStore.applyUserLanguage(ref);
  ref.$platform = computeUserPlatform(ref.platform, ref.last_platform);

  if (ref.location === "traveling") {
    ref.$location = parseLocation(ref.travelingToLocation);
    if (!currentTravelers.has(ref.id) && ref.travelingToLocation) {
      const travelRef = reactive({
        created_at: new Date().toJSON(),
        ...ref,
      });
      currentTravelers.set(ref.id, travelRef);
      onPlayerTraveling(travelRef);
    }
  } else {
    ref.$location = parseLocation(ref.location);
    currentTravelers.delete(ref.id);
  }
  if (!instanceStore.cachedInstances.has(ref.$location.tag ?? "") && isRealInstance(ref.location)) {
    void instanceRequest
      .getInstance({
        worldId: ref.$location.worldId ?? "",
        instanceId: ref.$location.instanceId ?? "",
      })
      .catch(logError);
  }
  const friendCtx = friendStore.friends.get(ref.id);
  if (friendCtx) {
    friendCtx.ref = ref;
    friendCtx.name = ref.displayName;
    syncFriendSearchIndex(friendCtx);
    friendStore.reindexSortedFriend(friendCtx);
  }
  if (ref.id === currentUser.id) {
    if (ref.status) {
      currentUser.status = ref.status;
    }
    runUpdateCurrentUserLocationFlow();
  }

  const playerListRef = locationStore.lastLocation.playerList.get(ref.id);
  if (playerListRef) {
    if (!locationStore.lastLocation.friendList.has(ref.id) && friendStore.friends.has(ref.id)) {
      const userMap = {
        displayName: ref.displayName,
        userId: ref.id,
        joinTime: playerListRef.joinTime,
      };
      locationStore.lastLocation.friendList.set(ref.id, userMap);
    }
    if (locationStore.lastLocation.friendList.has(ref.id) && !friendStore.friends.has(ref.id)) {
      locationStore.lastLocation.friendList.delete(ref.id);
    }
    photonStore.photonLobby.forEach((ref1, id) => {
      if (ref1?.displayName === ref.displayName && ref1 !== ref) {
        photonStore.photonLobby.set(id, ref);
        if (photonStore.photonLobbyCurrent.has(id)) {
          photonStore.photonLobbyCurrent.set(id, ref);
        }
      }
    });
    instanceStore.getCurrentInstanceUserList();
  }
  if (ref.state === "online") {
    void runUpdateFriendFlow(ref.id, ref.state).catch(logError);
  }
  void applyFavorite("friend", ref.id).catch(logError);
  userOnFriend(ref);
  const D = userDialog;
  if (D.visible && D.id === ref.id) {
    D.ref = ref;
    D.note = ref.note ?? "";
    D.incomingRequest = false;
    D.outgoingRequest = false;
    if (D.ref.friendRequestStatus === "incoming") {
      D.incomingRequest = true;
    } else if (D.ref.friendRequestStatus === "outgoing") {
      D.outgoingRequest = true;
    }
  }
  if (hasPropChanged) {
    const locationChange = changedProps["location"];
    if (Array.isArray(locationChange) && locationChange[0] !== "traveling") {
      if (playerListRef) {
        ref.$location_at = playerListRef.joinTime;
      } else {
        const ts = Date.now();
        locationChange.push(ts - ref.$location_at);
        ref.$location_at = ts;
      }
    }
    void handleUserUpdate(ref, changedProps).catch(logError);
    if (AppDebug.debugUserDiff) {
      delete changedProps["last_login"];
      delete changedProps["last_activity"];
      if (Object.keys(changedProps).length !== 0) {
        console.log(">", ref.displayName, changedProps);
      }
    }
  }
  patchUserFromEvent(ref);
  return ref;
}

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

function onPlayerTraveling(ref: { created_at: string; id: string; displayName: string; travelingToLocation?: string }) {
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

async function handleUserUpdate(ref: VrcxUser, props: Record<string, true | [unknown, unknown]>) {
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

export function handleConfig(args: { json: Json<ApiConfig>; ref?: Json<ApiConfig> }) {
  const authStore = useAuthStore();
  const userStore = useUserStore();

  const ref = {
    ...args.json,
  };
  args.ref = ref;
  authStore.setCachedConfig(ref);
  if (typeof ref.whiteListedAssetUrls !== "object") {
    console.error("Invalid config whiteListedAssetUrls");
  }
  void AppApi.PopulateImageHosts(JSON.stringify(ref.whiteListedAssetUrls)).catch(logError);
  const languages = ref.constants.LANGUAGE.SPOKEN_LANGUAGE_OPTIONS;
  if (!languages) {
    return;
  }
  userStore.setSubsetOfLanguages(languages);
}

function createFallbackCurrentUser(json: Json<CurrentUser>): CurrentUserState {
  return {
    acceptedPrivacyVersion: 0,
    acceptedTOSVersion: 0,
    accountDeletionDate: null,
    accountDeletionLog: null,
    accountStanding: "",
    activeFriends: [],
    ageVerificationStatus: "hidden",
    ageVerified: false,
    allowAvatarCopying: false,
    appleDetails: {},
    appleId: "",
    badges: [],
    bannerColor: "",
    bannerType: "color",
    bannerUrl: "",
    bio: "",
    bioLinks: [],
    completedTutorials: [],
    currentAvatar: "",
    currentAvatarImageUrl: "",
    currentAvatarTags: [],
    currentAvatarThumbnailImageUrl: "",
    date_joined: "",
    developerType: "none",
    discordDetails: {
      global_name: "",
      id: "",
    },
    discordId: "",
    displayName: "",
    emailVerified: false,
    fallbackAvatar: "",
    friendGroupNames: [],
    friendKey: "",
    friends: [],
    googleDetails: {},
    googleId: "",
    hasAcceptedDiscordSocialSDKPerms: false,
    hasBirthday: false,
    hasDiscordFriendsOptOut: false,
    hasEmail: false,
    hasLoggedInFromClient: false,
    hasPendingEmail: false,
    hasSharedConnectionsOptOut: false,
    hideContentFilterSettings: false,
    homeLocation: "",
    id: "",
    isAdult: true,
    isBoopingEnabled: false,
    isEconomyCreator: false,
    isFriend: false,
    isTemporary: false,
    iconFrame: "",
    iconUrl: "",
    last_activity: "",
    last_login: "",
    last_mobile: null,
    last_platform: "",
    nameplateEffect: "",
    obfuscatedEmail: "",
    obfuscatedPendingEmail: "",
    oculusId: "",
    offlineFriends: [],
    onlineFriends: [],
    pastDisplayNames: [],
    picoId: "",
    platform_history: [],
    presence: {
      avatarThumbnail: "",
      currentAvatarTags: "",
      debugflag: "",
      displayName: "",
      groups: [],
      id: "",
      instance: "",
      instanceType: "",
      platform: "",
      profilePicOverride: "",
      status: "",
      travelingToInstance: "",
      travelingToWorld: "",
      userIcon: "",
      world: "",
      ...json.presence,
    },
    profileEffect: "",
    profilePicOverride: "",
    profilePicOverrideThumbnail: "",
    pronouns: "",
    pronounsHistory: [],
    queuedInstance: "",
    receiveMobileInvitations: false,
    state: "offline",
    status: "offline",
    statusDescription: "",
    statusFirstTime: false,
    statusHistory: [],
    steamDetails: {},
    steamId: "",
    tags: [],
    temporaryExpiryDate: null,
    twitchDetails: {
      display_name: "",
      id: "",
      login: "",
      profile_image_url: "",
    },
    twitchId: "",
    twoFactorAuthEnabled: false,
    twoFactorAuthEnabledDate: null,
    unsubscribe: false,
    updated_at: "",
    userIcon: "",
    userLanguage: "",
    userLanguageCode: "",
    username: "",
    usesGeneratedPassword: false,
    viveId: "",

    $online_for: null,
    $offline_for: null,
    $location_at: Date.now(),
    $travelingToTime: Date.now(),
    $previousAvatarSwapTime: null,
    $homeLocation: {},
    $isVRCPlus: false,
    $isModerator: false,
    $isTroll: false,
    $isProbableTroll: false,
    $trustLevel: "Visitor",
    $trustClass: "x-tag-untrusted",
    $userColour: "",
    $trustSortNum: 1,
    $languages: [],
    $locationTag: "",
    $travelingToLocation: "",
  };
}

export function applyCurrentUser(json: Json<CurrentUser>) {
  const userStore = useUserStore();
  const appearanceSettingsStore = useAppearanceSettingsStore();
  const authStore = useAuthStore();
  const gameStore = useGameStore();
  const locationStore = useLocationStore();

  authStore.setAttemptingAutoLogin(false);
  let ref: CurrentUserState = userStore.currentUser;
  runAvatarSwapFlow({
    json,
    ref,
    isLoggedIn: watchState.isLoggedIn,
  });
  if (watchState.isLoggedIn) {
    assignDefinedProps(ref, json);
  } else {
    ref = createFallbackCurrentUser(json);
    assignDefinedProps(ref, json);
    runFirstLoginFlow(ref);
  }

  ref.$isVRCPlus = ref.tags.includes("system_supporter");
  appearanceSettingsStore.applyUserTrustLevel(ref);
  userStore.applyUserLanguage(ref);
  userStore.applyPresenceLocation(ref);
  runPostApplySyncFlow(ref);
  runHomeLocationSyncFlow(ref);

  const $location = parseLocation(locationStore.lastLocation.location);
  const $travelingLocation = parseLocation(locationStore.lastLocationDestination);
  let location = locationStore.lastLocation.location;
  let instanceId = $location.instanceId;
  let worldId = $location.worldId;
  let travelingToLocation = locationStore.lastLocationDestination;
  let travelingToWorld = $travelingLocation.worldId;
  let travelingToInstance = $travelingLocation.instanceId;
  if (!gameStore.isGameRunning && json.presence) {
    if (isRealInstance(json.presence.world)) {
      location = `${json.presence.world}:${json.presence.instance}`;
    } else {
      location = json.presence.world ?? "";
    }
    if (isRealInstance(json.presence.travelingToWorld)) {
      travelingToLocation = `${json.presence.travelingToWorld}:${json.presence.travelingToInstance}`;
    } else {
      travelingToLocation = json.presence.travelingToWorld ?? "";
    }
    instanceId = json.presence.instance ?? "";
    worldId = json.presence.world ?? "";
    travelingToInstance = json.presence.travelingToInstance ?? "";
    travelingToWorld = json.presence.travelingToWorld ?? "";
  }
  const userRef = applyUser({
    ageVerificationStatus: json.ageVerificationStatus,
    ageVerified: json.ageVerified,
    allowAvatarCopying: json.allowAvatarCopying,
    bannerColor: json.bannerColor,
    bannerType: json.bannerType,
    bannerUrl: json.bannerUrl,
    date_joined: json.date_joined,
    developerType: json.developerType,
    discordId: json.discordId,
    displayName: json.displayName,
    friendKey: json.friendKey,
    iconFrame: json.iconFrame,
    iconUrl: json.iconUrl,
    id: json.id,
    isEconomyCreator: json.isEconomyCreator,
    isFriend: json.isFriend,
    last_activity: json.last_activity,
    last_login: json.last_login,
    last_mobile: json.last_mobile,
    last_platform: json.last_platform,
    nameplateEffect: json.nameplateEffect,
    platform: json.platform,
    profileEffect: json.profileEffect,
    pronouns: json.pronouns,
    state: json.state,
    status: json.status,
    statusDescription: json.statusDescription,
    tags: json.tags,
    location,
    instanceId,
    worldId,
    travelingToLocation,
    travelingToInstance,
    travelingToWorld,
  });

  userRef.$online_for = userStore.currentUser.$online_for;
  userRef.$offline_for = userStore.currentUser.$offline_for;
  userRef.$active_for = null;
  userRef.$location_at = userStore.currentUser.$location_at;
  userRef.$travelingToTime = userStore.currentUser.$travelingToTime;
  if (json.presence?.platform) {
    userRef.platform = json.presence.platform;
  }

  return ref;
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
