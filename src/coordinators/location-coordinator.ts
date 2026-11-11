import { getGroupName } from "../shared/utils/group";
import { getWorldName } from "../shared/utils/world";
import { isRealInstance } from "../shared/utils/instance";
import { parseLocation } from "../shared/utils/location-parser";
import { database } from "../services/database";
import type { ParsedLocation } from "../types/vrcx";
import { useAdvancedSettingsStore } from "../stores/settings/advanced";
import { useFriendStore } from "../stores/friend";
import { useGameLogStore } from "../stores/gameLog";
import { useGameStore } from "../stores/game";
import { useInstanceStore } from "../stores/instance";
import { useLocationStore } from "../stores/location";
import { useNotificationStore } from "../stores/notification";
import { usePhotonStore } from "../stores/photon";
import { useUserStore } from "../stores/user";
import { useVrStore } from "../stores/vr";

type PlayerLeftEntry = {
  created_at: string;
  type: "OnPlayerLeft";
  displayName: string;
  location: string;
  userId: string;
  time: number;
};

type CachedUserRef = {
  location: string;
  travelingToLocation: string;
  $online_for: number;
  $offline_for: number | null;
  $active_for: number | null;
  $location: Partial<ParsedLocation>;
  $location_at: number | null;
  $travelingToTime: number | null;
};

function isCachedUser(value: unknown): value is CachedUserRef {
  return typeof value === "object" && value !== null;
}

function isUnknownArray(value: unknown): value is unknown[] {
  return Array.isArray(value);
}

function isLocationRow(value: unknown): value is { location: string } {
  return typeof value === "object" && value !== null && "location" in value && typeof value.location === "string";
}

function readLastLocation(rows: unknown): string {
  if (!isUnknownArray(rows) || rows.length === 0) {
    return "";
  }
  const [row] = rows;
  return isLocationRow(row) ? row.location : "";
}

export function runUpdateCurrentUserLocationFlow() {
  const advancedSettingsStore = useAdvancedSettingsStore();
  const userStore = useUserStore();
  const instanceStore = useInstanceStore();
  const gameStore = useGameStore();
  const locationStore = useLocationStore();

  const ref: unknown = userStore.cachedUsers.get(userStore.currentUser.id);
  if (!isCachedUser(ref)) {
    return;
  }

  let currentLocation = userStore.currentUser.$locationTag;
  const L = parseLocation(currentLocation);
  if (L.isTraveling) {
    currentLocation = userStore.currentUser.$travelingToLocation;
  }
  ref.location = userStore.currentUser.$locationTag;
  ref.travelingToLocation = userStore.currentUser.$travelingToLocation;

  if (gameStore.isGameRunning && !advancedSettingsStore.gameLogDisabled && locationStore.lastLocation.location !== "") {
    currentLocation = locationStore.lastLocation.location;
    if (locationStore.lastLocation.location === "traveling") {
      currentLocation = locationStore.lastLocationDestination;
    }
    ref.location = locationStore.lastLocation.location;
    ref.travelingToLocation = locationStore.lastLocationDestination;
  }

  ref.$online_for = userStore.currentUser.$online_for ?? 0;
  ref.$offline_for = userStore.currentUser.$offline_for;
  ref.$active_for = null;
  ref.$location = parseLocation(currentLocation);
  if (!gameStore.isGameRunning || advancedSettingsStore.gameLogDisabled) {
    ref.$location_at = userStore.currentUser.$location_at;
    ref.$travelingToTime = userStore.currentUser.$travelingToTime;
    userStore.applyUserDialogLocation();
    instanceStore.applyWorldDialogInstances();
    instanceStore.applyGroupDialogInstances();
  } else {
    ref.$location_at = locationStore.lastLocation.date;
    ref.$travelingToTime = locationStore.lastLocationDestinationTime;
    userStore.setCurrentUserTravelingToTime(locationStore.lastLocationDestinationTime);
  }
}

