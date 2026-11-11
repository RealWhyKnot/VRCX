import * as workerTimers from "worker-timers";
import type { Ref } from "vue";

import type { PhotonHudTimeout } from "./photon-types";
import { logPhotonError } from "./photon-errors";
import type { useFriendStore } from "./friend";
import type { useInstanceStore } from "./instance";
import type { useLocationStore } from "./location";
import type { useFavoriteStore } from "./favorite";
import type { PhotonState, PhotonId, PhotonLobbyEntry, PhotonJointime } from "./photon-types";

export type CreatePhotonLobbyWatcherDeps = {
  friendStore: ReturnType<typeof useFriendStore>;
  instanceStore: ReturnType<typeof useInstanceStore>;
  locationStore: ReturnType<typeof useLocationStore>;
  favoriteStore: ReturnType<typeof useFavoriteStore>;
  state: PhotonState;
  photonLobbyCurrentUser: Ref<number>;
  photonLobbyCurrent: Ref<Map<PhotonId, PhotonLobbyEntry | undefined>>;
  photonLobbyTimeout: Ref<PhotonHudTimeout[]>;
  photonLobbyJointime: Ref<Map<PhotonId, PhotonJointime>>;
  photonEvent7List: Ref<Map<PhotonId, string>>;
  photonLastEvent7List: Ref<number>;
  timeoutHudOverlay: Ref<boolean>;
  timeoutHudOverlayFilter: Ref<string>;
  getDisplayNameFromPhotonId: (photonId: PhotonId) => string;
  getUserIdFromPhotonId: (photonId: PhotonId) => string;
};

export function createPhotonLobbyWatcher(deps: CreatePhotonLobbyWatcherDeps) {
  const {
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
  } = deps;

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

  return {
    startLobbyWatcherLoop,
    photonLobbyWatcherLoopStop,
  };
}
