import { reactive, ref } from "vue";
import { defineStore } from "pinia";
import { useI18n } from "vue-i18n";

import { getGroupName } from "../../shared/utils/group";
import { getLaunchURL, isRealInstance } from "../../shared/utils/instance";
import { isRpcWorld } from "../../shared/utils/world";
import { parseLocation } from "../../shared/utils/location-parser";
import { getPlatformLabel, getRpcWorldConfig, getStatusInfo, isPopcornPalaceWorld } from "../../shared/utils/discord-presence";
import { ActivityType, StatusDisplayType } from "../../shared/constants/discord";
import { queryRequest } from "../../api/query-request";
import { useGameLogStore } from "../gameLog";
import { useGameStore } from "../game";
import { useLocationStore } from "../location";
import { useUpdateLoopStore } from "../update-loop";
import { useUserStore } from "../user";
import { useInstanceStore } from "../instance";

import { configRepository } from "../../services/config";

function logDiscordPresenceError(message: string) {
  return (error: unknown) => {
    console.error(message, error);
  };
}

export const useDiscordPresenceSettingsStore = defineStore("DiscordPresenceSettings", () => {
  const locationStore = useLocationStore();
  const gameStore = useGameStore();
  const gameLogStore = useGameLogStore();
  const userStore = useUserStore();
  const updateLoopStore = useUpdateLoopStore();
  const instanceStore = useInstanceStore();
  const { t } = useI18n();

  const state = reactive({
    isDiscordActive: false,
    lastLocationDetails: {
      tag: "",
      instanceName: "",
      accessType: "",
      worldId: "",
      worldName: "",
      thumbnailImageUrl: "",
      worldCapacity: 0,
      joinUrl: "",
      worldLink: "",
      accessName: "",
      groupAccessType: "",
      groupAccessName: "",
    },
  });

  const discordActive = ref(false);
  const discordInstance = ref(true);
  const discordHideInvite = ref(true);
  const discordJoinButton = ref(false);
  const discordHideImage = ref(false);
  const discordShowPlatform = ref(true);
  const discordWorldIntegration = ref(true);
  const discordWorldNameAsDiscordStatus = ref(false);
  const discordMediaImage = ref(false);

  function saveDiscordFlag(key: string, isEnabled: boolean) {
    void configRepository.setBool(key, isEnabled).catch(logDiscordPresenceError(`Error saving ${key}:`));
  }

  function setDiscordActive() {
    discordActive.value = !discordActive.value;
    saveDiscordFlag("discordActive", discordActive.value);
  }
  function setDiscordInstance() {
    discordInstance.value = !discordInstance.value;
    saveDiscordFlag("discordInstance", discordInstance.value);
  }
  function setDiscordHideInvite() {
    discordHideInvite.value = !discordHideInvite.value;
    saveDiscordFlag("discordHideInvite", discordHideInvite.value);
  }
  function setDiscordJoinButton() {
    discordJoinButton.value = !discordJoinButton.value;
    saveDiscordFlag("discordJoinButton", discordJoinButton.value);
  }
  function setDiscordHideImage() {
    discordHideImage.value = !discordHideImage.value;
    saveDiscordFlag("discordHideImage", discordHideImage.value);
  }
  function setDiscordShowPlatform() {
    discordShowPlatform.value = !discordShowPlatform.value;
    saveDiscordFlag("discordShowPlatform", discordShowPlatform.value);
  }
  function setDiscordWorldIntegration() {
    discordWorldIntegration.value = !discordWorldIntegration.value;
    saveDiscordFlag("discordWorldIntegration", discordWorldIntegration.value);
  }
  function setDiscordWorldNameAsDiscordStatus() {
    discordWorldNameAsDiscordStatus.value = !discordWorldNameAsDiscordStatus.value;
    saveDiscordFlag("discordWorldNameAsDiscordStatus", discordWorldNameAsDiscordStatus.value);
  }
  function setDiscordMediaImage() {
    discordMediaImage.value = !discordMediaImage.value;
    saveDiscordFlag("discordMediaImage", discordMediaImage.value);
  }

  async function initDiscordPresenceSettings() {
    const [
      isDiscordActiveConfig,
      isDiscordInstanceConfig,
      isDiscordHideInviteConfig,
      isDiscordJoinButtonConfig,
      isDiscordHideImageConfig,
      isDiscordShowPlatformConfig,
      isDiscordWorldIntegrationConfig,
      isDiscordWorldNameAsDiscordStatusConfig,
      isDiscordMediaImageConfig,
    ] = await Promise.all([
      configRepository.getBool("discordActive", false),
      configRepository.getBool("discordInstance", true),
      configRepository.getBool("discordHideInvite", true),
      configRepository.getBool("discordJoinButton", false),
      configRepository.getBool("discordHideImage", false),
      configRepository.getBool("discordShowPlatform", true),
      configRepository.getBool("discordWorldIntegration", true),
      configRepository.getBool("discordWorldNameAsDiscordStatus", false),
      configRepository.getBool("discordMediaImage", false),
    ]);

    discordActive.value = isDiscordActiveConfig;
    discordInstance.value = isDiscordInstanceConfig;
    discordHideInvite.value = isDiscordHideInviteConfig;
    discordJoinButton.value = isDiscordJoinButtonConfig;
    discordHideImage.value = isDiscordHideImageConfig;
    discordShowPlatform.value = isDiscordShowPlatformConfig;
    discordWorldIntegration.value = isDiscordWorldIntegrationConfig;
    discordWorldNameAsDiscordStatus.value = isDiscordWorldNameAsDiscordStatusConfig;
    discordMediaImage.value = isDiscordMediaImageConfig;
  }

  void initDiscordPresenceSettings().catch(logDiscordPresenceError("Error loading Discord presence settings:"));

  async function updateDiscord() {
    let currentLocation = locationStore.lastLocation.location;
    let startTime: number = locationStore.lastLocation.date ?? 0;
    if (locationStore.lastLocation.location === "traveling") {
      currentLocation = locationStore.lastLocationDestination;
      startTime = locationStore.lastLocationDestinationTime;
    }
    if (!currentLocation) {
      currentLocation = userStore.currentUser.$locationTag;
      startTime = userStore.currentUser.$location_at;
      if (userStore.currentUser.$travelingToLocation) {
        currentLocation = userStore.currentUser.$travelingToLocation;
      }
    }
    if (!discordActive.value || !isRealInstance(currentLocation)) {
      void setIsDiscordActive(false).catch(logDiscordPresenceError("Error clearing Discord activity:"));
      return;
    }
    if (currentLocation !== state.lastLocationDetails.tag) {
      const L = parseLocation(currentLocation);
      state.lastLocationDetails = {
        tag: L.tag,
        instanceName: L.instanceName,
        accessType: L.accessType,
        worldId: L.worldId,
        worldName: "",
        thumbnailImageUrl: "",
        worldCapacity: 0,
        joinUrl: "",
        worldLink: "",
        accessName: "",
        groupAccessType: "",
        groupAccessName: "",
      };
      try {
        const args = await queryRequest.fetch("world.location", {
          worldId: L.worldId,
        });
        state.lastLocationDetails.worldName = args.ref.name;
        state.lastLocationDetails.thumbnailImageUrl = args.ref.thumbnailImageUrl;
        state.lastLocationDetails.worldCapacity = args.ref.capacity;
        if (args.ref.releaseStatus === "public") {
          state.lastLocationDetails.worldLink = `https://vrchat.com/home/world/${L.worldId}`;
        }
        const instanceName = await instanceStore.getInstanceName(currentLocation);
        if (instanceName) {
          L.instanceName = instanceName;
        }
      } catch (e) {
        console.error(`Failed to get world details for ${L.worldId}`, e);
      }

      let platform = "";
      if (discordShowPlatform.value) {
        platform = getPlatformLabel(userStore.currentUser.presence.platform, gameStore.isGameRunning, gameStore.isGameNoVR === true, t);
      }
      state.lastLocationDetails.groupAccessType = L.groupAccessType ?? "";
      if (L.groupAccessType) {
        if (L.groupAccessType === "public") {
          state.lastLocationDetails.groupAccessName = t("dialog.new_instance.group_access_type_public");
        } else if (L.groupAccessType === "plus") {
          state.lastLocationDetails.groupAccessName = t("dialog.new_instance.group_access_type_plus");
        }
      }
      switch (L.accessType) {
        case "public":
          state.lastLocationDetails.joinUrl = getLaunchURL(L);
          state.lastLocationDetails.accessName = `${t("dialog.new_instance.access_type_public")} #${L.instanceName}${platform}`;
          break;
        case "invite+":
          state.lastLocationDetails.accessName = `${t("dialog.new_instance.access_type_invite_plus")} #${L.instanceName}${platform}`;
          break;
        case "invite":
          state.lastLocationDetails.accessName = `${t("dialog.new_instance.access_type_invite")} #${L.instanceName}${platform}`;
          break;
        case "friends":
          state.lastLocationDetails.accessName = `${t("dialog.new_instance.access_type_friend")} #${L.instanceName}${platform}`;
          break;
        case "friends+":
          state.lastLocationDetails.accessName = `${t("dialog.new_instance.access_type_friend_plus")} #${L.instanceName}${platform}`;
          break;
        case "group":
          state.lastLocationDetails.accessName = `${t("dialog.new_instance.access_type_group")} #${L.instanceName}${platform}`;
          try {
            const groupName = await getGroupName(L.groupId);
            if (groupName) {
              state.lastLocationDetails.accessName = `${t("dialog.new_instance.access_type_group")}${state.lastLocationDetails.groupAccessName}(${groupName}) #${L.instanceName}${platform}`;
            }
          } catch (e) {
            console.error(`Failed to get group name for ${L.groupId}`, e);
          }
          break;
      }
    }
    void setIsDiscordActive(true).catch(logDiscordPresenceError("Error setting Discord activity:"));
    let shouldHidePrivate = false;
    if (
      discordHideInvite.value &&
      (state.lastLocationDetails.accessType === "invite" ||
        state.lastLocationDetails.accessType === "invite+" ||
        state.lastLocationDetails.groupAccessType === "members")
    ) {
      shouldHidePrivate = true;
    }
    const statusInfo = getStatusInfo(userStore.currentUser.status, discordHideInvite.value, t);
    const { statusName, statusImage } = statusInfo;
    if (statusInfo.hidePrivate) {
      shouldHidePrivate = true;
    }
    let details = state.lastLocationDetails.worldName;
    let stateText = state.lastLocationDetails.accessName;
    let endTime = 0;
    let activityType: number = ActivityType.Playing;
    let statusDisplayType: number = discordWorldNameAsDiscordStatus.value ? StatusDisplayType.Details : StatusDisplayType.Name;
    let appId = "883308884863901717";
    let bigIcon = "vrchat";
    let detailsUrl = state.lastLocationDetails.worldLink;
    const poweredBy = t("view.settings.discord_presence.rpc.powered_by_vrcx");

    let partyId = `${state.lastLocationDetails.worldId}:${state.lastLocationDetails.instanceName}`;
    let partySize = locationStore.lastLocation.playerList.size;
    let partyMaxSize = state.lastLocationDetails.worldCapacity;
    if (partySize > partyMaxSize) {
      partyMaxSize = partySize;
    }
    if (partySize === 0) {
      partyMaxSize = 0;
    }
    if (!discordInstance.value) {
      partySize = 0;
      partyMaxSize = 0;
      stateText = "";
    }
    let buttonText = "Join";
    let buttonUrl = state.lastLocationDetails.joinUrl;
    if (!discordJoinButton.value) {
      buttonText = "";
      buttonUrl = "";
    }

    if (!discordHideImage.value && state.lastLocationDetails.thumbnailImageUrl) {
      bigIcon = state.lastLocationDetails.thumbnailImageUrl;
    }

    const np = gameLogStore.nowPlaying;
    if (discordWorldIntegration.value && np.playing && !np.paused && np.videoName) {
      activityType = ActivityType.Watching;

      const rpcConfig = isRpcWorld(state.lastLocationDetails.tag) ? getRpcWorldConfig(state.lastLocationDetails.worldId) : null;
      if (rpcConfig) {
        activityType = rpcConfig.activityType;
        statusDisplayType = rpcConfig.statusDisplayType;
        appId = rpcConfig.appId;
        bigIcon = rpcConfig.bigIcon;
        details = np.videoName;
        if (isPopcornPalaceWorld(state.lastLocationDetails.worldId) && !discordHideImage.value && np.thumbnailUrl) {
          bigIcon = np.thumbnailUrl;
        }
      }

      if (np.length > 0) {
        startTime = np.startTime * 1000;
        endTime = (np.startTime + np.length / np.speed) * 1000;
      }

      const mediaImage = getMediaImage();
      if (mediaImage) {
        bigIcon = mediaImage;
      }
    }

    if (shouldHidePrivate) {
      partyId = "";
      partySize = 0;
      partyMaxSize = 0;
      buttonText = "";
      buttonUrl = "";
      detailsUrl = "";
      details = t("view.settings.discord_presence.rpc.private_world");
      stateText = "";
      startTime = 0;
      endTime = 0;
      appId = "883308884863901717";
      bigIcon = "vrchat";
      activityType = ActivityType.Playing;
      statusDisplayType = StatusDisplayType.Name;
    }
    if (details.length < 2) {
      details += String.fromCharCode(0xffa0).repeat(2 - details.length);
    }
    void Discord.SetAssets(
      details,
      stateText,
      detailsUrl,

      bigIcon,
      poweredBy,

      statusImage,
      statusName,

      startTime,
      endTime,

      partyId,
      partySize,
      partyMaxSize,
      buttonText,
      buttonUrl,
      appId,
      activityType,
      statusDisplayType
    ).catch(logDiscordPresenceError("Error updating Discord activity:"));
  }

  function getMediaImage() {
    if (!discordMediaImage.value || discordHideImage.value) {
      return "";
    }
    const url = gameLogStore.nowPlaying.thumbnailUrl;
    if (!url || !url.startsWith("https://") || url.length > 256) {
      return "";
    }
    return url;
  }

  async function setIsDiscordActive(isActive: boolean) {
    if (isActive !== state.isDiscordActive) {
      state.isDiscordActive = await Discord.SetActive(isActive);
    }
  }

  function saveDiscordOption(_configLabel = "") {
    state.lastLocationDetails.tag = "";
    updateLoopStore.setNextDiscordUpdate(3);
    void updateDiscord().catch(logDiscordPresenceError("Error updating Discord presence:"));
  }

  return {
    state,

    discordActive,
    discordInstance,
    discordHideInvite,
    discordJoinButton,
    discordHideImage,
    discordShowPlatform,
    discordWorldIntegration,
    discordWorldNameAsDiscordStatus,
    discordMediaImage,

    setDiscordActive,
    setDiscordInstance,
    setDiscordHideInvite,
    setDiscordJoinButton,
    setDiscordHideImage,
    setDiscordShowPlatform,
    setDiscordWorldIntegration,
    setDiscordMediaImage,
    setDiscordWorldNameAsDiscordStatus,
    updateDiscord,
    saveDiscordOption,
  };
});
