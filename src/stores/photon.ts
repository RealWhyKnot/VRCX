import { computed, reactive, ref } from "vue";
import { defineStore } from "pinia";
import { toast } from "vue-sonner";
import { useI18n } from "vue-i18n";
import * as workerTimers from "worker-timers";

import { showUserDialog, lookupUser } from "../coordinators/user-coordinator";
import { useFavoriteStore } from "./favorite";
import { useFriendStore } from "./friend";
import { useGameLogStore } from "./gameLog";
import { useInstanceStore } from "./instance";
import { useLocationStore } from "./location";
import { useModalStore } from "./modal";
import { useNotificationStore } from "./notification";
import { useSharedFeedStore } from "./shared-feed";
import { useUserStore } from "./user";
import { useVrStore } from "./vr";
import { configRepository } from "../services/config";
import type {
  PhotonEventEntry,
  PhotonEventTable,
  PhotonHudTimeout,
  PhotonId,
  PhotonJointime,
  PhotonLobbyEntry,
  PhotonLobbyUser,
  PhotonModerationAgainst,
  PhotonModerationRequest,
  PhotonPortal,
} from "./photon-types";
import { isCustomUserTag, isPhotonLobbyUser, isStringArray, isStringRecord } from "./photon-guards";
import { logPhotonError } from "./photon-errors";
import { createPhotonAvatar } from "./photon-avatar";
import { createPhotonLobby } from "./photon-lobby";
import { createPhotonLobbyWatcher } from "./photon-lobby-watcher";
import { createPhotonEventParser } from "./photon-event-parser";
import { createPhotonTimeoutPrompts } from "./photon-timeout-prompts";

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

  const { parsePhotonAvatar, safeParseInt, parsePhotonAvatarChange, parsePhotonGroupChange } = createPhotonAvatar({
    gameLogStore,
    notificationStore,
    photonLobbyCurrentUser,
    photonLobbyAvatars,
    photonLobbyJointime,
    addEntryPhotonEvent,
  });
  const {
    parseOperationResponse,
    parsePhotonLobbyIds,
    setPhotonLobbyMaster,
    parsePhotonUser,
    photonUserJoin,
    photonUserLeave,
    photonModerationUpdate,
    addPhotonEventToGameLog,
  } = createPhotonLobby({
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
  });
  const { startLobbyWatcherLoop, photonLobbyWatcherLoopStop } = createPhotonLobbyWatcher({
    friendStore,
    instanceStore,
    locationStore,
    favoriteStore,
    state,
    photonLobbyCurrentUser,
    photonLobbyCurrent,
    photonLobbyTimeout,
    photonLobbyJointime,
    photonEvent7List,
    photonLastEvent7List,
    timeoutHudOverlay,
    timeoutHudOverlayFilter,
    getDisplayNameFromPhotonId,
    getUserIdFromPhotonId,
  });
  const { parsePhotonEvent, parseVRCEvent } = createPhotonEventParser({
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
  });
  const { promptPhotonOverlayMessageTimeout, promptPhotonLobbyTimeoutThreshold } = createPhotonTimeoutPrompts({
    vrStore,
    modalStore,
    state,
    t,
  });

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
