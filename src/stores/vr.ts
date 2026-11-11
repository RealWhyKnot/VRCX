import { defineStore } from "pinia";
import { watch } from "vue";

import { isRpcWorld } from "../shared/utils/world";
import { useAdvancedSettingsStore } from "./settings/advanced";
import { useAppearanceSettingsStore } from "./settings/appearance";
import { useFriendStore } from "./friend";
import { useGameLogStore } from "./gameLog";
import { useGameStore } from "./game";
import { useLocationStore } from "./location";
import { useNotificationsSettingsStore } from "./settings/notifications";
import { logFailure } from "./log-failure";
import { usePhotonStore } from "./photon";
import { useSharedFeedStore } from "./shared-feed";
import { useUserStore } from "./user";
import { useWristOverlaySettingsStore } from "./settings/wrist-overlay";
import { watchState } from "../services/watch-state";

export const useVrStore = defineStore("Vr", () => {
  const friendStore = useFriendStore();
  const advancedSettingsStore = useAdvancedSettingsStore();
  const wristOverlaySettingsStore = useWristOverlaySettingsStore();
  const locationStore = useLocationStore();
  const notificationsSettingsStore = useNotificationsSettingsStore();
  const photonStore = usePhotonStore();
  const appearanceSettingsStore = useAppearanceSettingsStore();
  const gameStore = useGameStore();
  const gameLogStore = useGameLogStore();
  const userStore = useUserStore();
  const sharedFeedStore = useSharedFeedStore();

  watch(
    () => watchState.isFriendsLoaded,
    (isFriendsLoaded) => {
      if (isFriendsLoaded) {
        vrInit();
      }
    },
    { flush: "sync" }
  );

  function vrInit() {
    updateVRConfigVars();
    updateVRLastLocation();
    updateVrNowPlaying();

    sharedFeedStore.sendSharedFeed().catch(logFailure("Failed to send shared feed to VR:"));
    friendStore.updateOnlineFriendCounter(true);
  }

  function saveOpenVROption() {
    updateVRConfigVars();
    updateVRLastLocation();
    AppApi.ExecuteVrOverlayFunction("notyClear", "").catch(logFailure("Failed to clear VR notifications:"));
    updateOpenVR();
  }

  function updateVrNowPlaying() {
    const json = JSON.stringify(gameLogStore.nowPlaying);
    AppApi.ExecuteVrOverlayFunction("nowPlayingUpdate", json).catch(logFailure("Failed to update VR now playing:"));
  }

  function updateVRLastLocation() {
    let isProgressPie = false;
    if (advancedSettingsStore.progressPie) {
      isProgressPie = true;
      if (advancedSettingsStore.progressPieFilter) {
        if (!isRpcWorld(locationStore.lastLocation.location)) {
          isProgressPie = false;
        }
      }
    }
    let onlineFor = null;
    if (!wristOverlaySettingsStore.hideUptimeFromFeed) {
      onlineFor = userStore.currentUser.$online_for;
    }
    const lastLocation = {
      date: locationStore.lastLocation.date,
      location: locationStore.lastLocation.location,
      name: locationStore.lastLocation.name,
      playerList: Array.from(locationStore.lastLocation.playerList.values()),
      friendList: Array.from(locationStore.lastLocation.friendList.values()),
      progressPie: isProgressPie,
      onlineFor,
    };
    const json = JSON.stringify(lastLocation);
    AppApi.ExecuteVrOverlayFunction("lastLocationUpdate", json).catch(logFailure("Failed to update VR last location:"));
  }

  function updateVRConfigVars() {
    let notificationTheme = "relax";
    if (appearanceSettingsStore.isDarkMode) {
      notificationTheme = "sunset";
    }

    const VRConfigVars = {
      overlayNotifications: notificationsSettingsStore.overlayNotifications,
      hideDevicesFromFeed: wristOverlaySettingsStore.hideDevicesFromFeed,
      vrOverlayCpuUsage: wristOverlaySettingsStore.vrOverlayCpuUsage,
      minimalFeed: wristOverlaySettingsStore.minimalFeed,
      notificationPosition: notificationsSettingsStore.notificationPosition,
      notificationTimeout: notificationsSettingsStore.notificationTimeout,
      photonOverlayMessageTimeout: photonStore.photonOverlayMessageTimeout,
      notificationTheme,
      backgroundEnabled: wristOverlaySettingsStore.vrBackgroundEnabled,
      dtHour12: appearanceSettingsStore.dtHour12,
      pcUptimeOnFeed: wristOverlaySettingsStore.pcUptimeOnFeed,
      appLanguage: appearanceSettingsStore.appLanguage,
      notificationOpacity: advancedSettingsStore.notificationOpacity,
      isWristDisabled: !wristOverlaySettingsStore.overlayWrist,
    };

    const json = JSON.stringify(VRConfigVars);
    AppApi.ExecuteVrOverlayFunction("configUpdate", json).catch(logFailure("Failed to update VR config:"));
  }

  function updateOpenVR() {
    let newState = {
      active: false,
      hmdOverlay: false,
      wristOverlay: false,
      menuButton: false,
      overlayHand: 0,
    };
    if (
      notificationsSettingsStore.openVR &&
      gameStore.isSteamVRRunning &&
      ((gameStore.isGameRunning && !gameStore.isGameNoVR) || wristOverlaySettingsStore.openVRAlways)
    ) {
      let hasHmdOverlay = false;
      if (
        notificationsSettingsStore.overlayNotifications ||
        advancedSettingsStore.progressPie ||
        photonStore.photonEventOverlay ||
        photonStore.timeoutHudOverlay
      ) {
        hasHmdOverlay = true;
      }
      const overlayHand = Number(wristOverlaySettingsStore.overlayHand);
      newState = {
        active: true,
        hmdOverlay: hasHmdOverlay,
        wristOverlay: wristOverlaySettingsStore.overlayWrist,
        menuButton: wristOverlaySettingsStore.overlaybutton,
        overlayHand: Number.isFinite(overlayHand) ? overlayHand : 0,
      };
    }

    AppApi.SetVR(newState.active, newState.hmdOverlay, newState.wristOverlay, newState.menuButton, newState.overlayHand).catch(
      logFailure("Failed to set VR overlay state:")
    );
    if (!newState.active) {
      gameStore.setIsHmdAfk(false);
    }

    if (isHostLinux) {
      window.electron
        .updateVr(newState.active, newState.hmdOverlay, newState.wristOverlay, newState.menuButton, newState.overlayHand)
        .catch(logFailure("Failed to update VR overlay on Linux:"));

      vrInit();
    }
  }

  return {
    vrInit,
    saveOpenVROption,
    updateVrNowPlaying,
    updateVRLastLocation,
    updateVRConfigVars,
    updateOpenVR,
  };
});
