import type { Ref } from "vue";

import { checkVRChatCache } from "../coordinators/cache-coordinator";
import { getGroupName } from "../shared/utils/group";
import { replaceBioSymbols } from "../shared/utils/base/string";
import { applyAvatar } from "../coordinators/avatar-coordinator";
import type { PhotonAvatar, PhotonId, PhotonUserInfo } from "./photon-types";
import { isCacheHit } from "./photon-guards";
import { logPhotonError } from "./photon-errors";
import type { useGameLogStore } from "./gameLog";
import type { useNotificationStore } from "./notification";
import type { PhotonJointime, PhotonEventEntry } from "./photon-types";

export type CreatePhotonAvatarDeps = {
  gameLogStore: ReturnType<typeof useGameLogStore>;
  notificationStore: ReturnType<typeof useNotificationStore>;
  photonLobbyCurrentUser: Ref<number>;
  photonLobbyAvatars: Ref<Map<string, string | undefined>>;
  photonLobbyJointime: Ref<Map<PhotonId, PhotonJointime>>;
  addEntryPhotonEvent: (input: PhotonEventEntry) => void;
};

export function createPhotonAvatar(deps: CreatePhotonAvatarDeps) {
  const { gameLogStore, notificationStore, photonLobbyCurrentUser, photonLobbyAvatars, photonLobbyJointime, addEntryPhotonEvent } = deps;

  function parsePhotonAvatarChange(photonId: PhotonId, user: PhotonUserInfo | undefined, avatar: PhotonAvatar | undefined, gameLogDate: string) {
    if (typeof avatar === "undefined") {
      return;
    }
    if (typeof user === "undefined") {
      console.error("PhotonAvatarChange: user is undefined", photonId);
      return;
    }
    const oldAvatarId = photonLobbyAvatars.value.get(user.id);
    if (oldAvatarId && oldAvatarId !== avatar.id && photonId !== photonLobbyCurrentUser.value) {
      avatar.name = replaceBioSymbols(avatar.name);
      avatar.description = replaceBioSymbols(avatar.description);
      checkVRChatCache(avatar)
        .then((cacheInfo: unknown) => {
          const isInCache = isCacheHit(cacheInfo);
          const entry = {
            created_at: new Date().toJSON(),
            type: "AvatarChange",
            userId: user.id,
            displayName: user.displayName,
            name: avatar.name,
            description: avatar.description,
            avatarId: avatar.id,
            authorId: avatar.authorId,
            releaseStatus: avatar.releaseStatus,
            imageUrl: avatar.imageUrl,
            thumbnailImageUrl: avatar.thumbnailImageUrl,
          };
          notificationStore.queueGameLogNoty(entry);
          gameLogStore.addGameLog(entry);
          addEntryPhotonEvent({
            photonId,
            displayName: user.displayName,
            userId: user.id,
            text: `ChangeAvatar ${avatar.name ?? ""}`,
            type: "ChangeAvatar",
            created_at: gameLogDate,
            avatar,
            inCache: isInCache,
          });
        })
        .catch(logPhotonError);
    }
    photonLobbyAvatars.value.set(user.id, avatar.id);
  }

  async function parsePhotonGroupChange(photonId: PhotonId, user: PhotonUserInfo | undefined, groupId: string, gameLogDate: string) {
    const jointime = photonLobbyJointime.value.get(photonId);
    if (typeof user === "undefined" || typeof jointime === "undefined") {
      return;
    }
    const groupOnNameplate = jointime.groupOnNameplate;
    if (typeof groupOnNameplate !== "undefined" && groupOnNameplate !== groupId && photonId !== photonLobbyCurrentUser.value) {
      const groupName = await getGroupName(groupId);
      const previousGroupName = await getGroupName(groupOnNameplate);
      addEntryPhotonEvent({
        photonId,
        displayName: user.displayName,
        userId: user.id,
        text: `ChangeGroup ${groupName}`,
        type: "ChangeGroup",
        created_at: gameLogDate,
        groupId,
        groupName,
        previousGroupId: groupOnNameplate,
        previousGroupName,
      });
    }
  }

  function parsePhotonAvatar(avatar: PhotonAvatar | undefined) {
    if (avatar?.id === undefined) {
      console.warn("PhotonAvatar: avatar is undefined");
      return;
    }
    let tags: string[] = [];
    let unityPackages: NonNullable<PhotonAvatar["unityPackages"]> = [];
    if (typeof avatar.tags !== "undefined") {
      tags = avatar.tags;
    }
    if (typeof avatar.unityPackages !== "undefined") {
      unityPackages = avatar.unityPackages;
    }
    if (!avatar.assetUrl && unityPackages.length > 0) {
      for (const unityPackage of unityPackages) {
        if (unityPackage.variant && unityPackage.variant !== "standard" && unityPackage.variant !== "security") {
          continue;
        }
        if (unityPackage.platform === "standalonewindows") {
          avatar.assetUrl = unityPackage.assetUrl;
        }
      }
    }
    applyAvatar({
      id: avatar.id,
      authorId: avatar.authorId,
      authorName: avatar.authorName,
      updated_at: avatar.updated_at,
      description: avatar.description,
      imageUrl: avatar.imageUrl,
      thumbnailImageUrl: avatar.thumbnailImageUrl,
      name: avatar.name,
      releaseStatus: avatar.releaseStatus,
      version: avatar.version,
      tags,
      unityPackages,
    });
  }

  function safeParseInt(val: string | number | undefined) {
    if (typeof val === "undefined" || val === "") {
      return null;
    }
    const n = Number(val);
    return Number.isInteger(n) ? n : null;
  }

  return {
    parsePhotonAvatar,
    safeParseInt,
    parsePhotonAvatarChange,
    parsePhotonGroupChange,
  };
}
