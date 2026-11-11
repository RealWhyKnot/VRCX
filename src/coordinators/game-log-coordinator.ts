import dayjs from "dayjs";

import {
  createJoinLeaveEntry,
  createLocationEntry,
  createPortalSpawnEntry,
  createResourceLoadEntry,
  parseInventoryFromUrl,
  parsePrintFromUrl,
} from "../shared/utils/game-log";
import { findUserByDisplayName } from "../shared/utils/user";
import { parseLocation } from "../shared/utils/location-parser";
import { replaceBioSymbols } from "../shared/utils/base/string";
import { i18n } from "../plugins/i18n";
import { AppDebug, logWebRequest } from "../services/app-config";
import { database } from "../services/database";
import { runLastLocationResetFlow, runUpdateCurrentUserLocationFlow } from "./location-coordinator";
import { getGroupName } from "../shared/utils/group";
import { userRequest } from "../api/user";
import { watchState } from "../services/watch-state";
import { configRepository } from "../services/config";
import { toast } from "vue-sonner";

import { useAdvancedSettingsStore } from "../stores/settings/advanced";
import { useFriendStore } from "../stores/friend";
import { useGalleryStore } from "../stores/gallery";
import { useGameStore } from "../stores/game";
import { useGameLogStore } from "../stores/gameLog";
import type { GameLogEntry } from "../stores/gameLog/types";
import { useGeneralSettingsStore } from "../stores/settings/general";
import { useInstanceStore } from "../stores/instance";
import { useLocationStore } from "../stores/location";
import { useModalStore } from "../stores/modal";
import { logError } from "../stores/notification/errors";
import { useNotificationStore } from "../stores/notification";
import { usePhotonStore } from "../stores/photon";
import { useSharedFeedStore } from "../stores/shared-feed";
import { useUserStore } from "../stores/user";
import { useVrStore } from "../stores/vr";
import { useVrcxStore } from "../stores/vrcx";

import { gameLogService } from "../services/game-log.ts";

import * as workerTimers from "worker-timers";

import { isGameLogEntry, isGameLogEvent, isRawLogValue, type GameLogEvent } from "./game-log-event-types";

export async function tryLoadPlayerList() {
  const gameStore = useGameStore();
  const locationStore = useLocationStore();
  const userStore = useUserStore();
  const friendStore = useFriendStore();
  const instanceStore = useInstanceStore();
  const vrStore = useVrStore();

  if (!gameStore.isGameRunning) {
    return;
  }
  console.log("Loading player list from game log...");
  const data = await database.getGamelogDatabase();
  if (data.length === 0) {
    return;
  }
  let length = 0;
  for (let i = data.length - 1; i > -1; i--) {
    const ctx = data[i];
    if (ctx?.type === "Location") {
      locationStore.setLastLocation({
        date: Date.parse(ctx.created_at ?? ""),
        location: ctx.location ?? "",
        name: ctx.worldName ?? "",
        playerList: new Map(),
        friendList: new Map(),
      });
      length = i;
      break;
    }
  }
  if (length > 0) {
    for (let i = length + 1; i < data.length; i++) {
      const ctx = data[i];
      if (ctx?.type === "OnPlayerJoined") {
        const displayName = ctx.displayName ?? "";
        const knownUserId = ctx.userId ?? "";
        const userId =
          knownUserId !== "" ? knownUserId : (findUserByDisplayName(userStore.cachedUsers, displayName, userStore.cachedUserIdsByDisplayName)?.id ?? "");
        ctx.userId = userId;
        const userMap = {
          displayName,
          userId,
          joinTime: Date.parse(ctx.created_at ?? ""),
          lastAvatar: "",
        };
        locationStore.lastLocation.playerList.set(userId, userMap);
        if (friendStore.friends.has(userId)) {
          locationStore.lastLocation.friendList.set(userId, userMap);
        }
      }
      if (ctx?.type === "OnPlayerLeft" && typeof ctx.userId === "string") {
        locationStore.lastLocation.playerList.delete(ctx.userId);
        locationStore.lastLocation.friendList.delete(ctx.userId);
      }
    }
    locationStore.lastLocation.playerList.forEach((ref1) => {
      if (ref1.userId) {
        if (!userStore.cachedUsers.has(ref1.userId)) {
          userRequest.getUser({ userId: ref1.userId }).catch(logError);
        }
        if (!userStore.cachedProfiles.has(ref1.userId)) {
          userRequest.getPublicProfile({ userId: ref1.userId }).catch(logError);
        }
      }
    });

    runUpdateCurrentUserLocationFlow();
    instanceStore.updateCurrentInstanceWorld();
    vrStore.updateVRLastLocation();
    instanceStore.getCurrentInstanceUserList();
    userStore.applyUserDialogLocation();
    instanceStore.applyWorldDialogInstances();
    instanceStore.applyGroupDialogInstances();
  }
}

