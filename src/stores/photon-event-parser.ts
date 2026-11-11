import type { Ref } from "vue";

import { displayLocation, parseLocation } from "../shared/utils/location-parser";
import { getGroupName } from "../shared/utils/group";
import { getWorldName } from "../shared/utils/world";
import { timeToText } from "../shared/utils/base/format";
import { instanceRequest } from "../api/instance";
import { photonEmojis, photonEventType } from "../shared/constants/photon";
import { AppDebug } from "../services/app-config";
import type { PhotonEvent, PhotonGameLogEntry, PhotonId, PhotonVrcEvent } from "./photon-types";
import { isPhotonIdList, isPhotonLobbyUser, isPhotonUserPayload, isPhotonUserPayloadMap } from "./photon-guards";
import { logPhotonError } from "./photon-errors";
import type { useGameLogStore } from "./gameLog";
import type { useNotificationStore } from "./notification";
import type { useLocationStore } from "./location";
import type { PhotonLobbyEntry, PhotonJointime, PhotonPortal, PhotonModerationRequest, PhotonEventEntry } from "./photon-types";
import type { createPhotonLobbyWatcher } from "./photon-lobby-watcher";
import type { createPhotonLobby } from "./photon-lobby";
import type { createPhotonAvatar } from "./photon-avatar";

export type CreatePhotonEventParserDeps = {
  gameLogStore: ReturnType<typeof useGameLogStore>;
  notificationStore: ReturnType<typeof useNotificationStore>;
  locationStore: ReturnType<typeof useLocationStore>;
  photonLobby: Ref<Map<PhotonId, PhotonLobbyEntry | undefined>>;
  photonLobbyCurrentUser: Ref<number>;
  photonLobbyCurrent: Ref<Map<PhotonId, PhotonLobbyEntry | undefined>>;
  photonLobbyLastModeration: Ref<Map<PhotonId, string>>;
  photonLobbyJointime: Ref<Map<PhotonId, PhotonJointime>>;
  photonLobbyActivePortals: Ref<Map<PhotonId, PhotonPortal>>;
  photonEvent7List: Ref<Map<PhotonId, string>>;
  photonLastChatBoxMsg: Ref<Map<PhotonId, string>>;
  moderationEventQueue: Ref<Map<PhotonId, PhotonModerationRequest>>;
  chatboxUserBlacklist: Ref<Map<string, string>>;
  getDisplayName: (userId: string) => string;
  checkChatboxBlacklist: (msg: unknown) => boolean;
  startLobbyWatcherLoop: ReturnType<typeof createPhotonLobbyWatcher>["startLobbyWatcherLoop"];
  addEntryPhotonEvent: (input: PhotonEventEntry) => void;
  getDisplayNameFromPhotonId: (photonId: PhotonId) => string;
  getUserIdFromPhotonId: (photonId: PhotonId) => string;
  getPhotonIdFromUserId: (userId: string) => PhotonId | undefined;
  addPhotonEventToGameLog: ReturnType<typeof createPhotonLobby>["addPhotonEventToGameLog"];
  parsePhotonLobbyIds: ReturnType<typeof createPhotonLobby>["parsePhotonLobbyIds"];
  setPhotonLobbyMaster: ReturnType<typeof createPhotonLobby>["setPhotonLobbyMaster"];
  parsePhotonUser: ReturnType<typeof createPhotonLobby>["parsePhotonUser"];
  photonUserJoin: ReturnType<typeof createPhotonLobby>["photonUserJoin"];
  photonUserLeave: ReturnType<typeof createPhotonLobby>["photonUserLeave"];
  photonModerationUpdate: ReturnType<typeof createPhotonLobby>["photonModerationUpdate"];
  parsePhotonAvatarChange: ReturnType<typeof createPhotonAvatar>["parsePhotonAvatarChange"];
  parsePhotonGroupChange: ReturnType<typeof createPhotonAvatar>["parsePhotonGroupChange"];
  parsePhotonAvatar: ReturnType<typeof createPhotonAvatar>["parsePhotonAvatar"];
  safeParseInt: ReturnType<typeof createPhotonAvatar>["safeParseInt"];
};

