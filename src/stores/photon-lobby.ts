import type { Ref } from "vue";

import { checkVRChatCache } from "../coordinators/cache-coordinator";
import { removeFromArray } from "../shared/utils/base/array";
import { replaceBioSymbols } from "../shared/utils/base/string";
import { timeToText } from "../shared/utils/base/format";
import { userRequest } from "../api/user";
import { database } from "../services/database";
import { applyUser } from "../coordinators/user-profile-apply";
import type { GameLogEntry } from "./gameLog/types";
import type {
  PhotonEventEntry,
  PhotonGameLogEntry,
  PhotonId,
  PhotonJointime,
  PhotonLobbyEntry,
  PhotonLobbyUser,
  PhotonModerationAgainst,
  PhotonModerationRequest,
  PhotonModerationRow,
  PhotonOperationResponse,
  PhotonPortal,
  PhotonUserInfo,
  PhotonUserPayload,
} from "./photon-types";
import { isCacheHit, isModerationRow, isPhotonLobbyUser } from "./photon-guards";
import { logPhotonError } from "./photon-errors";
import type { useUserStore } from "./user";
import type { useGameLogStore } from "./gameLog";
import type { useNotificationStore } from "./notification";
import type { useLocationStore } from "./location";
import type { useSharedFeedStore } from "./shared-feed";
import type { createPhotonAvatar } from "./photon-avatar";

export type CreatePhotonLobbyDeps = {
  userStore: ReturnType<typeof useUserStore>;
  gameLogStore: ReturnType<typeof useGameLogStore>;
  notificationStore: ReturnType<typeof useNotificationStore>;
  locationStore: ReturnType<typeof useLocationStore>;
  sharedFeedStore: ReturnType<typeof useSharedFeedStore>;
  photonLobby: Ref<Map<PhotonId, PhotonLobbyEntry | undefined>>;
  photonLobbyMaster: Ref<number>;
  photonLobbyCurrentUser: Ref<number>;
  photonLobbyUserData: Ref<Map<PhotonId, PhotonLobbyUser>>;
  photonLobbyCurrent: Ref<Map<PhotonId, PhotonLobbyEntry | undefined>>;
  photonLobbyLastModeration: Ref<Map<PhotonId, string>>;
  photonLobbyJointime: Ref<Map<PhotonId, PhotonJointime>>;
  photonLobbyActivePortals: Ref<Map<PhotonId, PhotonPortal>>;
  photonEvent7List: Ref<Map<PhotonId, string>>;
  moderationEventQueue: Ref<Map<PhotonId, PhotonModerationRequest>>;
  moderationAgainstTable: Ref<PhotonModerationAgainst[]>;
  addEntryPhotonEvent: (input: PhotonEventEntry) => void;
  getDisplayNameFromPhotonId: (photonId: PhotonId) => string;
  getUserIdFromPhotonId: (photonId: PhotonId) => string;
  parsePhotonAvatarChange: ReturnType<typeof createPhotonAvatar>["parsePhotonAvatarChange"];
  parsePhotonGroupChange: ReturnType<typeof createPhotonAvatar>["parsePhotonGroupChange"];
  parsePhotonAvatar: ReturnType<typeof createPhotonAvatar>["parsePhotonAvatar"];
  safeParseInt: ReturnType<typeof createPhotonAvatar>["safeParseInt"];
};