export async function addGameLogEntry(gameLog: GameLogEvent, location: string): Promise<void> {
  const gameLogStore = useGameLogStore();
  const locationStore = useLocationStore();
  const instanceStore = useInstanceStore();
  const userStore = useUserStore();
  const friendStore = useFriendStore();
  const vrStore = useVrStore();
  const gameStore = useGameStore();
  const vrcxStore = useVrcxStore();
  const advancedSettingsStore = useAdvancedSettingsStore();
  const generalSettingsStore = useGeneralSettingsStore();
  const galleryStore = useGalleryStore();
  const photonStore = usePhotonStore();
  const sharedFeedStore = useSharedFeedStore();
  const notificationStore = useNotificationStore();

  let entry: GameLogEntry | undefined = undefined;
  let persistedEntryPromise: Promise<unknown> | undefined;
  if (advancedSettingsStore.gameLogDisabled) {
    return;
  }
  const userId = "userId" in gameLog && gameLog.userId ? gameLog.userId : "";
  let resolvedUserId = userId;
  if (!resolvedUserId && "displayName" in gameLog && gameLog.displayName) {
    resolvedUserId = findUserByDisplayName(userStore.cachedUsers, gameLog.displayName, userStore.cachedUserIdsByDisplayName)?.id ?? "";
  }
  switch (gameLog.type) {
    case "location-destination":
      if (gameStore.isGameRunning) {
        gameLogStore.addGameLog({
          created_at: gameLog.dt,
          type: "LocationDestination",
          location: gameLog.location,
        });
        await runLastLocationResetFlow(gameLog.dt);
        locationStore.setLastLocationLocation("traveling");
        locationStore.setLastLocationDestination(gameLog.location);
        locationStore.setLastLocationDestinationTime(Date.parse(gameLog.dt));
        gameLogStore.state.lastLocationAvatarList.clear();
        instanceStore.removeQueuedInstance(gameLog.location);
        runUpdateCurrentUserLocationFlow();
        gameLogStore.clearNowPlaying();
        gameLogStore.resetNowPlayingProducers();
        instanceStore.updateCurrentInstanceWorld();
        userStore.applyUserDialogLocation();
        instanceStore.applyWorldDialogInstances();
        instanceStore.applyGroupDialogInstances();
      }
      break;
    case "location": {
      instanceStore.addInstanceJoinHistory(locationStore.lastLocation.location, gameLog.dt);
      const worldName = replaceBioSymbols(gameLog.worldName);
      if (gameStore.isGameRunning) {
        await runLastLocationResetFlow(gameLog.dt);
        gameLogStore.clearNowPlaying();
        gameLogStore.resetNowPlayingProducers();
        locationStore.setLastLocation({
          date: Date.parse(gameLog.dt),
          location: gameLog.location,
          name: worldName,
          playerList: new Map(),
          friendList: new Map(),
        });
        instanceStore.removeQueuedInstance(gameLog.location);
        runUpdateCurrentUserLocationFlow();
        vrStore.updateVRLastLocation();
        instanceStore.updateCurrentInstanceWorld();
        userStore.applyUserDialogLocation();
        instanceStore.applyWorldDialogInstances();
        instanceStore.applyGroupDialogInstances();
      }
      instanceStore.addInstanceJoinHistory(gameLog.location, gameLog.dt);
      const parsedLocation = parseLocation(gameLog.location);
      const locationEntry = createLocationEntry(gameLog.dt, gameLog.location, parsedLocation.worldId, worldName);
      entry = locationEntry;
      getGroupName(gameLog.location)
        .then((groupName) => {
          locationEntry.groupName = groupName;
        })
        .catch(logError);
      persistedEntryPromise = gameLogStore.addGamelogLocationToDatabase(locationEntry);
      break;
    }
    case "player-joined": {
      const joinTime = Date.parse(gameLog.dt);
      const userMap = {
        displayName: gameLog.displayName,
        userId: resolvedUserId,
        joinTime,
        lastAvatar: "",
      };
      locationStore.lastLocation.playerList.set(resolvedUserId, userMap);
      const ref = userStore.cachedUsers.get(resolvedUserId);
      if (!resolvedUserId) {
        console.error("Missing userId:", gameLog.displayName);
      } else if (resolvedUserId !== userStore.currentUser.id) {
        if (friendStore.friends.has(resolvedUserId) && typeof ref !== "undefined") {
          locationStore.lastLocation.friendList.set(resolvedUserId, userMap);
          friendStore.updateFriendLastSeen(resolvedUserId, gameLog.dt);
          if (ref.location !== locationStore.lastLocation.location && ref.travelingToLocation !== locationStore.lastLocation.location) {
            ref.$location_at = joinTime;
          }
        } else if (typeof ref !== "undefined") {
          ref.$location_at = joinTime;
        } else {
          if (AppDebug.debugGameLog || AppDebug.debugWebRequests) {
            console.log("Fetching user from gameLog:", resolvedUserId);
          }
          userRequest.getUser({ userId: resolvedUserId }).catch(logError);
          userRequest.getPublicProfile({ userId: resolvedUserId }).catch(logError);
        }
      }
      vrStore.updateVRLastLocation();
      instanceStore.getCurrentInstanceUserList();
      const joinEntry = createJoinLeaveEntry("OnPlayerJoined", gameLog.dt, gameLog.displayName, location, resolvedUserId);
      entry = joinEntry;
      persistedEntryPromise = database.addGamelogJoinLeaveToDatabase(joinEntry);
      break;
    }
    case "player-left": {
      const ref1 = locationStore.lastLocation.playerList.get(resolvedUserId);
      if (typeof ref1 === "undefined") {
        break;
      }
      const time = dayjs(gameLog.dt).valueOf() - ref1.joinTime;
      locationStore.lastLocation.playerList.delete(resolvedUserId);
      locationStore.lastLocation.friendList.delete(resolvedUserId);
      friendStore.updateFriendLastSeen(resolvedUserId, gameLog.dt);
      gameLogStore.state.lastLocationAvatarList.delete(gameLog.displayName);
      photonStore.photonLobbyAvatars.delete(resolvedUserId);
      vrStore.updateVRLastLocation();
      instanceStore.getCurrentInstanceUserList();
      const leaveEntry = createJoinLeaveEntry("OnPlayerLeft", gameLog.dt, gameLog.displayName, location, resolvedUserId, time);
      entry = leaveEntry;
      persistedEntryPromise = database.addGamelogJoinLeaveToDatabase(leaveEntry);
      break;
    }
    case "portal-spawn": {
      if (vrcxStore.ipcEnabled && gameStore.isGameRunning) {
        break;
      }
      const portalEntry = createPortalSpawnEntry(gameLog.dt, location);
      entry = portalEntry;
      persistedEntryPromise = database.addGamelogPortalSpawnToDatabase(portalEntry);
      break;
    }
    case "nowplaying":
      await gameLogStore.handleNowPlayingEvent(gameLog, location);
      break;
    case "video-play":
      if (gameLogStore.hasNowPlayingProducer()) {
        break;
      }
      gameLog.videoUrl = decodeURI(gameLog.videoUrl);
      if (gameLogStore.lastVideoUrl === gameLog.videoUrl) {
        break;
      }
      gameLogStore.setLastVideoUrl(gameLog.videoUrl);
      await gameLogStore.addGameLogVideo(gameLog, location, resolvedUserId);
      break;
    case "video-sync": {
      const timestamp = gameLog.timestamp.replace(/,/g, "");
      if (gameLogStore.nowPlaying.playing) {
        gameLogStore.nowPlaying.offset = Number(timestamp);
      }
      break;
    }
    case "resource-load-string":
    case "resource-load-image": {
      if (!generalSettingsStore.logResourceLoad || gameLogStore.lastResourceloadUrl === gameLog.resourceUrl) {
        break;
      }
      gameLogStore.setLastResourceloadUrl(gameLog.resourceUrl);
      const resourceEntry = createResourceLoadEntry(gameLog.type, gameLog.dt, gameLog.resourceUrl, location);
      entry = resourceEntry;
      persistedEntryPromise = database.addGamelogResourceLoadToDatabase(resourceEntry);
      break;
    }
    case "screenshot":
      vrcxStore.processScreenshot(gameLog.screenshotPath).catch(logError);
      break;
    case "api-request":
      logWebRequest("[GAMELOG API]", gameLog.url);
      if (advancedSettingsStore.saveInstanceEmoji) {
        const inv = parseInventoryFromUrl(gameLog.url);
        if (inv) {
          galleryStore.queueCheckInstanceInventory(inv.inventoryId, inv.userId);
        }
      }
      if (advancedSettingsStore.saveInstancePrints) {
        const printId = parsePrintFromUrl(gameLog.url);
        if (printId) {
          galleryStore.queueSavePrintToFile(printId);
        }
      }
      break;
    case "avatar-change": {
      if (!gameStore.isGameRunning) {
        break;
      }
      let avatarName = gameLogStore.state.lastLocationAvatarList.get(gameLog.displayName);
      if (photonStore.photonLoggingEnabled || avatarName === gameLog.avatarName) {
        break;
      }
      if (!avatarName) {
        avatarName = gameLog.avatarName;
        gameLogStore.state.lastLocationAvatarList.set(gameLog.displayName, avatarName);
        break;
      }
      avatarName = gameLog.avatarName;
      gameLogStore.state.lastLocationAvatarList.set(gameLog.displayName, avatarName);
      const avatarEntry = {
        created_at: gameLog.dt,
        type: "AvatarChange",
        userId: resolvedUserId,
        name: avatarName,
        displayName: gameLog.displayName,
      };
      entry = avatarEntry;
      break;
    }
    case "vrcx": {
      const type = gameLog.data.slice(0, Math.max(gameLog.data.indexOf(" "), 0));
      if (type === "VideoPlay(VRDancing)") {
        await gameLogStore.addGameLogVRDancing(gameLog, location);
      } else if (type === "LSMedia") {
        await gameLogStore.addGameLogLSMedia(gameLog, location);
      } else if (type === "VideoPlay(PopcornPalace)") {
        await gameLogStore.addGameLogPopcornPalace(gameLog, location);
      }
      break;
    }
    case "photon-id": {
      if (!gameStore.isGameRunning || !watchState.isFriendsLoaded) {
        break;
      }
      const photonId = Number(gameLog.photonId);
      const ref2 = photonStore.photonLobby.get(photonId);
      if (typeof ref2 === "undefined") {
        const foundUser = findUserByDisplayName(userStore.cachedUsers, gameLog.displayName, userStore.cachedUserIdsByDisplayName);
        if (foundUser) {
          photonStore.photonLobby.set(photonId, foundUser);
          photonStore.photonLobbyCurrent.set(photonId, foundUser);
        }
        const ctx1 = {
          displayName: gameLog.displayName,
        };
        photonStore.photonLobby.set(photonId, ctx1);
        photonStore.photonLobbyCurrent.set(photonId, ctx1);
        instanceStore.getCurrentInstanceUserList();
      }
      break;
    }
    case "notification":
      break;
    case "event": {
      const eventEntry = {
        created_at: gameLog.dt,
        type: "Event",
        data: gameLog.event,
      };
      entry = eventEntry;
      persistedEntryPromise = database.addGamelogEventToDatabase(eventEntry);
      if (gameStore.isGameRunning && gameLog.event.startsWith("VideoError: ")) {
        checkYoutubeBotError(gameLog.event).catch(logError);
      }
      break;
    }
    case "vrc-quit":
      if (!gameStore.isGameRunning) {
        break;
      }
      if (advancedSettingsStore.vrcQuitFix) {
        const bias = Date.parse(gameLog.dt) + 3000;
        if (bias < Date.now()) {
          console.log("QuitFix: Bias too low, not killing VRC");
          break;
        }
        AppApi.QuitGame()
          .then((processCount) => {
            if (processCount > 1) {
              console.log("QuitFix: More than 1 process running, not killing VRC");
            } else if (processCount === 1) {
              console.log("QuitFix: Killed VRC");
            } else {
              console.log("QuitFix: Nothing to kill, no VRC process running");
            }
          })
          .catch(logError);
      }
      break;
    case "openvr-init":
      gameStore.setIsGameNoVR(false);
      configRepository.setBool("isGameNoVR", false).catch(logError);
      vrStore.updateOpenVR();
      break;
    case "desktop-mode":
      gameStore.setIsGameNoVR(true);
      configRepository.setBool("isGameNoVR", true).catch(logError);
      vrStore.updateOpenVR();
      break;
    case "udon-exception":
      if (generalSettingsStore.udonExceptionLogging) {
        console.log("UdonException", gameLog.data);
      }
      break;
    case "sticker-spawn":
      if (!advancedSettingsStore.saveInstanceStickers) {
        break;
      }
      galleryStore.trySaveStickerToFile(gameLog.displayName, gameLog.userId, gameLog.inventoryId).catch(logError);
      break;
  }
  if (typeof entry !== "undefined") {
    sharedFeedStore.addEntry(entry).catch(logError);
    notificationStore.queueGameLogNoty(entry);
    if (persistedEntryPromise) {
      const persistedEntry = await persistedEntryPromise;
      if (isGameLogEntry(persistedEntry)) {
        gameLogStore.addGameLog(persistedEntry);
      }
    } else {
      gameLogStore.addGameLog(entry);
    }
  }
}