export function createPhotonEventParser(deps: CreatePhotonEventParserDeps) {
  const {
    gameLogStore,
    notificationStore,
    locationStore,
    photonLobby,
    photonLobbyCurrentUser,
    photonLobbyCurrent,
    photonLobbyLastModeration,
    photonLobbyJointime,
    photonLobbyActivePortals,
    photonEvent7List,
    photonLastChatBoxMsg,
    moderationEventQueue,
    chatboxUserBlacklist,
    getDisplayName,
    checkChatboxBlacklist,
    startLobbyWatcherLoop,
    addEntryPhotonEvent,
    getDisplayNameFromPhotonId,
    getUserIdFromPhotonId,
    getPhotonIdFromUserId,
    addPhotonEventToGameLog,
    parsePhotonLobbyIds,
    setPhotonLobbyMaster,
    parsePhotonUser,
    photonUserJoin,
    photonUserLeave,
    photonModerationUpdate,
    parsePhotonAvatarChange,
    parsePhotonGroupChange,
    parsePhotonAvatar,
    safeParseInt,
  } = deps;

  function parsePhotonEvent(data: PhotonEvent, gameLogDate: string) {
    switch (data.Code) {
      case 253: {
        const parameters = data.Parameters;
        if (parameters[253] === -1) {
          const users = parameters[251];
          if (isPhotonUserPayloadMap(users)) {
            for (const [key, user] of Object.entries(users)) {
              const idNum = safeParseInt(key);
              if (idNum === null) continue;
              if (!user?.user) continue;
              parsePhotonUser(idNum, user.user, gameLogDate).catch(logPhotonError);
              if (user.avatarDict) {
                parsePhotonAvatarChange(idNum, user.user, user.avatarDict, gameLogDate);
                parsePhotonAvatar(user.avatarDict);
              }
              if (user.favatarDict) {
                parsePhotonAvatar(user.favatarDict);
              }
              if (typeof user.groupOnNameplate !== "undefined") {
                parsePhotonGroupChange(idNum, user.user, user.groupOnNameplate, gameLogDate).catch(logPhotonError);
              }
              let hasInstantiated: boolean | undefined = false;
              const lobbyJointime = photonLobbyJointime.value.get(idNum);
              if (typeof lobbyJointime !== "undefined") {
                hasInstantiated = lobbyJointime.hasInstantiated;
              }
              photonLobbyJointime.value.set(idNum, {
                joinTime: Date.parse(gameLogDate),
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
              photonUserJoin(idNum, user, gameLogDate);
            }
          }
        } else {
          console.log("oldSetUserProps", data);
          const idNum = safeParseInt(parameters[253]);
          if (idNum === null) break;
          const user: unknown = parameters[251];
          if (!isPhotonUserPayload(user) || !user.user) break;
          parsePhotonUser(idNum, user.user, gameLogDate).catch(logPhotonError);
          if (user.avatarDict) {
            parsePhotonAvatarChange(idNum, user.user, user.avatarDict, gameLogDate);
            parsePhotonAvatar(user.avatarDict);
          }
          if (user.favatarDict) {
            parsePhotonAvatar(user.favatarDict);
          }
          if (typeof user.groupOnNameplate !== "undefined") {
            parsePhotonGroupChange(idNum, user.user, user.groupOnNameplate, gameLogDate).catch(logPhotonError);
          }
          let hasInstantiated: boolean | undefined = false;
          const lobbyJointime = photonLobbyJointime.value.get(idNum);
          if (typeof lobbyJointime !== "undefined") {
            hasInstantiated = lobbyJointime.hasInstantiated;
          }
          photonLobbyJointime.value.set(idNum, {
            joinTime: Date.parse(gameLogDate),
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
          photonUserJoin(idNum, user, gameLogDate);
        }
        break;
      }
      case 42: {
        const id42 = safeParseInt(data.Parameters[254]);
        const user42 = data.Parameters[245];
        if (id42 === null || !user42?.user) break;
        parsePhotonUser(id42, user42.user, gameLogDate).catch(logPhotonError);
        if (user42.avatarDict) {
          parsePhotonAvatarChange(id42, user42.user, user42.avatarDict, gameLogDate);
          parsePhotonAvatar(user42.avatarDict);
        }
        if (user42.favatarDict) {
          parsePhotonAvatar(user42.favatarDict);
        }
        if (typeof user42.groupOnNameplate !== "undefined") {
          parsePhotonGroupChange(id42, user42.user, user42.groupOnNameplate, gameLogDate).catch(logPhotonError);
        }
        const lobbyJointime = photonLobbyJointime.value.get(id42);
        photonLobbyJointime.value.set(id42, {
          hasInstantiated: true,
          ...lobbyJointime,
          inVRMode: user42.inVRMode,
          avatarEyeHeight: user42.avatarEyeHeight,
          canModerateInstance: user42.canModerateInstance,
          groupOnNameplate: user42.groupOnNameplate,
          showGroupBadgeToOthers: user42.showGroupBadgeToOthers,
          showSocialRank: user42.showSocialRank,
          useImpostorAsFallback: user42.useImpostorAsFallback,
          platform: user42.platform,
        });
        break;
      }
      case 255: {
        const id255 = safeParseInt(data.Parameters[254]);
        if (id255 === null) break;
        const payload = data.Parameters[249];
        if (payload?.user) {
          parsePhotonUser(id255, payload.user, gameLogDate).catch(logPhotonError);
          if (payload.avatarDict) {
            parsePhotonAvatarChange(id255, payload.user, payload.avatarDict, gameLogDate);
            parsePhotonAvatar(payload.avatarDict);
          }
          if (payload.favatarDict) {
            parsePhotonAvatar(payload.favatarDict);
          }
          if (typeof payload.groupOnNameplate !== "undefined") {
            parsePhotonGroupChange(id255, payload.user, payload.groupOnNameplate, gameLogDate).catch(logPhotonError);
          }
        }
        parsePhotonLobbyIds(data.Parameters[252]);
        let hasInstantiated: boolean | undefined = photonLobbyCurrentUser.value === id255;
        const currentRef = photonLobbyCurrent.value.get(id255);
        if (typeof currentRef !== "undefined") {
          hasInstantiated = currentRef.hasInstantiated;
        }
        if (payload !== undefined) {
          photonLobbyJointime.value.set(id255, {
            joinTime: Date.parse(gameLogDate),
            hasInstantiated,
            inVRMode: payload.inVRMode,
            avatarEyeHeight: payload.avatarEyeHeight,
            canModerateInstance: payload.canModerateInstance,
            groupOnNameplate: payload.groupOnNameplate,
            showGroupBadgeToOthers: payload.showGroupBadgeToOthers,
            showSocialRank: payload.showSocialRank,
            useImpostorAsFallback: payload.useImpostorAsFallback,
            platform: payload.platform,
          });
          photonUserJoin(id255, payload, gameLogDate);
        }
        startLobbyWatcherLoop();
        break;
      }
      case 254: {
        const photonId = data.Parameters[254];
        photonUserLeave(photonId, gameLogDate);
        photonLobbyCurrent.value.delete(photonId);
        photonLobbyLastModeration.value.delete(photonId);
        photonLobbyJointime.value.delete(photonId);
        photonEvent7List.value.delete(photonId);
        parsePhotonLobbyIds(data.Parameters[252]);
        if (typeof data.Parameters[203] !== "undefined") {
          setPhotonLobbyMaster(data.Parameters[203], gameLogDate);
        }
        break;
      }
      case 4:
        setPhotonLobbyMaster(data.Parameters[254], gameLogDate);
        break;
      case 33: {
        const dict = data.Parameters[245];
        if (dict["0"] === 21) {
          const singleId = dict["1"];
          if (singleId) {
            const block = dict["10"];
            const mute = dict["11"];
            const ref = photonLobby.value.get(singleId);
            if (isPhotonLobbyUser(ref)) {
              photonModerationUpdate(ref, singleId, block, mute, gameLogDate);
            } else {
              moderationEventQueue.value.set(singleId, {
                block,
                mute,
                gameLogDate,
              });
            }
          } else {
            const blockArray = dict["10"];
            const muteArray = dict["11"];
            if (!isPhotonIdList(blockArray) || !isPhotonIdList(muteArray)) {
              throw new TypeError("moderation list is missing its block or mute ids");
            }
            const idList = new Map<PhotonId, { isMute: boolean; isBlock: boolean }>();
            blockArray.forEach((photonId1) => {
              if (muteArray.includes(photonId1)) {
                idList.set(photonId1, {
                  isMute: true,
                  isBlock: true,
                });
              } else {
                idList.set(photonId1, {
                  isMute: false,
                  isBlock: true,
                });
              }
            });
            muteArray.forEach((photonId2) => {
              if (!idList.has(photonId2)) {
                idList.set(photonId2, {
                  isMute: true,
                  isBlock: false,
                });
              }
            });
            idList.forEach(({ isMute, isBlock }, photonId3) => {
              const ref1 = photonLobby.value.get(photonId3);
              if (typeof ref1 !== "undefined") {
                photonModerationUpdate(ref1, photonId3, isBlock, isMute, gameLogDate);
              } else {
                moderationEventQueue.value.set(photonId3, {
                  block: isBlock,
                  mute: isMute,
                  gameLogDate,
                });
              }
            });
          }
        } else if (dict["0"] === 13 || dict["0"] === 25) {
          let msg = dict["2"];
          const replacements = dict["14"];
          if (typeof msg === "string" && typeof replacements === "object") {
            for (const [prop, value] of Object.entries(replacements)) {
              msg = msg.replace(`{{${prop}}}`, String(value));
            }
          }
          addEntryPhotonEvent({
            text: msg,
            type: "Moderation",
            color: "yellow",
            created_at: gameLogDate,
          });
        }
        break;
      }
      case 202: {
        const photonId = data.Parameters[254];
        if (!photonLobby.value.has(photonId)) {
          photonLobby.value.set(photonId, undefined);
        }
        if (!photonLobbyCurrent.value.has(photonId)) {
          photonLobbyCurrent.value.set(photonId, undefined);
        }
        const lobbyJointime = photonLobbyJointime.value.get(photonId);
        if (typeof lobbyJointime !== "undefined") {
          photonLobbyJointime.value.set(photonId, {
            ...lobbyJointime,
            hasInstantiated: true,
          });
        } else {
          photonLobbyJointime.value.set(photonId, {
            joinTime: Date.parse(gameLogDate),
            hasInstantiated: true,
          });
        }
        break;
      }
      case 43: {
        const photonId = data.Parameters[254];
        const text = data.Parameters[245];
        if (photonLobbyCurrentUser.value === photonId) {
          return;
        }
        const lastMsg = photonLastChatBoxMsg.value.get(photonId);
        if (lastMsg === text) {
          return;
        }
        photonLastChatBoxMsg.value.set(photonId, text);
        const userId = getUserIdFromPhotonId(photonId);
        if (chatboxUserBlacklist.value.has(userId) || checkChatboxBlacklist(text)) {
          return;
        }
        addEntryPhotonEvent({
          photonId,
          text,
          type: "ChatBoxMessage",
          created_at: gameLogDate,
        });
        const entry: PhotonGameLogEntry = {
          userId,
          displayName: getDisplayNameFromPhotonId(photonId),
          created_at: gameLogDate,
          type: "ChatBoxMessage",
          text,
        };
        notificationStore.queueGameLogNoty(entry);
        gameLogStore.addGameLog(entry);
        break;
      }
      case 70: {
        const params = data.Parameters[245];
        if (params[0] === 20) {
          const portalId = params[1];
          const portalUserId = params[2];
          const shortName = params[5];
          const portalWorldName = params[8].name;
          addPhotonPortalSpawn(gameLogDate, portalUserId, shortName, portalWorldName).catch(logPhotonError);
          photonLobbyActivePortals.value.set(portalId, {
            userId: portalUserId,
            shortName,
            worldName: portalWorldName,
            created_at: Date.parse(gameLogDate),
            pendingLeave: 0,
          });
        } else if (params[0] === 21) {
          const portalId = params[1];
          const portalUserId = params[2];

          const shortName = params[5];
          const portalWorldName = "";
          addPhotonPortalSpawn(gameLogDate, portalUserId, shortName, portalWorldName).catch(logPhotonError);
          photonLobbyActivePortals.value.set(portalId, {
            userId: portalUserId,
            shortName,
            worldName: portalWorldName,
            created_at: Date.parse(gameLogDate),
            playerCount: 0,
            pendingLeave: 0,
          });
        } else if (params[0] === 22) {
          const portalId = params[1];
          let portalText = "DeletedPortal";
          const portal = photonLobbyActivePortals.value.get(portalId);
          if (typeof portal !== "undefined") {
            const portalWorldName = portal.worldName;
            const playerCount = portal.playerCount;
            const time = timeToText(Date.parse(gameLogDate) - portal.created_at);
            portalText = `DeletedPortal after ${time} with ${String(playerCount)} players to "${portalWorldName}"`;
          }
          addEntryPhotonEvent({
            text: portalText,
            type: "DeletedPortal",
            created_at: gameLogDate,
          });
          photonLobbyActivePortals.value.delete(portalId);
        } else if (params[0] === 23) {
          const portalId = params[1];
          const playerCount = params[3];
          const portal = photonLobbyActivePortals.value.get(portalId);
          if (typeof portal !== "undefined") {
            portal.pendingLeave++;
            portal.playerCount = playerCount;
          }
        } else if (params[0] === 24) {
          addEntryPhotonEvent({
            text: "PortalError failed to create portal",
            type: "DeletedPortal",
            created_at: gameLogDate,
          });
        }
        break;
      }
      case 71: {
        const photonId = data.Parameters[254];
        if (photonId === photonLobbyCurrentUser.value) {
          return;
        }
        const params = data.Parameters[245];
        const type = params[0];
        let emojiName: string | undefined = "";
        let imageUrl = "";
        let fileId: string | undefined;
        if (type === 0) {
          const emojiId = params[2];
          emojiName = photonEmojis[emojiId];
        } else if (type === 1) {
          emojiName = "Custom";
          fileId = params[1];
          imageUrl = `${AppDebug.endpointDomain}/file/${fileId}/1/`;
        }
        addEntryPhotonEvent({
          photonId,
          text: emojiName,
          type: "SpawnEmoji",
          created_at: gameLogDate,
          imageUrl,
          fileId,
        });
        break;
      }
    }
  }

  function parseVRCEvent(json: PhotonVrcEvent) {
    const datetime = json.dt;
    const eventData = json.VRCEventData;
    const senderId = eventData.Sender;
    if (AppDebug.debugPhotonLogging) {
      console.log("VrcEvent:", json);
    }
    if (eventData.EventName === "_SendOnSpawn") {
      return;
    } else if (eventData.EventType > 34) {
      const entry: PhotonGameLogEntry = {
        created_at: datetime,
        type: "Event",
        data: `${getDisplayNameFromPhotonId(senderId)} called non existent RPC ${eventData.EventType}`,
      };
      addPhotonEventToGameLog(entry).catch(logPhotonError);
      return;
    }
    if (eventData.EventType === 14) {
      let type = "Event";
      let text: string | undefined;
      if (eventData.EventName === "ChangeVisibility") {
        if (eventData.Data?.[0] === true) {
          text = "EnableCamera";
        } else if (eventData.Data?.[0] === false) {
          text = "DisableCamera";
        }
        type = "Camera";
      } else if (eventData.EventName === "PhotoCapture") {
        text = "PhotoCapture";
        type = "Camera";
      } else if (eventData.EventName === "TimerBloop") {
        text = "TimerBloop";
        type = "Camera";
      } else if (eventData.EventName === "ReloadAvatarNetworkedRPC") {
        text = "AvatarReset";
      } else if (eventData.EventName === "ReleaseBones") {
        text = "ResetPhysBones";
      } else if (eventData.EventName === "SpawnEmojiRPC") {
        type = "SpawnEmoji";
      } else {
        let eventVrc = "";
        if (eventData.Data && eventData.Data.length > 0) {
          eventVrc = ` ${JSON.stringify(eventData.Data).replace(/"([^(")"]+)":/g, "$1:")}`;
        }
        text = `${eventData.EventName}${eventVrc}`;
      }
      addEntryPhotonEvent({
        photonId: senderId,
        text,
        type,
        created_at: datetime,
      });
    } else {
      let eventName = "";
      if (eventData.EventName) {
        eventName = ` ${JSON.stringify(eventData.EventName).replace(/"([^(")"]+)":/g, "$1:")}`;
      }
      if (AppDebug.debugPhotonLogging) {
        const displayName = getDisplayNameFromPhotonId(senderId);
        const feed = `RPC ${displayName} ${String(photonEventType[eventData.EventType])}${eventName}`;
        console.log("VrcRpc:", feed);
      }
    }
  }

  async function addPhotonPortalSpawn(gameLogDate: string, userId: string, shortName: string, worldName: string) {
    const instance = await instanceRequest.getInstanceFromShortName({
      shortName,
    });
    const location = instance.json.location;
    const L = parseLocation(location);
    let groupName = "";
    if (L.groupId) {
      groupName = await getGroupName(L.groupId);
    }
    if (!worldName) {
      worldName = await getWorldName(location);
    }

    const _displayLocation = displayLocation(location, worldName, groupName);
    addEntryPhotonEvent({
      photonId: getPhotonIdFromUserId(userId),
      text: `PortalSpawn to ${String(_displayLocation)}`,
      type: "PortalSpawn",
      shortName,
      location,
      worldName,
      groupName,
      created_at: gameLogDate,
    });
    addPhotonEventToGameLog({
      created_at: gameLogDate,
      type: "PortalSpawn",
      displayName: getDisplayName(userId),
      location: locationStore.lastLocation.location,
      userId,
      instanceId: location,
      worldName,
      groupName,
    }).catch(logPhotonError);
  }

  return {
    parsePhotonEvent,
    parseVRCEvent,
  };
}
