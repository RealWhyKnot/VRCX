import { computed, reactive, ref } from "vue";
import { defineStore } from "pinia";
import { toast } from "vue-sonner";
import { useI18n } from "vue-i18n";

import { checkVRChatCache } from "../coordinators/cache-coordinator";
import { displayLocation, parseLocation } from "../shared/utils/location-parser";
import { getGroupName } from "../shared/utils/group";
import { getWorldName } from "../shared/utils/world";
import { removeFromArray } from "../shared/utils/base/array";
import { replaceBioSymbols } from "../shared/utils/base/string";
import { timeToText } from "../shared/utils/base/format";
import { instanceRequest } from "../api/instance";
import { userRequest } from "../api/user";
import { photonEmojis, photonEventType } from "../shared/constants/photon";
import { AppDebug } from "../services/app-config";
import { database } from "../services/database";

import { applyAvatar } from "../coordinators/avatar-coordinator";
import { showUserDialog, lookupUser, applyUser } from "../coordinators/user-coordinator";
import { useFavoriteStore } from "./favorite";
import { useFriendStore } from "./friend";
import { useGameLogStore } from "./gameLog";
import type { GameLogEntry } from "./gameLog/types";
import { useInstanceStore } from "./instance";
import { useLocationStore } from "./location";
import { useModalStore } from "./modal";
import { useNotificationStore } from "./notification";
import { useSharedFeedStore } from "./shared-feed";
import { useUserStore } from "./user";
import { useVrStore } from "./vr";

import { configRepository } from "../services/config";

import * as workerTimers from "worker-timers";

import type {
  PhotonAvatar,
  PhotonEvent,
  PhotonEventEntry,
  PhotonEventTable,
  PhotonGameLogEntry,
  PhotonHudTimeout,
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
  PhotonVrcEvent,
} from "./photon-types";
import {
  isCacheHit,
  isCustomUserTag,
  isModerationRow,
  isPhotonIdList,
  isPhotonLobbyUser,
  isPhotonUserPayload,
  isPhotonUserPayloadMap,
  isPromptResult,
  isStringArray,
  isStringRecord,
} from "./photon-guards";

function logPhotonError(error: unknown) {
  console.error(error);
}

function parseJsonStringArray(text: string): string[] {
  const parsed: unknown = JSON.parse(text);
  if (!isStringArray(parsed)) {
    throw new TypeError("expected a JSON array of strings");
  }
  return parsed;
}

