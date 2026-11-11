import { reactive } from "vue";
import type { DeveloperType, PublicProfile, User, UserStatus } from "vrchat";
import type { Json, VrcxUser } from "../types/vrcx";
import { arraysMatch } from "../shared/utils/base/array";
import { assignDefinedProps, computeUserPlatform, createDefaultUserRef, diffObjectProps, sanitizeUserJson } from "../shared/utils/user-transforms";
import { evictMapCache } from "../shared/utils/cache-utils";
import { isRealInstance } from "../shared/utils/instance";
import { parseLocation } from "../shared/utils/location-parser";
import { getUserMemo } from "./memo-coordinator";
import { instanceRequest } from "../api/instance";
import { userRequest } from "../api/user";
import { AppDebug } from "../services/app-config";
import { database } from "../services/database";
import { patchUserFromEvent } from "../queries/entity-cache";
import { applyFavorite } from "./favorite-sync";
import { runUpdateCurrentUserLocationFlow } from "./location-coordinator";
import { runUpdateFriendFlow } from "./friend-presence-coordinator";
import { userOnFriend } from "./friend-relationship-coordinator";
import { useAppearanceSettingsStore } from "../stores/settings/appearance";
import { useFriendStore } from "../stores/friend";
import { useInstanceStore } from "../stores/instance";
import { useLocationStore } from "../stores/location";
import { useModerationStore } from "../stores/moderation";
import { useNotificationStore } from "../stores/notification";
import { usePhotonStore } from "../stores/photon";
import { syncFriendSearchIndex } from "./search-index-coordinator";
import { useSharedFeedStore } from "../stores/shared-feed";
import { useUserStore } from "../stores/user";
import { useFeedStore } from "../stores/feed";
import type { BioFeed } from "./user-coordinator";
import { getRobotUrl, handleUserUpdate, logError, onPlayerTraveling } from "./user-coordinator";

type OptionalWithUndefined<T> = { [K in keyof T]?: T[K] | undefined };

function hasBioAndName<T extends { bio?: string; displayName?: string }>(profile: T): profile is T & { bio: string; displayName: string } {
  return typeof profile.bio === "string" && typeof profile.displayName === "string";
}

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

export async function refreshStaleUserProfile(userId: string) {
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
