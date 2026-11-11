import type { Ref } from "vue";

import type { InstanceUserEntry, PlayerRef } from "./instance-types";
import { watchState } from "../services/watch-state";
import { isPhotonMember, isPhotonJointime, isPhotonTimeout } from "./instance-type-guards";
import { joinTimeOrNow } from "./instance-value-parsers";
import type { useLocationStore } from "./location";
import type { useUserStore } from "./user";
import type { usePhotonStore } from "./photon";
import type { VrcxUser } from "../types/vrcx";

export type CreateInstancePlayerListDeps = {
  locationStore: ReturnType<typeof useLocationStore>;
  userStore: ReturnType<typeof useUserStore>;
  photonStore: ReturnType<typeof usePhotonStore>;
  state: { updatePlayerListTimer: ReturnType<typeof setTimeout> | null; updatePlayerListPending: boolean };
  cachedUserOf: (id: string) => VrcxUser | undefined;
  currentInstanceUsersData: Ref<InstanceUserEntry[]>;
};

export function createInstancePlayerList(deps: CreateInstancePlayerListDeps) {
  const { locationStore, userStore, photonStore, state, cachedUserOf, currentInstanceUsersData } = deps;

  function getCurrentInstanceUserList() {
    if (!watchState.isFriendsLoaded) {
      return;
    }
    if (state.updatePlayerListTimer) {
      state.updatePlayerListPending = true;
    } else {
      updatePlayerListExecute();
      state.updatePlayerListTimer = setTimeout(() => {
        if (state.updatePlayerListPending) {
          updatePlayerListExecute();
        }
        state.updatePlayerListTimer = null;
      }, 150);
    }
  }

  function updatePlayerListExecute() {
    try {
      updatePlayerListDebounce();
    } catch (err) {
      console.error(err);
    }
    state.updatePlayerListTimer = null;
    state.updatePlayerListPending = false;
  }

  function updatePlayerListDebounce() {
    const users: InstanceUserEntry[] = [];
    const pushUser = function (ref: PlayerRef, profileRef: unknown) {
      let photonId = -1;
      let isFriend = false;
      let isBlocked = false;
      let isMuted = false;
      let isAvatarInteractionDisabled = false;
      let isChatBoxMuted = false;
      let isAgeVerified = false;
      const lobbyCurrent: Map<unknown, unknown> = photonStore.photonLobbyCurrent;
      lobbyCurrent.forEach((value, id) => {
        if (!isPhotonMember(value) || typeof id !== "number") {
          return;
        }
        if (
          (typeof ref.id !== "undefined" && typeof value.id !== "undefined" && value.id === ref.id) ||
          (typeof ref.displayName !== "undefined" && typeof value.displayName !== "undefined" && value.displayName === ref.displayName)
        ) {
          photonId = id;
        }
      });
      let isMaster = false;
      if (photonStore.photonLobbyMaster !== 0 && photonId === photonStore.photonLobbyMaster) {
        isMaster = true;
      }
      let isModerator = false;
      const lobbyJointimeMap: Map<unknown, unknown> = photonStore.photonLobbyJointime;
      const lobbyJointimeValue: unknown = lobbyJointimeMap.get(photonId);
      let isInVRMode: boolean | null = null;
      let groupOnNameplate = "";
      if (isPhotonJointime(lobbyJointimeValue)) {
        isInVRMode = lobbyJointimeValue.inVRMode;
        groupOnNameplate = lobbyJointimeValue.groupOnNameplate;
        isModerator = lobbyJointimeValue.canModerateInstance;
      }

      let timeoutTime = 0;
      const lobbyTimeouts: unknown[] = photonStore.photonLobbyTimeout;
      if (typeof ref.id !== "undefined") {
        isFriend = ref.isFriend ?? false;
        if (photonStore.timeoutHudOverlayFilter === "VIP" || photonStore.timeoutHudOverlayFilter === "Friends") {
          lobbyTimeouts.forEach((entry) => {
            if (isPhotonTimeout(entry) && entry.userId === ref.id) {
              timeoutTime = entry.time;
            }
          });
        } else {
          lobbyTimeouts.forEach((entry) => {
            if (isPhotonTimeout(entry) && entry.displayName === ref.displayName) {
              timeoutTime = entry.time;
            }
          });
        }
        isBlocked = ref.$moderations?.isBlocked ?? false;
        isMuted = ref.$moderations?.isMuted ?? false;
        isAvatarInteractionDisabled = ref.$moderations?.isAvatarInteractionDisabled ?? false;
        isChatBoxMuted = ref.$moderations?.isChatBoxMuted ?? false;
        isAgeVerified = ref.ageVerificationStatus === "18+";
      }
      users.push({
        ref,
        profileRef,
        displayName: ref.displayName,
        timer: ref.$location_at,
        $trustSortNum: ref.$trustSortNum ?? 0,
        photonId,
        isMaster,
        isModerator,
        inVRMode: isInVRMode,
        groupOnNameplate,
        isFriend,
        timeoutTime,
        isBlocked,
        isMuted,
        isAvatarInteractionDisabled,
        isChatBoxMuted,
        ageVerified: isAgeVerified,
      });
    };

    const playersInInstance = locationStore.lastLocation.playerList;
    if (playersInInstance.size > 0) {
      const currentUserRef = cachedUserOf(userStore.currentUser.id);
      const profileRef: unknown = userStore.cachedProfiles.get(userStore.currentUser.id);
      if (typeof currentUserRef !== "undefined" && playersInInstance.has(currentUserRef.id)) {
        pushUser(currentUserRef, profileRef);
      }
      for (const player of playersInInstance.values()) {
        if (player.displayName === userStore.currentUser.displayName) {
          continue;
        }
        const isMissingUser = !users.some(function (user) {
          return player.displayName === user.displayName;
        });
        if (isMissingUser) {
          const ref = cachedUserOf(player.userId);
          const playerProfileRef: unknown = userStore.cachedProfiles.get(player.userId);
          if (typeof ref !== "undefined") {
            pushUser(ref, playerProfileRef);
          } else {
            const joinTime = joinTimeOrNow(locationStore.lastLocation.playerList.get(player.userId)?.joinTime);
            pushUser(
              {
                displayName: player.displayName,
                $location_at: joinTime,
                $online_for: joinTime,
              },
              playerProfileRef
            );
          }
        }
      }
    }
    currentInstanceUsersData.value = users;
  }

  return {
    getCurrentInstanceUserList,
  };
}
