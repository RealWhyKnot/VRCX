import { defineStore } from "pinia";
import { ref } from "vue";
import { useI18n } from "vue-i18n";

import { sharedFeedFiltersDefaults } from "../../shared/constants/feed-filters";
import { useModalStore } from "../modal";
import { useVrStore } from "../vr";

import { configRepository } from "../../services/config";

type FeedFilterMap = Record<string, string | undefined>;

type SharedFeedFilters = {
  noty: FeedFilterMap;
  wrist: FeedFilterMap;
};

type PromptResult = {
  ok: boolean;
  value?: unknown;
};

function logRejection(message: string) {
  return (error: unknown) => {
    console.error(message, error);
  };
}

function saveSetting(save: Promise<void>): void {
  save.catch(logRejection("Failed to save notification setting:"));
}

function isFeedFilterMap(value: unknown): value is FeedFilterMap {
  return typeof value === "object" && value !== null && Object.values(value).every((entry: unknown) => typeof entry === "string");
}

function isSharedFeedFilters(value: unknown): value is SharedFeedFilters {
  return typeof value === "object" && value !== null && "noty" in value && isFeedFilterMap(value.noty) && "wrist" in value && isFeedFilterMap(value.wrist);
}

function isPromptResult(value: unknown): value is PromptResult {
  return typeof value === "object" && value !== null && "ok" in value && typeof value.ok === "boolean";
}