export async function runSetCurrentUserLocationFlow(location: string, travelingToLocation: string) {
  const userStore = useUserStore();
  const instanceStore = useInstanceStore();
  const notificationStore = useNotificationStore();
  const gameStore = useGameStore();
  const gameLogStore = useGameLogStore();
  const locationStore = useLocationStore();

  userStore.setCurrentUserLocationState(location, travelingToLocation);
  runUpdateCurrentUserLocationFlow();

  if (gameStore.isGameRunning) {
    return;
  }
  const lastLocationRows: unknown = await database.lookupGameLogDatabase(["Location"], [], 1);
  const lastLocationTemp = readLastLocation(lastLocationRows);
  if (lastLocationTemp === location) {
    return;
  }
  locationStore.setLastLocationDestination("");
  locationStore.setLastLocationDestinationTime(0);

  if (isRealInstance(location)) {
    const dt = new Date().toJSON();
    const L = parseLocation(location);

    locationStore.setLastLocation({
      ...locationStore.lastLocation,
      location,
      date: Date.now(),
    });

    const entry = {
      created_at: dt,
      type: "Location",
      location,
      worldId: L.worldId,
      worldName: await getWorldName(L.worldId),
      groupName: await getGroupName(L.groupId),
      time: 0,
    };
    notificationStore.queueGameLogNoty(entry);
    const persistedEntry = await database.addGamelogLocationToDatabase(entry);
    if (persistedEntry !== undefined) {
      gameLogStore.addGameLog(persistedEntry);
    }
    instanceStore.addInstanceJoinHistory(location, dt);

    userStore.applyUserDialogLocation();
    instanceStore.applyWorldDialogInstances();
    instanceStore.applyGroupDialogInstances();
  } else {
    locationStore.setLastLocation({
      ...locationStore.lastLocation,
      location: "",
      date: null,
    });
  }
}

export async function runLastLocationResetFlow(gameLogDate?: string) {
  const photonStore = usePhotonStore();
  const instanceStore = useInstanceStore();
  const gameLogStore = useGameLogStore();
  const vrStore = useVrStore();
  const userStore = useUserStore();
  const locationStore = useLocationStore();
  const friendStore = useFriendStore();

  const dateTime = gameLogDate === undefined || gameLogDate === "" ? new Date().toJSON() : gameLogDate;
  const dateTimeStamp = Date.parse(dateTime);
  photonStore.resetLocationPhotonState();
  const playerList = Array.from(locationStore.lastLocation.playerList.values());
  const dataBaseEntries: PlayerLeftEntry[] = [];
  for (const ref of playerList) {
    const entry: PlayerLeftEntry = {
      created_at: dateTime,
      type: "OnPlayerLeft",
      displayName: ref.displayName,
      location: locationStore.lastLocation.location,
      userId: ref.userId,
      time: dateTimeStamp - ref.joinTime,
    };
    dataBaseEntries.unshift(entry);
    friendStore.updateFriendLastSeen(ref.userId, dateTime);
  }
  const persistedEntries = await database.addGamelogJoinLeaveBulk(dataBaseEntries);
  for (const entry of persistedEntries) {
    gameLogStore.addGameLog(entry);
  }
  if (locationStore.lastLocation.date !== null && locationStore.lastLocation.date > 0) {
    const update = {
      time: dateTimeStamp - locationStore.lastLocation.date,
      created_at: new Date(locationStore.lastLocation.date).toJSON(),
    };
    database.updateGamelogLocationTimeToDatabase(update);
  }
  locationStore.setLastLocationDestination("");
  locationStore.setLastLocationDestinationTime(0);
  locationStore.setLastLocation({
    date: 0,
    location: "",
    name: "",
    playerList: new Map(),
    friendList: new Map(),
  });
  runUpdateCurrentUserLocationFlow();
  instanceStore.updateCurrentInstanceWorld();
  vrStore.updateVRLastLocation();
  instanceStore.getCurrentInstanceUserList();
  gameLogStore.resetLastMediaUrls();
  userStore.applyUserDialogLocation();
  instanceStore.applyWorldDialogInstances();
  instanceStore.applyGroupDialogInstances();
}