export const usePhotonStore = defineStore("Photon", () => {
  const vrStore = useVrStore();
  const userStore = useUserStore();
  const friendStore = useFriendStore();
  const instanceStore = useInstanceStore();
  const gameLogStore = useGameLogStore();
  const modalStore = useModalStore();
  const notificationStore = useNotificationStore();
  const locationStore = useLocationStore();
  const sharedFeedStore = useSharedFeedStore();

  const favoriteStore = useFavoriteStore();
  const { t } = useI18n();

  const state = reactive({
    photonEventTableTypeFilterList: [
      "Event",
      "OnPlayerJoined",
      "OnPlayerLeft",
      "ChangeAvatar",
      "ChangeStatus",
      "ChangeGroup",
      "PortalSpawn",
      "DeletedPortal",
      "ChatBoxMessage",
      "Moderation",
      "Camera",
      "SpawnEmoji",
      "MasterMigrate",
    ],
    photonEventCount: 0,
    photonLobbyTimeoutThreshold: 6000,
    photonOverlayMessageTimeout: 6000,

    photonLobbyWatcherLoop: false,
  });

  const photonLobby = ref(new Map<PhotonId, PhotonLobbyEntry | undefined>());
  const photonLobbyMaster = ref(0);
  const photonLobbyCurrentUser = ref(0);
  const photonLobbyUserData = ref(new Map<PhotonId, PhotonLobbyUser>());
  const photonLobbyCurrent = ref(new Map<PhotonId, PhotonLobbyEntry | undefined>());
  const photonLobbyAvatars = ref(new Map<string, string | undefined>());
  const photonLobbyLastModeration = ref(new Map<PhotonId, string>());
  const photonLobbyTimeout = ref<PhotonHudTimeout[]>([]);
  const photonLobbyJointime = ref(new Map<PhotonId, PhotonJointime>());
  const photonLobbyActivePortals = ref(new Map<PhotonId, PhotonPortal>());
  const photonEvent7List = ref(new Map<PhotonId, string>());
  const photonLastEvent7List = ref(0);
  const photonLastChatBoxMsg = ref(new Map<PhotonId, string>());
  const moderationEventQueue = ref(new Map<PhotonId, PhotonModerationRequest>());
  const photonLoggingEnabled = ref(false);
  const photonEventOverlay = ref(false);
  const photonEventOverlayFilter = ref("Everyone");
  const photonEventTableTypeOverlayFilter = ref<string[]>([]);
  const timeoutHudOverlay = ref(false);
  const timeoutHudOverlayFilter = ref("Everyone");
  const photonEventIcon = ref(false);
  const photonEventTable = ref<PhotonEventTable>({
    data: [],
    filters: [
      {
        prop: ["displayName", "text"],
        value: "",
      },
      {
        prop: "type",
        value: [],
      },
    ],
    pageSize: 10,
    paginationProps: {
      layout: "sizes,prev,pager,next,total",
    },
  });
  const photonEventTablePrevious = ref<PhotonEventTable>({
    data: [],
    filters: [
      {
        prop: ["displayName", "text"],
        value: "",
      },
      {
        prop: "type",
        value: [],
      },
    ],
    pageSize: 10,
    paginationProps: {
      layout: "sizes,prev,pager,next,total",
    },
  });
  const chatboxUserBlacklist = ref(new Map<string, string>());
  const chatboxBlacklist = ref<string[]>(["NP: ", "Now Playing", "Now playing", "▶️ '", "( ▶️ ", "' - '", "' by '", "[Spotify] "]);
  const photonEventTableFilter = ref("");
  const moderationAgainstTable = ref<PhotonModerationAgainst[]>([]);
  const photonEventTableTypeFilter = ref<string[]>([]);

  async function initPhotonStates() {
    const [
      isPhotonEventOverlayOn,
      photonEventOverlayFilterConfig,
      photonEventTableTypeOverlayFilterConfig,
      isTimeoutHudOverlayOn,
      timeoutHudOverlayFilterConfig,
      photonLobbyTimeoutThresholdConfig,
      photonOverlayMessageTimeoutConfig,
      photonEventTableTypeFilterConfig,
      chatboxUserBlacklistConfig,
      chatboxKeywordBlacklistConfig,
    ] = await Promise.all([
      configRepository.getBool("VRCX_PhotonEventOverlay", false),
      configRepository.getString("VRCX_PhotonEventOverlayFilter", "Everyone"),
      configRepository.getString("VRCX_photonEventTypeOverlayFilter", "[]"),
      configRepository.getBool("VRCX_TimeoutHudOverlay", false),
      configRepository.getString("VRCX_TimeoutHudOverlayFilter", "Everyone"),
      configRepository.getInt("VRCX_photonLobbyTimeoutThreshold", 6000),
      configRepository.getString("VRCX_photonOverlayMessageTimeout", (6000).toString()),
      configRepository.getString("VRCX_photonEventTypeFilter", "[]"),
      configRepository.getString("VRCX_chatboxUserBlacklist"),
      configRepository.getString("VRCX_chatboxBlacklist"),
    ]);

    photonEventOverlay.value = isPhotonEventOverlayOn;
    photonEventOverlayFilter.value = photonEventOverlayFilterConfig;
    photonEventTableTypeOverlayFilter.value = parseJsonStringArray(photonEventTableTypeOverlayFilterConfig);
    timeoutHudOverlay.value = isTimeoutHudOverlayOn;
    timeoutHudOverlayFilter.value = timeoutHudOverlayFilterConfig;
    photonLobbyTimeoutThreshold.value = photonLobbyTimeoutThresholdConfig;
    photonOverlayMessageTimeout.value = Number(photonOverlayMessageTimeoutConfig);
    photonEventTableTypeFilter.value = parseJsonStringArray(photonEventTableTypeFilterConfig);

    photonEventTable.value.filters[1].value = photonEventTableTypeFilter.value;
    photonEventTablePrevious.value.filters[1].value = photonEventTableTypeFilter.value;

    const userBlacklistText = chatboxUserBlacklistConfig === null || chatboxUserBlacklistConfig === "" ? "{}" : chatboxUserBlacklistConfig;
    const userBlacklist: unknown = JSON.parse(userBlacklistText);
    if (!isStringRecord(userBlacklist)) {
      throw new TypeError("expected chatbox user blacklist to be a JSON object of strings");
    }
    chatboxUserBlacklist.value = new Map(Object.entries(userBlacklist));

    try {
      if (chatboxKeywordBlacklistConfig) {
        const arr: unknown = JSON.parse(chatboxKeywordBlacklistConfig);
        if (isStringArray(arr)) {
          chatboxBlacklist.value = arr;
        }
      }
    } catch (err) {
      console.error("Failed to parse chatbox keyword blacklist config", err);
    }
  }

  initPhotonStates().catch(logPhotonError);

  const photonLobbyTimeoutThreshold = computed({
    get: () => state.photonLobbyTimeoutThreshold,
    set: (value: number) => {
      state.photonLobbyTimeoutThreshold = value;
      configRepository.setString("VRCX_photonLobbyTimeoutThreshold", value.toString()).catch(logPhotonError);
    },
  });
  const photonOverlayMessageTimeout = computed({
    get: () => state.photonOverlayMessageTimeout,
    set: (value: number) => {
      state.photonOverlayMessageTimeout = value;
      configRepository.setString("VRCX_photonOverlayMessageTimeout", value.toString()).catch(logPhotonError);
    },
  });

  function setPhotonLoggingEnabled() {
    photonLoggingEnabled.value = !photonLoggingEnabled.value;
    configRepository.setBool("VRCX_photonLoggingEnabled", true).catch(logPhotonError);
  }
  function setPhotonEventOverlay() {
    photonEventOverlay.value = !photonEventOverlay.value;
    configRepository.setBool("VRCX_PhotonEventOverlay", photonEventOverlay.value).catch(logPhotonError);
  }

  function setPhotonEventOverlayFilter(value: string) {
    photonEventOverlayFilter.value = value;
    configRepository.setString("VRCX_PhotonEventOverlayFilter", photonEventOverlayFilter.value).catch(logPhotonError);
  }
  function setPhotonEventTableTypeOverlayFilter(value: string[]) {
    photonEventTableTypeOverlayFilter.value = value;
    configRepository.setString("VRCX_photonEventTypeOverlayFilter", JSON.stringify(photonEventTableTypeOverlayFilter.value)).catch(logPhotonError);
  }
  function setTimeoutHudOverlay(isEnabled?: boolean) {
    timeoutHudOverlay.value = !timeoutHudOverlay.value;
    configRepository.setBool("VRCX_TimeoutHudOverlay", isEnabled === true).catch(logPhotonError);
    if (!timeoutHudOverlay.value) {
      AppApi.ExecuteVrOverlayFunction("updateHudTimeout", "[]").catch(logPhotonError);
    }
  }
  function setTimeoutHudOverlayFilter(value: string) {
    timeoutHudOverlayFilter.value = value;
    configRepository.setString("VRCX_TimeoutHudOverlayFilter", timeoutHudOverlayFilter.value).catch(logPhotonError);
  }

  function getDisplayName(userId: string) {
    if (userId) {
      const cached: unknown = userStore.cachedUsers.get(userId);
      if (cached === undefined) {
        throw new Error(`no cached user for ${userId}`);
      }
      if (isPhotonLobbyUser(cached) && cached.displayName) {
        return cached.displayName;
      }
    }
    return "";
  }
  function photonEventPulse() {
    state.photonEventCount++;
    photonEventIcon.value = true;
    workerTimers.setTimeout(() => (photonEventIcon.value = false), 150);
  }

  function saveEventOverlay(configKey = "") {
    if (configKey === "VRCX_PhotonEventOverlay") {
      setPhotonEventOverlay();
    } else if (configKey === "VRCX_TimeoutHudOverlay") {
      setTimeoutHudOverlay();
    }
    vrStore.updateOpenVR();
    vrStore.updateVRConfigVars();
  }

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

  function checkChatboxBlacklist(msg: unknown) {
    if (typeof msg !== "string") return false;
    for (const keyword of chatboxBlacklist.value) {
      if (!keyword) continue;
      if (msg.includes(keyword)) return true;
    }
    return false;
  }

  async function saveChatboxUserBlacklist() {
    await configRepository.setString("VRCX_chatboxUserBlacklist", JSON.stringify(Object.fromEntries(chatboxUserBlacklist.value)));
  }

  async function saveChatboxBlacklist() {
    await configRepository.setString("VRCX_chatboxBlacklist", JSON.stringify(chatboxBlacklist.value));
  }

  async function photonEventTableFilterChange() {
    photonEventTable.value.filters[0].value = photonEventTableFilter.value;
    photonEventTable.value.filters[1].value = photonEventTableTypeFilter.value;

    photonEventTablePrevious.value.filters[0].value = photonEventTableFilter.value;
    photonEventTablePrevious.value.filters[1].value = photonEventTableTypeFilter.value;

    await configRepository.setString("VRCX_photonEventTypeFilter", JSON.stringify(photonEventTableTypeFilter.value));
  }

  function showUserFromPhotonId(photonId: PhotonId | undefined) {
    if (photonId) {
      const ref: Partial<PhotonLobbyUser> | undefined = photonLobby.value.get(photonId);
      if (typeof ref !== "undefined") {
        if (typeof ref.id !== "undefined") {
          showUserDialog(ref.id);
        } else if (typeof ref.displayName !== "undefined") {
          lookupUser(ref).catch(logPhotonError);
        }
      } else {
        toast.error("No user info available");
      }
    }
  }

  function promptPhotonOverlayMessageTimeout() {
    modalStore
      .prompt({
        title: t("prompt.overlay_message_timeout.header"),
        description: t("prompt.overlay_message_timeout.description"),
        confirmText: t("prompt.overlay_message_timeout.ok"),
        cancelText: t("prompt.overlay_message_timeout.cancel"),
        inputValue: (state.photonOverlayMessageTimeout / 1000).toString(),
        pattern: /\d+$/,
        errorMessage: t("prompt.overlay_message_timeout.input_error"),
      })
      .then((result: unknown) => {
        if (!isPromptResult(result) || !result.ok) return;
        const value = result.value;
        if (value && !isNaN(Number(value))) {
          state.photonOverlayMessageTimeout = Math.trunc(Number(value) * 1000);
          vrStore.updateVRConfigVars();
        }
      })
      .catch((error: unknown) => console.debug(error));
  }

  function promptPhotonLobbyTimeoutThreshold() {
    modalStore
      .prompt({
        title: t("prompt.photon_lobby_timeout.header"),
        description: t("prompt.photon_lobby_timeout.description"),
        confirmText: t("prompt.photon_lobby_timeout.ok"),
        cancelText: t("prompt.photon_lobby_timeout.cancel"),
        inputValue: (state.photonLobbyTimeoutThreshold / 1000).toString(),
        pattern: /\d+$/,
        errorMessage: t("prompt.photon_lobby_timeout.input_error"),
      })
      .then((result: unknown) => {
        if (!isPromptResult(result) || !result.ok) return;
        const value = result.value;
        if (value && !isNaN(Number(value))) {
          state.photonLobbyTimeoutThreshold = Math.trunc(Number(value) * 1000);
        }
      })
      .catch((error: unknown) => console.debug(error));
  }

  function startLobbyWatcherLoop() {
    if (!state.photonLobbyWatcherLoop) {
      state.photonLobbyWatcherLoop = true;
      photonLobbyWatcher();
    }
  }

  function photonLobbyWatcherLoopStop() {
    state.photonLobbyWatcherLoop = false;
    photonLobbyTimeout.value = [];
    AppApi.ExecuteVrOverlayFunction("updateHudTimeout", "[]").catch(logPhotonError);
  }

  function resetLocationPhotonState() {
    photonLobby.value = new Map();
    photonLobbyCurrent.value = new Map();
    photonLobbyMaster.value = 0;
    photonLobbyCurrentUser.value = 0;
    photonLobbyUserData.value = new Map();
    photonLobbyWatcherLoopStop();
    photonLobbyAvatars.value = new Map();
    photonLobbyLastModeration.value = new Map();
    photonLobbyJointime.value = new Map();
    photonLobbyActivePortals.value = new Map();
    photonEvent7List.value = new Map();
    photonLastEvent7List.value = 0;
    photonLastChatBoxMsg.value = new Map();
    moderationEventQueue.value = new Map();
    if (photonEventTable.value.data.length > 0) {
      photonEventTablePrevious.value.data = photonEventTable.value.data;
      photonEventTable.value.data = [];
    }
  }

  function setPhotonLastEvent7List(value: number) {
    photonLastEvent7List.value = value;
  }

  function photonLobbyWatcher() {
    if (!state.photonLobbyWatcherLoop) {
      return;
    }
    if (photonLobbyCurrent.value.size === 0) {
      photonLobbyWatcherLoopStop();
      return;
    }
    const dtNow = Date.now();
    const bias2 = photonLastEvent7List.value + 1.5 * 1000;
    if (dtNow > bias2 || locationStore.lastLocation.playerList.size <= 1) {
      if (photonLobbyTimeout.value.length > 0) {
        AppApi.ExecuteVrOverlayFunction("updateHudTimeout", "[]").catch(logPhotonError);
      }
      photonLobbyTimeout.value = [];
      workerTimers.setTimeout(() => photonLobbyWatcher(), 500);
      return;
    }
    const hudTimeout: PhotonHudTimeout[] = [];
    photonEvent7List.value.forEach((dt, id) => {
      const timeSinceLastEvent = dtNow - Date.parse(dt);
      if (timeSinceLastEvent > state.photonLobbyTimeoutThreshold && id !== photonLobbyCurrentUser.value) {
        let joinTime: number | undefined;
        if (photonLobbyJointime.value.has(id)) {
          joinTime = photonLobbyJointime.value.get(id)?.joinTime;
        }
        if (!joinTime) {
          console.log(`${id} missing join time`);
        }
        if (joinTime && joinTime + 70000 < dtNow) {
          hudTimeout.unshift({
            userId: getUserIdFromPhotonId(id),
            displayName: getDisplayNameFromPhotonId(id),
            time: Math.round(timeSinceLastEvent / 1000),
            rawTime: timeSinceLastEvent,
          });
        }
      }
    });
    if (photonLobbyTimeout.value.length > 0 || hudTimeout.length > 0) {
      hudTimeout.sort(function (a, b) {
        if (a.rawTime > b.rawTime) {
          return 1;
        }
        if (a.rawTime < b.rawTime) {
          return -1;
        }
        return 0;
      });
      if (timeoutHudOverlay.value) {
        let filteredHudTimeout: PhotonHudTimeout[];
        if (timeoutHudOverlayFilter.value === "VIP" || timeoutHudOverlayFilter.value === "Friends") {
          filteredHudTimeout = [];
          hudTimeout.forEach((item) => {
            if (timeoutHudOverlayFilter.value === "VIP" && favoriteStore.getCachedFavoritesByObjectId(item.userId)) {
              filteredHudTimeout.push(item);
            } else if (timeoutHudOverlayFilter.value === "Friends" && friendStore.friends.has(item.userId)) {
              filteredHudTimeout.push(item);
            }
          });
        } else {
          filteredHudTimeout = hudTimeout;
        }
        AppApi.ExecuteVrOverlayFunction("updateHudTimeout", JSON.stringify(filteredHudTimeout)).catch(logPhotonError);
      }
      photonLobbyTimeout.value = hudTimeout;
      instanceStore.getCurrentInstanceUserList();
    }
    workerTimers.setTimeout(() => photonLobbyWatcher(), 500);
  }

  function addEntryPhotonEvent(input: PhotonEventEntry) {
    let isMaster = false;
    if (input.photonId === photonLobbyMaster.value) {
      isMaster = true;
    }
    const joinTimeRef = input.photonId === undefined ? undefined : photonLobbyJointime.value.get(input.photonId);
    const isModerator = joinTimeRef?.canModerateInstance;
    const photonUserRef = input.photonId === undefined ? undefined : photonLobby.value.get(input.photonId);
    let displayName = "";
    let userId = "";
    let isFriend = false;
    if (typeof photonUserRef !== "undefined") {
      displayName = photonUserRef.displayName;
      userId = photonUserRef.id ?? "";
      isFriend = photonUserRef.isFriend ?? false;
    }
    const isFavorite = friendStore.localFavoriteFriends.has(userId);
    let colour: string | undefined = "";
    const tagRef: unknown = userStore.customUserTags.get(userId);
    if (isCustomUserTag(tagRef)) {
      colour = tagRef.colour;
    }
    const feed: PhotonEventEntry = {
      displayName,
      userId,
      isFavorite,
      isFriend,
      isMaster,
      isModerator,
      colour,
      ...input,
    };
    photonEventTable.value.data.unshift(feed);
    if (photonEventTableTypeOverlayFilter.value.length > 0 && !photonEventTableTypeOverlayFilter.value.includes(feed.type)) {
      return;
    }
    if (photonEventOverlay.value) {
      if (photonEventOverlayFilter.value === "VIP" || photonEventOverlayFilter.value === "Friends") {
        if (feed.userId && ((photonEventOverlayFilter.value === "VIP" && isFavorite) || (photonEventOverlayFilter.value === "Friends" && isFriend))) {
          AppApi.ExecuteVrOverlayFunction("addEntryHudFeed", JSON.stringify(feed)).catch(logPhotonError);
        }
      } else {
        AppApi.ExecuteVrOverlayFunction("addEntryHudFeed", JSON.stringify(feed)).catch(logPhotonError);
      }
    }
  }

  function getDisplayNameFromPhotonId(photonId: PhotonId) {
    let displayName = "";
    if (photonId) {
      const ref = photonLobby.value.get(photonId);
      displayName = `ID:${photonId}`;
      if (typeof ref !== "undefined") {
        displayName = ref.displayName;
      }
    }
    return displayName;
  }

  function getUserIdFromPhotonId(photonId: PhotonId) {
    let userId = "";
    if (photonId) {
      const ref = photonLobby.value.get(photonId);
      if (typeof ref !== "undefined") {
        userId = ref.id ?? "";
      }
    }
    return userId;
  }

  function getPhotonIdFromUserId(userId: string) {
    let photonId: PhotonId | undefined;
    if (userId) {
      photonLobby.value.forEach((ref, id) => {
        if (ref?.id === userId) {
          photonId = id;
        }
      });
    }
    return photonId;
  }

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
    state,

    photonLoggingEnabled,
    photonEventOverlay,
    photonEventOverlayFilter,
    photonEventTableTypeOverlayFilter,
    timeoutHudOverlay,
    timeoutHudOverlayFilter,
    photonEventIcon,
    photonLobbyTimeoutThreshold,
    photonOverlayMessageTimeout,
    photonEventTableTypeFilter,
    photonEventTable,
    photonEventTablePrevious,
    chatboxUserBlacklist,
    chatboxBlacklist,
    photonEventTableFilter,
    photonLobby,
    photonLobbyMaster,
    photonLobbyCurrentUser,
    photonLobbyUserData,
    photonLobbyCurrent,
    photonLobbyAvatars,
    photonLobbyLastModeration,
    photonLobbyTimeout,
    photonLobbyJointime,
    photonLobbyActivePortals,
    photonEvent7List,
    photonLastEvent7List,
    photonLastChatBoxMsg,
    moderationEventQueue,

    setPhotonLoggingEnabled,
    setPhotonEventOverlay,
    setPhotonEventOverlayFilter,
    setPhotonEventTableTypeOverlayFilter,
    setTimeoutHudOverlay,
    setTimeoutHudOverlayFilter,
    getDisplayName,
    photonEventPulse,
    parseOperationResponse,
    saveEventOverlay,
    checkChatboxBlacklist,
    saveChatboxUserBlacklist,
    saveChatboxBlacklist,
    photonEventTableFilterChange,
    showUserFromPhotonId,
    promptPhotonOverlayMessageTimeout,
    promptPhotonLobbyTimeoutThreshold,
    photonLobbyWatcherLoopStop,
    resetLocationPhotonState,
    setPhotonLastEvent7List,
    parsePhotonEvent,
    parseVRCEvent,
    moderationAgainstTable,
  };
});