export const useNotificationsSettingsStore = defineStore("NotificationsSettings", () => {
  const vrStore = useVrStore();
  const modalStore = useModalStore();

  const { t } = useI18n();

  const overlayToast = ref("Game Running");
  const openVR = ref(false);
  const overlayNotifications = ref(true);
  const xsNotifications = ref(true);
  const ovrtHudNotifications = ref(true);
  const ovrtWristNotifications = ref(false);
  const imageNotifications = ref(true);
  const desktopToast = ref("Never");
  const afkDesktopToast = ref(false);
  const notificationTTS = ref("Never");
  const notificationTTSNickName = ref(false);
  const inventoryBundleNotifications = ref(true);
  const freeStoreItemNotifications = ref(true);
  const sharedFeedFilters = ref<SharedFeedFilters>({
    noty: {
      Location: "Off",
      OnPlayerJoined: "VIP",
      OnPlayerLeft: "VIP",
      OnPlayerJoining: "VIP",
      Online: "VIP",
      Offline: "VIP",
      GPS: "Off",
      Status: "Off",
      invite: "Friends",
      requestInvite: "Friends",
      inviteResponse: "Friends",
      requestInviteResponse: "Friends",
      boop: "Friends",
      friendRequest: "On",
      Friend: "On",
      Unfriend: "On",
      DisplayName: "VIP",
      TrustLevel: "VIP",
      groupChange: "On",
      "group.announcement": "On",
      "group.event.created": "On",
      "group.event.starting": "On",
      "group.informative": "On",
      "group.invite": "On",
      "group.joinRequest": "Off",
      "group.transfer": "On",
      "group.queueReady": "On",
      "instance.closed": "On",
      PortalSpawn: "Everyone",
      Event: "On",
      External: "On",
      VideoPlay: "Off",
      BlockedOnPlayerJoined: "Off",
      BlockedOnPlayerLeft: "Off",
      MutedOnPlayerJoined: "Off",
      MutedOnPlayerLeft: "Off",
      AvatarChange: "Off",
      ChatBoxMessage: "Off",
      Blocked: "Off",
      Unblocked: "Off",
      Muted: "Off",
      Unmuted: "Off",
    },
    wrist: {
      Location: "On",
      OnPlayerJoined: "Everyone",
      OnPlayerLeft: "Everyone",
      OnPlayerJoining: "Friends",
      Online: "Friends",
      Offline: "Friends",
      GPS: "Friends",
      Status: "Friends",
      invite: "Friends",
      requestInvite: "Friends",
      inviteResponse: "Friends",
      requestInviteResponse: "Friends",
      boop: "Friends",
      friendRequest: "On",
      Friend: "On",
      Unfriend: "On",
      DisplayName: "Friends",
      TrustLevel: "Friends",
      groupChange: "On",
      "group.announcement": "On",
      "group.event.created": "On",
      "group.event.starting": "On",
      "group.informative": "On",
      "group.invite": "On",
      "group.joinRequest": "On",
      "group.transfer": "On",
      "group.queueReady": "On",
      "instance.closed": "On",
      PortalSpawn: "Everyone",
      Event: "On",
      External: "On",
      VideoPlay: "On",
      BlockedOnPlayerJoined: "Off",
      BlockedOnPlayerLeft: "Off",
      MutedOnPlayerJoined: "Off",
      MutedOnPlayerLeft: "Off",
      AvatarChange: "Everyone",
      ChatBoxMessage: "Off",
      Blocked: "On",
      Unblocked: "On",
      Muted: "On",
      Unmuted: "On",
    },
  });
  const isTestTTSVisible = ref(false);
  const notificationTTSVoice = ref(0);
  const ttsVoices = ref<SpeechSynthesisVoice[]>([]);
  const notificationTTSTest = ref("");
  const notificationPosition = ref("topCenter");
  const notificationTimeout = ref(3000);

  async function initNotificationsSettings() {
    const [
      overlayToastConfig,
      isOverlayNotificationsConfig,
      isOpenVRConfig,
      isXsNotificationsConfig,
      isOvrtHudNotificationsConfig,
      isOvrtWristNotificationsConfig,
      isImageNotificationsConfig,
      desktopToastConfig,
      isAfkDesktopToastConfig,
      notificationTTSConfig,
      isNotificationTTSNickNameConfig,
      isInventoryBundleNotificationsConfig,
      isFreeStoreItemNotificationsConfig,
      sharedFeedFiltersConfig,
      notificationTTSVoiceConfig,
      notificationPositionConfig,
      notificationTimeoutConfig,
    ] = await Promise.all([
      configRepository.getString("VRCX_overlayToast", "Game Running"),
      configRepository.getBool("VRCX_overlayNotifications", true),
      configRepository.getBool("openVR", false),
      configRepository.getBool("VRCX_xsNotifications", true),
      configRepository.getBool("VRCX_ovrtHudNotifications", true),
      configRepository.getBool("VRCX_ovrtWristNotifications", false),
      configRepository.getBool("VRCX_imageNotifications", true),
      configRepository.getString("VRCX_desktopToast", "Never"),
      configRepository.getBool("VRCX_afkDesktopToast", false),
      configRepository.getString("VRCX_notificationTTS", "Never"),
      configRepository.getBool("VRCX_notificationTTSNickName", false),
      configRepository.getBool("VRCX_inventoryBundleNotifications", true),
      configRepository.getBool("VRCX_freeStoreItemNotifications", true),
      configRepository.getString("sharedFeedFilters", JSON.stringify(sharedFeedFiltersDefaults)),
      configRepository.getString("VRCX_notificationTTSVoice", "0"),
      configRepository.getString("VRCX_notificationPosition", "topCenter"),
      configRepository.getString("VRCX_notificationTimeout", "3000"),
    ]);

    overlayToast.value = overlayToastConfig;
    openVR.value = isOpenVRConfig;
    overlayNotifications.value = isOverlayNotificationsConfig;
    xsNotifications.value = isXsNotificationsConfig;
    ovrtHudNotifications.value = isOvrtHudNotificationsConfig;
    ovrtWristNotifications.value = isOvrtWristNotificationsConfig;
    imageNotifications.value = isImageNotificationsConfig;
    desktopToast.value = desktopToastConfig;
    afkDesktopToast.value = isAfkDesktopToastConfig;
    notificationTTS.value = notificationTTSConfig;
    notificationTTSNickName.value = isNotificationTTSNickNameConfig;
    inventoryBundleNotifications.value = isInventoryBundleNotificationsConfig;
    freeStoreItemNotifications.value = isFreeStoreItemNotificationsConfig;
    const parsedSharedFeedFilters: unknown = JSON.parse(sharedFeedFiltersConfig);
    if (isSharedFeedFilters(parsedSharedFeedFilters)) {
      sharedFeedFilters.value = parsedSharedFeedFilters;
    }
    notificationTTSVoice.value = Number(notificationTTSVoiceConfig);
    ttsVoices.value = speechSynthesis.getVoices();
    notificationPosition.value = notificationPositionConfig;
    notificationTimeout.value = Number(notificationTimeoutConfig);

    initSharedFeedFilters();

    setTimeout(() => {
      updateTTSVoices();
    }, 5000);
  }

  initNotificationsSettings().catch(logRejection("Failed to load notification settings:"));

  function setOverlayToast(value: string) {
    overlayToast.value = value;
    saveSetting(configRepository.setString("VRCX_overlayToast", value));
  }
  function setOverlayNotifications() {
    overlayNotifications.value = !overlayNotifications.value;
    saveSetting(configRepository.setBool("VRCX_overlayNotifications", overlayNotifications.value));
  }
  function setOpenVR() {
    openVR.value = !openVR.value;
    saveSetting(configRepository.setBool("openVR", openVR.value));
  }
  function setXsNotifications() {
    xsNotifications.value = !xsNotifications.value;
    saveSetting(configRepository.setBool("VRCX_xsNotifications", xsNotifications.value));
  }
  function setOvrtHudNotifications() {
    ovrtHudNotifications.value = !ovrtHudNotifications.value;
    saveSetting(configRepository.setBool("VRCX_ovrtHudNotifications", ovrtHudNotifications.value));
  }
  function setOvrtWristNotifications() {
    ovrtWristNotifications.value = !ovrtWristNotifications.value;
    saveSetting(configRepository.setBool("VRCX_ovrtWristNotifications", ovrtWristNotifications.value));
  }
  function setImageNotifications() {
    imageNotifications.value = !imageNotifications.value;
    saveSetting(configRepository.setBool("VRCX_imageNotifications", imageNotifications.value));
  }

  function changeNotificationPosition(value: string) {
    notificationPosition.value = value;
    saveSetting(configRepository.setString("VRCX_notificationPosition", notificationPosition.value));
    vrStore.updateVRConfigVars();
  }

  function setDesktopToast(value: string) {
    desktopToast.value = value;
    saveSetting(configRepository.setString("VRCX_desktopToast", value));
  }
  function setAfkDesktopToast() {
    afkDesktopToast.value = !afkDesktopToast.value;
    saveSetting(configRepository.setBool("VRCX_afkDesktopToast", afkDesktopToast.value));
  }

  function setNotificationTTS(value: string) {
    notificationTTS.value = value;
    saveSetting(configRepository.setString("VRCX_notificationTTS", value));
  }
  function setNotificationTTSNickName() {
    notificationTTSNickName.value = !notificationTTSNickName.value;
    saveSetting(configRepository.setBool("VRCX_notificationTTSNickName", notificationTTSNickName.value));
  }
  function setInventoryBundleNotifications() {
    inventoryBundleNotifications.value = !inventoryBundleNotifications.value;
    saveSetting(configRepository.setBool("VRCX_inventoryBundleNotifications", inventoryBundleNotifications.value));
  }
  function setFreeStoreItemNotifications() {
    freeStoreItemNotifications.value = !freeStoreItemNotifications.value;
    saveSetting(configRepository.setBool("VRCX_freeStoreItemNotifications", freeStoreItemNotifications.value));
  }
  function initSharedFeedFilters() {
    if (!sharedFeedFilters.value.noty["Blocked"]) {
      sharedFeedFilters.value.noty["Blocked"] = "Off";
      sharedFeedFilters.value.noty["Unblocked"] = "Off";
      sharedFeedFilters.value.noty["Muted"] = "Off";
      sharedFeedFilters.value.noty["Unmuted"] = "Off";
      sharedFeedFilters.value.wrist["Blocked"] = "On";
      sharedFeedFilters.value.wrist["Unblocked"] = "On";
      sharedFeedFilters.value.wrist["Muted"] = "On";
      sharedFeedFilters.value.wrist["Unmuted"] = "On";
    }
    if (!sharedFeedFilters.value.noty["group.announcement"]) {
      sharedFeedFilters.value.noty["group.announcement"] = "On";
      sharedFeedFilters.value.noty["group.informative"] = "On";
      sharedFeedFilters.value.noty["group.invite"] = "On";
      sharedFeedFilters.value.noty["group.joinRequest"] = "Off";
      sharedFeedFilters.value.wrist["group.announcement"] = "On";
      sharedFeedFilters.value.wrist["group.informative"] = "On";
      sharedFeedFilters.value.wrist["group.invite"] = "On";
      sharedFeedFilters.value.wrist["group.joinRequest"] = "On";
    }
    if (!sharedFeedFilters.value.noty["group.event.created"]) {
      sharedFeedFilters.value.noty["group.event.created"] = sharedFeedFilters.value.noty["group.announcement"];
      sharedFeedFilters.value.wrist["group.event.created"] = sharedFeedFilters.value.wrist["group.announcement"];
      sharedFeedFilters.value.noty["group.event.starting"] = sharedFeedFilters.value.noty["group.announcement"];
      sharedFeedFilters.value.wrist["group.event.starting"] = sharedFeedFilters.value.wrist["group.announcement"];
    }
    if (!sharedFeedFilters.value.noty["group.queueReady"]) {
      sharedFeedFilters.value.noty["group.queueReady"] = "On";
      sharedFeedFilters.value.wrist["group.queueReady"] = "On";
    }
    if (!sharedFeedFilters.value.noty["instance.closed"]) {
      sharedFeedFilters.value.noty["instance.closed"] = "On";
      sharedFeedFilters.value.wrist["instance.closed"] = "On";
    }
    if (!sharedFeedFilters.value.noty["External"]) {
      sharedFeedFilters.value.noty["External"] = "On";
      sharedFeedFilters.value.wrist["External"] = "On";
    }
    if (!sharedFeedFilters.value.noty["groupChange"]) {
      sharedFeedFilters.value.noty["groupChange"] = "On";
      sharedFeedFilters.value.wrist["groupChange"] = "On";
    }
    if (!sharedFeedFilters.value.noty["group.transfer"]) {
      sharedFeedFilters.value.noty["group.transfer"] = "On";
      sharedFeedFilters.value.wrist["group.transfer"] = "On";
    }
    if (!sharedFeedFilters.value.noty["boop"] || sharedFeedFilters.value.noty["boop"] === "On") {
      sharedFeedFilters.value.noty["boop"] = "Friends";
    }
    if (!sharedFeedFilters.value.wrist["boop"] || sharedFeedFilters.value.wrist["boop"] === "On") {
      sharedFeedFilters.value.wrist["boop"] = "Friends";
    }
  }
  function setNotificationTTSVoice(index: number) {
    notificationTTSVoice.value = index;
    saveSetting(configRepository.setString("VRCX_notificationTTSVoice", notificationTTSVoice.value.toString()));
  }

  function getTTSVoiceName(): string {
    let voices: SpeechSynthesisVoice[];
    if (isHostWindows) {
      voices = speechSynthesis.getVoices();
    } else {
      voices = ttsVoices.value;
    }
    if (voices.length === 0) {
      return "";
    }
    if (notificationTTSVoice.value >= voices.length) {
      setNotificationTTSVoice(0);
    }
    return voices[notificationTTSVoice.value]?.name ?? "";
  }

  function changeTTSVoice(index: number) {
    setNotificationTTSVoice(index);
    let voices: SpeechSynthesisVoice[];
    if (isHostWindows) {
      voices = speechSynthesis.getVoices();
    } else {
      voices = ttsVoices.value;
    }
    if (voices.length === 0) {
      return;
    }
    const voice = voices[index];
    if (!voice) {
      return;
    }
    speechSynthesis.cancel();
    speak(voice.name);
  }

  function updateTTSVoices() {
    ttsVoices.value = speechSynthesis.getVoices();
    if (isHostLinux) {
      const voices = speechSynthesis.getVoices();
      const uniqueVoices: SpeechSynthesisVoice[] = [];
      voices.forEach((voice) => {
        if (!uniqueVoices.some((v) => v.lang === voice.lang)) {
          uniqueVoices.push(voice);
        }
      });
      ttsVoices.value = uniqueVoices.filter((v) => v.lang.startsWith("en"));
    }
  }
  async function saveNotificationTTS(value: string) {
    speechSynthesis.cancel();
    if ((await configRepository.getString("VRCX_notificationTTS")) === "Never" && value !== "Never") {
      speak("Notification text-to-speech enabled");
    }
    setNotificationTTS(value);
  }

  function testNotificationTTS() {
    speechSynthesis.cancel();
    speak(notificationTTSTest.value);
  }

  function speak(text: string) {
    const tts = new SpeechSynthesisUtterance();
    const voices = speechSynthesis.getVoices();
    if (voices.length === 0) {
      return;
    }
    let index = 0;
    if (notificationTTSVoice.value < voices.length) {
      index = notificationTTSVoice.value;
    }
    tts.voice = voices[index] ?? null;
    tts.text = text;
    speechSynthesis.speak(tts);
  }

  function setNotificationTimeout(seconds: number) {
    const ms = Math.trunc(seconds * 1000);
    if (isNaN(ms) || ms < 0) return;
    notificationTimeout.value = ms;
    saveSetting(configRepository.setString("VRCX_notificationTimeout", ms.toString()));
    vrStore.updateVRConfigVars();
  }

  function promptNotificationTimeout() {
    modalStore
      .prompt({
        title: t("prompt.notification_timeout.header"),
        description: t("prompt.notification_timeout.description"),
        confirmText: t("prompt.notification_timeout.ok"),
        cancelText: t("prompt.notification_timeout.cancel"),
        inputValue: String(notificationTimeout.value / 1000),
        pattern: /\d+$/,
        errorMessage: t("prompt.notification_timeout.input_error"),
      })
      .then(async (result: unknown) => {
        if (!isPromptResult(result) || !result.ok) return;
        const { value } = result;
        if (typeof value === "string" && value && !isNaN(Number(value))) {
          notificationTimeout.value = Math.trunc(Number(value) * 1000);
          await configRepository.setString("VRCX_notificationTimeout", notificationTimeout.value.toString());
          vrStore.updateVRConfigVars();
        }
      })
      .catch(logRejection("Failed to update notification timeout:"));
  }

  return {
    overlayToast,
    openVR,
    overlayNotifications,
    xsNotifications,
    ovrtHudNotifications,
    ovrtWristNotifications,
    imageNotifications,
    desktopToast,
    afkDesktopToast,
    notificationTTS,
    notificationTTSNickName,
    inventoryBundleNotifications,
    freeStoreItemNotifications,
    sharedFeedFilters,
    isTestTTSVisible,
    notificationTTSVoice,
    TTSvoices: ttsVoices,
    notificationTTSTest,
    notificationPosition,
    notificationTimeout,

    setOverlayToast,
    setOpenVR,
    setOverlayNotifications,
    setXsNotifications,
    setOvrtHudNotifications,
    setOvrtWristNotifications,
    setImageNotifications,
    setDesktopToast,
    setAfkDesktopToast,
    setNotificationTTS,
    setNotificationTTSNickName,
    setInventoryBundleNotifications,
    setFreeStoreItemNotifications,
    getTTSVoiceName,
    changeTTSVoice,
    saveNotificationTTS,
    testNotificationTTS,
    speak,
    changeNotificationPosition,
    setNotificationTimeout,
    promptNotificationTimeout,
  };
});