let hasShownYoutubeBotPrompt = false;

async function checkYoutubeBotError(videoError: string): Promise<void> {
  if (hasShownYoutubeBotPrompt || !videoError.includes("Sign in to confirm")) {
    return;
  }
  hasShownYoutubeBotPrompt = true;
  if (await configRepository.getBool("VRCX_hideYoutubeBotErrorPrompt", false)) {
    return;
  }
  const t = i18n.global.t;
  const { ok, checked } = await useModalStore().confirm({
    description: t("confirm.youtube_bot_error"),
    title: t("confirm.youtube_bot_error_title"),
    checkboxLabel: t("dialog.alertdialog.dont_show_again"),
  });
  if (checked) {
    configRepository.setBool("VRCX_hideYoutubeBotErrorPrompt", true).catch(logError);
  }
  if (ok) {
    AppApi.OpenSteamStorePage(4296960).catch(logError);
  }
}

let gameLogQueue: Promise<void> = Promise.resolve();

function enqueueGameLogTask(task: () => Promise<void>): Promise<void> {
  gameLogQueue = gameLogQueue.then(task).catch(console.error);
  return gameLogQueue;
}

export function addGameLogEvent(json: string): Promise<void> {
  return enqueueGameLogTask(() => processGameLogEvent(json));
}

