import { getGroupName } from "../shared/utils/group";
import { getWorldName } from "../shared/utils/world";
import { parseLocation } from "../shared/utils/location-parser";
import { AppDebug } from "../services/app-config";
import { database } from "../services/database";
import { getAvatarName } from "./avatar-coordinator";
import { useFeedStore } from "../stores/feed";
import { useFriendStore } from "../stores/friend";
import { useGroupStore } from "../stores/group";
import { useInstanceStore } from "../stores/instance";
import { useNotificationStore } from "../stores/notification";
import { useSharedFeedStore } from "../stores/shared-feed";
import { useUserStore } from "../stores/user";
import { useWorldStore } from "../stores/world";
import { logError } from "../stores/notification/errors";
import type { VrcxUser } from "../types/vrcx";

type UserChange = true | [unknown, unknown];

type UserChangeProps = {
  location?: UserChange;
  state?: UserChange;
  bannerUrl?: UserChange;
  iconUrl?: UserChange;
  status?: UserChange;
  statusDescription?: UserChange;
  note?: UserChange;
};

type AvatarInfo = {
  ownerId: string;
  avatarName: string;
};

type GpsFeed = {
  created_at: string;
  type: "GPS";
  userId: string;
  displayName: string;
  location: string;
  worldName: string;
  groupName: string;
  previousLocation: string;
  time: number | null;
};

type AvatarFeed = {
  created_at: string;
  type: "Avatar";
  userId: string;
  displayName: string;
  ownerId: string;
  previousOwnerId: string;
  avatarName: string;
  previousAvatarName: string;
  currentAvatarImageUrl: string;
  currentAvatarThumbnailImageUrl: string;
  previousCurrentAvatarImageUrl: string;
  previousCurrentAvatarThumbnailImageUrl: string;
};