export function createPhotonLobby(deps: CreatePhotonLobbyDeps) {
  const {
    userStore,
    gameLogStore,
    notificationStore,
    locationStore,
    sharedFeedStore,
    photonLobby,
    photonLobbyMaster,
    photonLobbyCurrentUser,
    photonLobbyUserData,
    photonLobbyCurrent,
    photonLobbyLastModeration,
    photonLobbyJointime,
    photonLobbyActivePortals,
    photonEvent7List,
    moderationEventQueue,
    moderationAgainstTable,
    addEntryPhotonEvent,
    getDisplayNameFromPhotonId,
    getUserIdFromPhotonId,
    parsePhotonAvatarChange,
    parsePhotonGroupChange,
    parsePhotonAvatar,
    safeParseInt,
  } = deps;

  function parseOperationResponse(data: PhotonOperationResponse, dateTime: string) {
    switch (data.OperationCode) {
      case 226: {
        const parameters = data.Parameters;
        const masterId = parameters[248]?.[248];
        if (masterId !== undefined) {
          setPhotonLobbyMaster(masterId);
        }
        const currentUserId = parameters[254];
        if (currentUserId !== undefined) {
          photonLobbyCurrentUser.value = currentUserId;
        }
        const users = parameters[249];
        if (users !== undefined) {
          for (const [key, user] of Object.entries(users)) {
            const idNum = safeParseInt(key);
            if (idNum === null) continue;
            if (!user?.user) continue;
            parsePhotonUser(idNum, user.user, dateTime).catch(logPhotonError);
            if (user.avatarDict) {
              parsePhotonAvatarChange(idNum, user.user, user.avatarDict, dateTime);
              parsePhotonAvatar(user.avatarDict);
            }
            if (user.favatarDict) {
              parsePhotonAvatar(user.favatarDict);
            }
            if (typeof user.groupOnNameplate !== "undefined") {
              parsePhotonGroupChange(idNum, user.user, user.groupOnNameplate, dateTime).catch(logPhotonError);
            }
            let hasInstantiated: boolean | undefined = false;
            const lobbyJointime = photonLobbyJointime.value.get(idNum);
            if (typeof lobbyJointime !== "undefined") {
              hasInstantiated = lobbyJointime.hasInstantiated;
            }
            photonLobbyJointime.value.set(idNum, {
              joinTime: Date.parse(dateTime),
              hasInstantiated,
              inVRMode: user.inVRMode,
              avatarEyeHeight: user.avatarEyeHeight,
              canModerateInstance: user.canModerateInstance,
              groupOnNameplate: user.groupOnNameplate,
              showGroupBadgeToOthers: user.showGroupBadgeToOthers,
              showSocialRank: user.showSocialRank,
              useImpostorAsFallback: user.useImpostorAsFallback,
              platform: user.platform,
            });
          }
        }
        if (typeof parameters[252] !== "undefined") {
          parsePhotonLobbyIds(parameters[252]);
        }
        photonEvent7List.value = new Map();
        break;
      }
    }
  }

  async function addPhotonEventToGameLog(entry: PhotonGameLogEntry) {
    notificationStore.queueGameLogNoty(entry);
    let persistedEntry: GameLogEntry | undefined;
    if (entry.type === "PortalSpawn") {
      persistedEntry = await database.addGamelogPortalSpawnToDatabase({
        created_at: entry.created_at,
        type: entry.type,
        displayName: entry.displayName ?? null,
        location: entry.location ?? null,
        userId: entry.userId ?? null,
        instanceId: entry.instanceId ?? null,
        worldName: entry.worldName ?? null,
      });
    } else if (entry.type === "Event") {
      persistedEntry = await database.addGamelogEventToDatabase({
        created_at: entry.created_at,
        type: entry.type,
        data: entry.data ?? null,
      });
    }
    if (persistedEntry) {
      gameLogStore.addGameLog(persistedEntry);
    }
  }

  function parsePhotonLobbyIds(lobbyIds: number[] | undefined) {
    if (!Array.isArray(lobbyIds)) {
      return;
    }
    lobbyIds.forEach((id) => {
      if (!photonLobby.value.has(id)) {
        photonLobby.value.set(id, undefined);
      }
      if (!photonLobbyCurrent.value.has(id)) {
        photonLobbyCurrent.value.set(id, undefined);
      }
    });
    for (const id of photonLobbyCurrent.value.keys()) {
      if (!lobbyIds.includes(id)) {
        photonLobbyCurrent.value.delete(id);
        photonEvent7List.value.delete(id);
      }
    }
  }

  function setPhotonLobbyMaster(photonId: PhotonId, gameLogDate?: string) {
    if (photonLobbyMaster.value !== photonId) {
      if (photonLobbyMaster.value !== 0) {
        addEntryPhotonEvent({
          photonId,
          text: `Photon Master Migrate`,
          type: "MasterMigrate",
          created_at: gameLogDate,
        });
      }
      photonLobbyMaster.value = photonId;
    }
  }

  async function parsePhotonUser(photonId: PhotonId, user: PhotonUserInfo | undefined, gameLogDate: string) {
    if (typeof user === "undefined") {
      console.error("PhotonUser: user is undefined", photonId);
      return;
    }
    const tags = user.tags ?? [];
    const cachedUser: unknown = userStore.cachedUsers.get(user.id);
    let ref: PhotonLobbyUser | undefined = isPhotonLobbyUser(cachedUser) ? cachedUser : undefined;
    const photonUser: PhotonLobbyUser = {
      id: user.id,
      displayName: user.displayName,
      developerType: user.developerType,
      profilePicOverride: user.profilePicOverride,
      currentAvatarImageUrl: user.currentAvatarImageUrl,
      currentAvatarThumbnailImageUrl: user.currentAvatarThumbnailImageUrl,
      userIcon: user.userIcon,
      last_platform: user.last_platform,
      allowAvatarCopying: user.allowAvatarCopying,
      status: user.status,
      statusDescription: user.statusDescription,
      bio: user.bio,
      tags,
    };
    photonLobby.value.set(photonId, photonUser);
    photonLobbyCurrent.value.set(photonId, photonUser);
    photonLobbyUserDataUpdate(photonId, photonUser, gameLogDate);

    const bias = Date.parse(gameLogDate) + 60 * 1000;
    if (bias > Date.now()) {
      if (typeof ref === "undefined") {
        try {
          const args = await userRequest.getUser({
            userId: user.id,
          });
          const fetched: unknown = args.ref;
          ref = isPhotonLobbyUser(fetched) ? fetched : undefined;
        } catch (err) {
          console.error(err);
          ref = photonUser;
        }
      } else if (!ref.isFriend && locationStore.lastLocation.playerList.has(user.id)) {
        const knownJoinTime = locationStore.lastLocation.playerList.get(user.id)?.joinTime;
        const joinTime = knownJoinTime === undefined || knownJoinTime === 0 ? Date.parse(gameLogDate) : knownJoinTime;
        ref.$location_at = joinTime;
        ref.$online_for = joinTime;
      }
      if (ref !== undefined && ref.currentAvatarImageUrl !== user.currentAvatarImageUrl) {
        const updatedUser = {
          ...ref,
          currentAvatarImageUrl: user.currentAvatarImageUrl,
          currentAvatarThumbnailImageUrl: user.currentAvatarThumbnailImageUrl,
        };
        applyUser(updatedUser);
      }
    }
    if (typeof ref !== "undefined") {
      photonLobby.value.set(photonId, ref);
      photonLobbyCurrent.value.set(photonId, ref);

      const queued = moderationEventQueue.value.get(photonId);
      if (typeof queued !== "undefined") {
        moderationEventQueue.value.delete(photonId);
        photonModerationUpdate(ref, photonId, queued.block, queued.mute, queued.gameLogDate);
      }
    }
  }

  function photonLobbyUserDataUpdate(photonId: PhotonId, photonUser: PhotonLobbyUser, gameLogDate: string) {
    const ref = photonLobbyUserData.value.get(photonId);
    if (
      typeof ref !== "undefined" &&
      photonId !== photonLobbyCurrentUser.value &&
      (photonUser.status !== ref.status || photonUser.statusDescription !== ref.statusDescription)
    ) {
      addEntryPhotonEvent({
        photonId,
        type: "ChangeStatus",
        status: photonUser.status,
        previousStatus: ref.status,
        statusDescription: replaceBioSymbols(photonUser.statusDescription),
        previousStatusDescription: replaceBioSymbols(ref.statusDescription),
        created_at: Date.parse(gameLogDate),
      });
    }
    photonLobbyUserData.value.set(photonId, photonUser);
  }

  function photonUserJoin(photonId: PhotonId, user: PhotonUserPayload, gameLogDate: string) {
    if (photonId === photonLobbyCurrentUser.value) {
      return;
    }
    const avatar = user.avatarDict;
    if (typeof avatar === "undefined") {
      throw new TypeError(`photon user ${photonId} joined without avatar data`);
    }
    avatar.name = replaceBioSymbols(avatar.name);
    avatar.description = replaceBioSymbols(avatar.description);
    let platform = "";
    if (user.last_platform === "android") {
      platform = "Android";
    } else if (user.last_platform === "ios") {
      platform = "iOS";
    } else if (user.inVRMode) {
      platform = "VR";
    } else {
      platform = "Desktop";
    }
    photonUserSusieCheck(photonId, user, gameLogDate);
    checkVRChatCache(avatar)
      .then((cacheInfo: unknown) => {
        const isInCache = isCacheHit(cacheInfo);
        addEntryPhotonEvent({
          photonId,
          text: "has joined",
          type: "OnPlayerJoined",
          created_at: gameLogDate,
          avatar,
          inCache: isInCache,
          platform,
        });
      })
      .catch(logPhotonError);
  }

  function photonUserSusieCheck(photonId: PhotonId, user: PhotonUserPayload, gameLogDate: string) {
    let text = "";
    if (typeof user.modTag !== "undefined") {
      text = `Moderator has joined ${user.modTag}`;
    } else if (user.isInvisible) {
      text = "User joined invisible";
    }
    if (text) {
      addEntryPhotonEvent({
        photonId,
        text,
        type: "Event",
        color: "yellow",
        created_at: gameLogDate,
      });
      const entry: PhotonGameLogEntry = {
        created_at: new Date().toJSON(),
        type: "Event",
        data: `${text} - ${getDisplayNameFromPhotonId(photonId)} (${getUserIdFromPhotonId(photonId)})`,
      };
      addPhotonEventToGameLog(entry).catch(logPhotonError);
    }
  }

  function photonUserLeave(photonId: PhotonId, gameLogDate: string) {
    if (!photonLobbyCurrent.value.has(photonId)) {
      return;
    }
    let text = "has left";
    const lastEvent = photonEvent7List.value.get(photonId);
    if (typeof lastEvent !== "undefined") {
      const timeSinceLastEvent = Date.now() - Date.parse(lastEvent);
      if (timeSinceLastEvent > 10 * 1000) {
        text = `has timed out after ${timeToText(timeSinceLastEvent)}`;
      }
    }
    photonLobbyActivePortals.value.forEach((portal) => {
      if (portal.pendingLeave > 0) {
        text = `has left through portal to "${portal.worldName}"`;
        portal.pendingLeave--;
      }
    });
    addEntryPhotonEvent({
      photonId,
      text,
      type: "OnPlayerLeft",
      created_at: gameLogDate,
    });
  }

  function photonModerationUpdate(ref: PhotonLobbyEntry, photonId: PhotonId, block: unknown, mute: unknown, gameLogDate: string) {
    const userId = ref.id ?? "";
    database
      .getModeration(userId)
      .then((rowResult: unknown) => {
        const row: PhotonModerationRow = isModerationRow(rowResult) ? rowResult : {};
        const lastType = photonLobbyLastModeration.value.get(photonId);
        let type = "";
        let text = "";
        if (block) {
          type = "Blocked";
          text = "Blocked";
        } else if (mute) {
          type = "Muted";
          text = "Muted";
        }
        if (row.userId) {
          if (!block && row.block) {
            type = "Unblocked";
            text = "Unblocked";
          } else if (!mute && row.mute) {
            type = "Unmuted";
            text = "Unmuted";
          }
          if (block === row.block && mute === row.mute) {
            if (type && type !== lastType) {
              addEntryPhotonEvent({
                photonId,
                text: `Moderation ${text}`,
                type: "Moderation",
                color: "yellow",
                created_at: gameLogDate,
              });
            }
            photonLobbyLastModeration.value.set(photonId, type);
            return;
          }
        }
        photonLobbyLastModeration.value.set(photonId, type);
        moderationAgainstTable.value.forEach((item) => {
          if (item.userId === userId && item.type === type) {
            removeFromArray(moderationAgainstTable.value, item);
          }
        });
        if (type) {
          addEntryPhotonEvent({
            photonId,
            text: `Moderation ${text}`,
            type: "Moderation",
            color: "yellow",
            created_at: gameLogDate,
          });
          const noty = {
            created_at: new Date().toJSON(),
            userId: userId,
            displayName: ref.displayName,
            type,
          };
          notificationStore.queueModerationNoty(noty);
          sharedFeedStore.addEntry(noty).catch(logPhotonError);
          const entry: PhotonModerationAgainst = {
            created_at: gameLogDate,
            userId: userId,
            displayName: ref.displayName,
            type,
          };
          moderationAgainstTable.value.push(entry);
        }
        if (block || mute) {
          database.setModeration({
            userId: userId,
            updatedAt: gameLogDate,
            displayName: ref.displayName,
            block: Boolean(block),
            mute: Boolean(mute),
          });
        } else if (row.block || row.mute) {
          database.deleteModeration(userId);
        }
      })
      .catch(logPhotonError);
  }

  return {
    parseOperationResponse,
    parsePhotonLobbyIds,
    setPhotonLobbyMaster,
    parsePhotonUser,
    photonUserJoin,
    photonUserLeave,
    photonModerationUpdate,
    addPhotonEventToGameLog,
  };
}