async function processGameLogEvent(json: string): Promise<void> {
  const locationStore = useLocationStore();

  const rawLogs: unknown = JSON.parse(json);
  if (!Array.isArray(rawLogs)) {
    throw new TypeError("game log event payload is not an array");
  }
  const dt: unknown = rawLogs[1];
  const type: unknown = rawLogs[2];
  const args = rawLogs.slice(3);
  if (!isRawLogValue(dt) || !isRawLogValue(type) || !args.every(isRawLogValue)) {
    return;
  }
  const gameLog: unknown = gameLogService.parseRawGameLog(dt, type, args);
  if (!isGameLogEvent(gameLog)) {
    return;
  }
  if (AppDebug.debugGameLog && gameLog.type !== "photon-id" && gameLog.type !== "api-request" && gameLog.type !== "udon-exception") {
    console.log("gameLog:", gameLog);
  }
  await addGameLogEntry(gameLog, locationStore.lastLocation.location);
}

export async function getGameLogTable(): Promise<void> {
  const dateTill = await database.getLastDateGameLogDatabase();
  await updateGameLog(dateTill);
}

async function updateGameLog(dateTill: string): Promise<void> {
  await gameLogService.setDateTill(dateTill);
  await new Promise<void>((resolve) => {
    workerTimers.setTimeout(resolve, 10000);
  });
  await enqueueGameLogTask(async () => {
    let location = "";
    const rows: unknown = await gameLogService.getAll();
    if (!Array.isArray(rows)) {
      return;
    }
    for (const row of rows) {
      if (!isGameLogEvent(row)) continue;
      if (row.type === "location") {
        location = row.location;
      }
      await addGameLogEntry(row, location);
    }
  });
}

export function disableGameLogDialog(): void {
  const gameStore = useGameStore();
  const advancedSettingsStore = useAdvancedSettingsStore();
  const modalStore = useModalStore();
  const t = i18n.global.t;

  if (gameStore.isGameRunning) {
    toast.error(t("message.gamelog.vrchat_must_be_closed"));
    return;
  }
  if (!advancedSettingsStore.gameLogDisabled) {
    modalStore
      .confirm({
        description: t("confirm.disable_gamelog"),
        title: t("confirm.title"),
      })
      .then(({ ok }) => {
        if (!ok) return;
        return advancedSettingsStore.setGameLogDisabled();
      })
      .catch(logError);
  } else {
    advancedSettingsStore.setGameLogDisabled().catch(logError);
  }
}