type StatusFeed = {
  created_at: string;
  type: "Status";
  userId: string;
  displayName: string;
  status: string;
  statusDescription: string;
  previousStatus: string;
  previousStatusDescription: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function fieldOf(value: unknown, key: string): unknown {
  return isRecord(value) ? value[key] : undefined;
}

function changeAt(change: true | [unknown, unknown] | undefined, index: number): unknown {
  if (!Array.isArray(change)) {
    return undefined;
  }
  const values: unknown[] = change;
  return values[index];
}

function textAt(change: true | [unknown, unknown] | undefined, index: number): string {
  const value = changeAt(change, index);
  return typeof value === "string" ? value : "";
}

function numberAt(change: true | [unknown, unknown] | undefined, index: number): number | undefined {
  const value = changeAt(change, index);
  return typeof value === "number" ? value : undefined;
}

function toAvatarInfo(value: unknown): AvatarInfo {
  const ownerId = fieldOf(value, "ownerId");
  const avatarName = fieldOf(value, "avatarName");
  if (typeof ownerId === "string" && typeof avatarName === "string") {
    return { ownerId, avatarName };
  }
  return { ownerId: "", avatarName: "" };
}

async function lookupAvatarInfo(imageUrl: string): Promise<AvatarInfo> {
  try {
    return toAvatarInfo(await getAvatarName(imageUrl));
  } catch (err) {
    console.log(err);
    return { ownerId: "", avatarName: "" };
  }
}

export async function runHandleUserUpdateFlow(
  ref: VrcxUser,
  props: UserChangeProps,
  { now = Date.now, nowIso = () => new Date().toJSON() }: { now?: () => number; nowIso?: () => string } = {}
): Promise<void> {
  const friendStore = useFriendStore();
  const userStore = useUserStore();
  const worldStore = useWorldStore();
  const groupStore = useGroupStore();
  const instanceStore = useInstanceStore();
  const feedStore = useFeedStore();
  const notificationStore = useNotificationStore();
  const sharedFeedStore = useSharedFeedStore();

  const { state, userDialog, applyUserDialogLocation, checkNote } = userStore;

  const friend: unknown = friendStore.friends.get(ref.id);
  if (typeof friend === "undefined") {
    return;
  }

  const queueAvatarFeed = async (currentUrl: string, previousUrl: string, avatarInfo: AvatarInfo) => {
    const previousAvatarInfo = await lookupAvatarInfo(previousUrl);
    const feed: AvatarFeed = {
      created_at: nowIso(),
      type: "Avatar",
      userId: ref.id,
      displayName: ref.displayName,
      ownerId: avatarInfo.ownerId,
      previousOwnerId: previousAvatarInfo.ownerId,
      avatarName: avatarInfo.avatarName,
      previousAvatarName: previousAvatarInfo.avatarName,
      currentAvatarImageUrl: avatarInfo.ownerId ? currentUrl : "",
      currentAvatarThumbnailImageUrl: avatarInfo.ownerId ? currentUrl : "",
      previousCurrentAvatarImageUrl: previousAvatarInfo.ownerId ? previousUrl : "",
      previousCurrentAvatarThumbnailImageUrl: previousAvatarInfo.ownerId ? previousUrl : "",
    };
    notificationStore.queueFeedNoty(feed);
    sharedFeedStore.addEntry(feed).catch(logError);
    const persistedFeed = await database.addAvatarToDatabase(feed);
    if (persistedFeed) {
      feedStore.addFeedEntry(persistedFeed);
    }
  };

  if (props.location) {
    const previousLocation = textAt(props.location, 1);
    const newLocation = textAt(props.location, 0);
    const previousCount: unknown = state.instancePlayerCount.get(previousLocation);
    if (typeof previousCount === "number") {
      const oldCount = previousCount - 1;
      if (oldCount <= 0) {
        state.instancePlayerCount.delete(previousLocation);
      } else {
        state.instancePlayerCount.set(previousLocation, oldCount);
      }
    }
    const newCountBefore: unknown = state.instancePlayerCount.get(newLocation);
    const newCount = typeof newCountBefore === "number" ? newCountBefore + 1 : 1;
    state.instancePlayerCount.set(newLocation, newCount);

    const previousLocationL = parseLocation(previousLocation);
    const newLocationL = parseLocation(newLocation);
    if (previousLocationL.tag === fieldOf(userDialog.$location, "tag") || newLocationL.tag === fieldOf(userDialog.$location, "tag")) {
      applyUserDialogLocation(true);
    }
    if (previousLocationL.worldId === worldStore.worldDialog.id || newLocationL.worldId === worldStore.worldDialog.id) {
      instanceStore.applyWorldDialogInstances();
    }
    if (previousLocationL.groupId === groupStore.groupDialog.id || newLocationL.groupId === groupStore.groupDialog.id) {
      instanceStore.applyGroupDialogInstances();
    }
  }
  if (
    !props.state &&
    props.location &&
    changeAt(props.location, 0) !== "offline" &&
    changeAt(props.location, 0) !== "" &&
    changeAt(props.location, 1) !== "offline" &&
    changeAt(props.location, 1) !== "" &&
    changeAt(props.location, 0) !== "traveling"
  ) {
    let previousLocation = textAt(props.location, 1);
    const newLocation = textAt(props.location, 0);
    let time = numberAt(props.location, 2);
    if (previousLocation === "traveling" && ref.$previousLocation) {
      previousLocation = ref.$previousLocation;
      const travelTime = now() - ref.$travelingToTime;
      time = (time ?? Number.NaN) - travelTime;
      if (time < 0) {
        time = 0;
      }
    }
    if (AppDebug.debugFriendState && previousLocation) {
      console.log(`${ref.displayName} GPS ${previousLocation} -> ${newLocation}`);
    }
    if (previousLocation === "offline") {
      previousLocation = "";
    }
    if (!previousLocation) {
      if (AppDebug.debugFriendState) {
        console.log(ref.displayName, "Ignoring GPS, no previous location", newLocation);
      }
    } else if (ref.$previousLocation === newLocation) {
      ref.$location_at = now() - (time ?? Number.NaN);
    } else {
      const worldName = await getWorldName(newLocation);
      const groupName = await getGroupName(newLocation);
      const feed: GpsFeed = {
        created_at: nowIso(),
        type: "GPS",
        userId: ref.id,
        displayName: ref.displayName,
        location: newLocation,
        worldName,
        groupName,
        previousLocation,
        time: time ?? null,
      };
      notificationStore.queueFeedNoty(feed);
      sharedFeedStore.addEntry(feed).catch(logError);
      const persistedFeed = await database.addGPSToDatabase(feed);
      if (persistedFeed) {
        feedStore.addFeedEntry(persistedFeed);
      }

      ref.$previousLocation = "";
      ref.$travelingToTime = now();
    }
  }
  if (props.location && changeAt(props.location, 0) === "traveling" && changeAt(props.location, 1) !== "traveling") {
    ref.$previousLocation = textAt(props.location, 1);
    ref.$travelingToTime = now();
  }
  if (ref.bannerType === "avatarBanner" && props.bannerUrl && textAt(props.bannerUrl, 0)) {
    const currentBannerUrl = textAt(props.bannerUrl, 0);
    const previousBannerUrl = textAt(props.bannerUrl, 1);
    const avatarInfo = await lookupAvatarInfo(currentBannerUrl);
    if (avatarInfo.ownerId) {
      await queueAvatarFeed(currentBannerUrl, previousBannerUrl, avatarInfo);
    }
  } else if (props.iconUrl && textAt(props.iconUrl, 0)) {
    const currentIconUrl = textAt(props.iconUrl, 0);
    const previousIconUrl = textAt(props.iconUrl, 1);
    const avatarInfo = await lookupAvatarInfo(currentIconUrl);
    if (avatarInfo.ownerId) {
      await queueAvatarFeed(currentIconUrl, previousIconUrl, avatarInfo);
    }
  }

  if ((props.status && changeAt(props.status, 0) !== "offline" && changeAt(props.status, 1) !== "offline") || (!props.status && props.statusDescription)) {
    const refStatus: unknown = ref.status;
    let status = "";
    let previousStatus = "";
    let statusDescription = "";
    let previousStatusDescription = "";
    if (props.status) {
      status = textAt(props.status, 0);
      previousStatus = textAt(props.status, 1);
    } else if (typeof refStatus === "string" && refStatus) {
      status = refStatus;
      previousStatus = refStatus;
    }
    if (props.statusDescription) {
      statusDescription = textAt(props.statusDescription, 0);
      previousStatusDescription = textAt(props.statusDescription, 1);
    } else if (ref.statusDescription) {
      statusDescription = ref.statusDescription;
      previousStatusDescription = ref.statusDescription;
    }
    const feed: StatusFeed = {
      created_at: nowIso(),
      type: "Status",
      userId: ref.id,
      displayName: ref.displayName,
      status,
      statusDescription,
      previousStatus,
      previousStatusDescription,
    };
    notificationStore.queueFeedNoty(feed);
    sharedFeedStore.addEntry(feed).catch(logError);
    const persistedFeed = await database.addStatusToDatabase(feed);
    if (persistedFeed) {
      feedStore.addFeedEntry(persistedFeed);
    }
  }
  const newNote = changeAt(props.note, 0);
  if (props.note && newNote !== null && newNote !== changeAt(props.note, 1)) {
    checkNote(ref.id, typeof newNote === "string" ? newNote : undefined).catch(logError);
  }
}
