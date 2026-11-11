import { reactive, ref, watch } from "vue";
import { defineStore } from "pinia";
import { toast } from "vue-sonner";
import { useI18n } from "vue-i18n";

import { logWebRequest } from "../../services/app-config";
import { database } from "../../services/database";
import { languageCodes } from "../../localization/locales";
import { useGameStore } from "../game";
import { useModalStore } from "../modal";
import { useUpdateLoopStore } from "../update-loop";
import { useVRCXUpdaterStore } from "../vrcx-updater";
import { useVrcxStore } from "../vrcx";
import { watchState } from "../../services/watch-state";

import { configRepository } from "../../services/config";
import { webApiService } from "../../services/webapi";
import { logFailure } from "../log-failure";
import { parseLeadingInt } from "../vrcx-messages";
import { firstNonEmpty, readChatCompletionContent, readGoogleTranslatedText, readModelIds, readYouTubeVideoLookup } from "./advanced-helpers";
import type { YouTubeVideoLookup } from "./advanced-helpers";

type TranslationOverrides = {
  type?: string;
  key?: string;
  endpoint?: string;
  model?: string;
  prompt?: string;
};

type FetchModelsOverrides = {
  endpoint?: string;
  key?: string;
};

const logSaveFailure = logFailure("Failed to save advanced setting:");
const logActionFailure = logFailure("Advanced settings action failed:");
const logDialogFailure = logFailure("Advanced settings dialog failed:");

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : "undefined";
}

export const useAdvancedSettingsStore = defineStore("AdvancedSettings", () => {
  const gameStore = useGameStore();
  const vrcxStore = useVrcxStore();
  const VRCXUpdaterStore = useVRCXUpdaterStore();
  const modalStore = useModalStore();
  const updateLoopStore = useUpdateLoopStore();

  const { t } = useI18n();

  const state = reactive({
    folderSelectorDialogVisible: false,
  });

  const enablePrimaryPassword = ref(false);
  const bioLanguage = ref("en");
  const relaunchVRChatAfterCrash = ref(false);
  const vrcQuitFix = ref(true);
  const autoSweepVRChatCache = ref(false);
  const selfInviteOverride = ref(false);
  const saveInstancePrints = ref(false);
  const cropInstancePrints = ref(false);
  const saveInstanceStickers = ref(false);
  const avatarRemoteDatabase = ref(true);
  const enableAppLauncher = ref(true);
  const enableAppLauncherAutoClose = ref(true);
  const enableAppLauncherRunProcessOnce = ref(true);
  const screenshotHelper = ref(true);
  const screenshotHelperModifyFilename = ref(false);
  const screenshotHelperCopyToClipboard = ref(false);
  const youTubeApi = ref(false);
  const youTubeApiKey = ref("");
  const translationApi = ref(false);
  const translationApiKey = ref("");
  const translationApiType = ref("google");
  const translationApiEndpoint = ref("https://api.openai.com/v1/chat/completions");
  const translationApiModel = ref("gpt-4o-mini");
  const translationApiPrompt = ref("");
  const progressPie = ref(false);
  const progressPieFilter = ref(true);
  const showConfirmationOnSwitchAvatar = ref(false);
  const gameLogDisabled = ref(false);
  const sqliteTableSizes = ref({
    gps: 0,
    status: 0,
    bio: 0,
    avatar: 0,
    onlineOffline: 0,
    friendLogHistory: 0,
    notification: 0,
    location: 0,
    joinLeave: 0,
    portalSpawn: 0,
    videoPlay: 0,
    event: 0,
    external: 0,
  });
  const avatarAutoCleanup = ref("Off");
  const purgeInProgress = ref(false);
  const ugcFolderPath = ref("");
  const autoDeleteOldPrints = ref(false);
  const notificationOpacity = ref(100);
  const currentUserInventory = reactive(new Map());
  const isVRChatConfigDialogVisible = ref(false);
  const saveInstanceEmoji = ref(false);
  const vrcRegistryAutoBackup = ref(true);
  const vrcRegistryAskRestore = ref(true);
  const sentryErrorReporting = ref(false);

  watch(
    () => watchState.isLoggedIn,
    () => {
      currentUserInventory.clear();
      isVRChatConfigDialogVisible.value = false;
    },
    { flush: "sync" }
  );

  async function initAdvancedSettings() {
    const [
      isEnablePrimaryPasswordConfig,
      bioLanguageConfig,
      isRelaunchVRChatAfterCrashConfig,
      isVrcQuitFixConfig,
      isAutoSweepVRChatCacheConfig,
      isSelfInviteOverrideConfig,
      isSaveInstancePrintsConfig,
      isCropInstancePrintsConfig,
      isSaveInstanceStickersConfig,
      isAvatarRemoteDatabaseConfig,
      isEnableAppLauncherConfig,
      isEnableAppLauncherAutoCloseConfig,
      isEnableAppLauncherRunProcessOnceConfig,
      isScreenshotHelperConfig,
      isScreenshotHelperModifyFilenameConfig,
      isScreenshotHelperCopyToClipboardConfig,
      isYouTubeApiConfig,
      youTubeApiKeyConfig,
      isTranslationApiConfig,
      translationApiKeyConfig,
      translationApiTypeConfig,
      translationApiEndpointConfig,
      translationApiModelConfig,
      translationApiPromptConfig,
      isProgressPieConfig,
      isProgressPieFilterConfig,
      isShowConfirmationOnSwitchAvatarConfig,
      isGameLogDisabledConfig,
      avatarAutoCleanupConfig,
      ugcFolderPathConfig,
      isAutoDeleteOldPrintsConfig,
      notificationOpacityConfig,
      isSaveInstanceEmojiConfig,
      isVrcRegistryAutoBackupConfig,
      isVrcRegistryAskRestoreConfig,
      sentryErrorReportingConfig,
    ] = await Promise.all([
      configRepository.getBool("enablePrimaryPassword", false),
      configRepository.getString("VRCX_bioLanguage"),
      configRepository.getBool("VRCX_relaunchVRChatAfterCrash", false),
      configRepository.getBool("VRCX_vrcQuitFix", true),
      configRepository.getBool("VRCX_autoSweepVRChatCache", false),
      configRepository.getBool("VRCX_selfInviteOverride", false),
      configRepository.getBool("VRCX_saveInstancePrints", false),
      configRepository.getBool("VRCX_cropInstancePrints", false),
      configRepository.getBool("VRCX_saveInstanceStickers", false),
      configRepository.getBool("VRCX_avatarRemoteDatabase", true),
      configRepository.getBool("VRCX_enableAppLauncher", true),
      configRepository.getBool("VRCX_enableAppLauncherAutoClose", true),
      configRepository.getBool("VRCX_enableAppLauncherRunProcessOnce", true),
      configRepository.getBool("VRCX_screenshotHelper", true),
      configRepository.getBool("VRCX_screenshotHelperModifyFilename", false),
      configRepository.getBool("VRCX_screenshotHelperCopyToClipboard", false),
      configRepository.getBool("VRCX_youtubeAPI", false),
      configRepository.getString("VRCX_youtubeAPIKey", ""),
      configRepository.getBool("VRCX_translationAPI", false),
      configRepository.getString("VRCX_translationAPIKey", ""),
      configRepository.getString("VRCX_translationAPIType", "google"),
      configRepository.getString("VRCX_translationAPIEndpoint", ""),
      configRepository.getString("VRCX_translationAPIModel", ""),
      configRepository.getString("VRCX_translationAPIPrompt", ""),
      configRepository.getBool("VRCX_progressPie", false),
      configRepository.getBool("VRCX_progressPieFilter", true),
      configRepository.getBool("VRCX_showConfirmationOnSwitchAvatar", false),
      configRepository.getBool("VRCX_gameLogDisabled", false),
      configRepository.getString("VRCX_avatarAutoCleanup", "Off"),
      configRepository.getString("VRCX_userGeneratedContentPath", ""),
      configRepository.getBool("VRCX_autoDeleteOldPrints", false),
      configRepository.getFloat("VRCX_notificationOpacity", 100),
      configRepository.getBool("VRCX_saveInstanceEmoji", false),
      configRepository.getBool("VRCX_vrcRegistryAutoBackup", true),
      configRepository.getBool("VRCX_vrcRegistryAskRestore", true),
      configRepository.getString("VRCX_SentryEnabled", ""),
    ]);

    if (!bioLanguageConfig || !languageCodes.includes(bioLanguageConfig)) {
      bioLanguage.value = "en";
    } else {
      bioLanguage.value = bioLanguageConfig;
    }

    enablePrimaryPassword.value = isEnablePrimaryPasswordConfig;
    relaunchVRChatAfterCrash.value = isRelaunchVRChatAfterCrashConfig;
    vrcQuitFix.value = isVrcQuitFixConfig;
    autoSweepVRChatCache.value = isAutoSweepVRChatCacheConfig;
    selfInviteOverride.value = isSelfInviteOverrideConfig;
    saveInstancePrints.value = isSaveInstancePrintsConfig;
    cropInstancePrints.value = isCropInstancePrintsConfig;
    saveInstanceStickers.value = isSaveInstanceStickersConfig;
    avatarRemoteDatabase.value = isAvatarRemoteDatabaseConfig;
    enableAppLauncher.value = isEnableAppLauncherConfig;
    enableAppLauncherAutoClose.value = isEnableAppLauncherAutoCloseConfig;
    enableAppLauncherRunProcessOnce.value = isEnableAppLauncherRunProcessOnceConfig;
    screenshotHelper.value = isScreenshotHelperConfig;
    screenshotHelperModifyFilename.value = isScreenshotHelperModifyFilenameConfig;
    screenshotHelperCopyToClipboard.value = isScreenshotHelperCopyToClipboardConfig;
    youTubeApi.value = isYouTubeApiConfig;
    youTubeApiKey.value = youTubeApiKeyConfig;
    translationApi.value = isTranslationApiConfig;
    translationApiKey.value = translationApiKeyConfig;
    translationApiType.value = translationApiTypeConfig;
    translationApiEndpoint.value = translationApiEndpointConfig;
    translationApiModel.value = translationApiModelConfig;
    translationApiPrompt.value = translationApiPromptConfig;
    progressPie.value = isProgressPieConfig;
    progressPieFilter.value = isProgressPieFilterConfig;
    showConfirmationOnSwitchAvatar.value = isShowConfirmationOnSwitchAvatarConfig;
    gameLogDisabled.value = isGameLogDisabledConfig;
    avatarAutoCleanup.value = avatarAutoCleanupConfig;
    ugcFolderPath.value = ugcFolderPathConfig;
    autoDeleteOldPrints.value = isAutoDeleteOldPrintsConfig;
    notificationOpacity.value = notificationOpacityConfig;
    saveInstanceEmoji.value = isSaveInstanceEmojiConfig;
    vrcRegistryAutoBackup.value = isVrcRegistryAutoBackupConfig;
    vrcRegistryAskRestore.value = isVrcRegistryAskRestoreConfig;
    sentryErrorReporting.value = sentryErrorReportingConfig === "true";

    handleSetAppLauncherSettings();

    setTimeout(() => {
      if (VRCXUpdaterStore.branch === "Nightly" && sentryErrorReportingConfig === "") {
        checkSentryConsent();
      }
    }, 2000);
  }

  void initAdvancedSettings().catch(logActionFailure);

  function setEnablePrimaryPasswordConfigRepository(isEnabled: boolean) {
    void configRepository.setBool("enablePrimaryPassword", isEnabled).catch(logSaveFailure);
  }

  function setEnablePrimaryPassword(isEnabled: boolean) {
    enablePrimaryPassword.value = isEnabled;
  }
  function setRelaunchVRChatAfterCrash() {
    relaunchVRChatAfterCrash.value = !relaunchVRChatAfterCrash.value;
    void configRepository.setBool("VRCX_relaunchVRChatAfterCrash", relaunchVRChatAfterCrash.value).catch(logSaveFailure);
  }
  function setVrcQuitFix() {
    vrcQuitFix.value = !vrcQuitFix.value;
    void configRepository.setBool("VRCX_vrcQuitFix", vrcQuitFix.value).catch(logSaveFailure);
  }
  function setAutoSweepVRChatCache() {
    autoSweepVRChatCache.value = !autoSweepVRChatCache.value;
    void configRepository.setBool("VRCX_autoSweepVRChatCache", autoSweepVRChatCache.value).catch(logSaveFailure);
  }
  function setSelfInviteOverride() {
    selfInviteOverride.value = !selfInviteOverride.value;
    void configRepository.setBool("VRCX_selfInviteOverride", selfInviteOverride.value).catch(logSaveFailure);
  }
  function setSaveInstancePrints() {
    saveInstancePrints.value = !saveInstancePrints.value;
    void configRepository.setBool("VRCX_saveInstancePrints", saveInstancePrints.value).catch(logSaveFailure);
  }
  function setCropInstancePrints() {
    cropInstancePrints.value = !cropInstancePrints.value;
    void configRepository.setBool("VRCX_cropInstancePrints", cropInstancePrints.value).catch(logSaveFailure);
    cropPrintsChanged();
  }
  function setSaveInstanceStickers() {
    saveInstanceStickers.value = !saveInstanceStickers.value;
    void configRepository.setBool("VRCX_saveInstanceStickers", saveInstanceStickers.value).catch(logSaveFailure);
  }

  function setAvatarRemoteDatabase(isEnabled: boolean) {
    avatarRemoteDatabase.value = isEnabled;
    void configRepository.setBool("VRCX_avatarRemoteDatabase", avatarRemoteDatabase.value).catch(logSaveFailure);
  }
  async function setEnableAppLauncher() {
    enableAppLauncher.value = !enableAppLauncher.value;
    await configRepository.setBool("VRCX_enableAppLauncher", enableAppLauncher.value);
    handleSetAppLauncherSettings();
  }
  async function setEnableAppLauncherAutoClose() {
    enableAppLauncherAutoClose.value = !enableAppLauncherAutoClose.value;
    await configRepository.setBool("VRCX_enableAppLauncherAutoClose", enableAppLauncherAutoClose.value);
    handleSetAppLauncherSettings();
  }
  async function setEnableAppLauncherRunProcessOnce() {
    enableAppLauncherRunProcessOnce.value = !enableAppLauncherRunProcessOnce.value;
    await configRepository.setBool("VRCX_enableAppLauncherRunProcessOnce", enableAppLauncherRunProcessOnce.value);
    handleSetAppLauncherSettings();
  }
  async function setScreenshotHelper() {
    screenshotHelper.value = !screenshotHelper.value;
    await configRepository.setBool("VRCX_screenshotHelper", screenshotHelper.value);
  }
  async function setScreenshotHelperModifyFilename() {
    screenshotHelperModifyFilename.value = !screenshotHelperModifyFilename.value;
    await configRepository.setBool("VRCX_screenshotHelperModifyFilename", screenshotHelperModifyFilename.value);
  }
  async function setScreenshotHelperCopyToClipboard() {
    screenshotHelperCopyToClipboard.value = !screenshotHelperCopyToClipboard.value;
    await configRepository.setBool("VRCX_screenshotHelperCopyToClipboard", screenshotHelperCopyToClipboard.value);
  }
  async function setYouTubeApi() {
    youTubeApi.value = !youTubeApi.value;
    await configRepository.setBool("VRCX_youtubeAPI", youTubeApi.value);
  }
  async function setTranslationApi() {
    translationApi.value = !translationApi.value;
    await configRepository.setBool("VRCX_translationAPI", translationApi.value);
  }

  async function setYouTubeApiKey(value: string) {
    youTubeApiKey.value = value;
    await configRepository.setString("VRCX_youtubeAPIKey", youTubeApiKey.value);
  }
  async function setTranslationApiKey(value: string) {
    translationApiKey.value = value;
    await configRepository.setString("VRCX_translationAPIKey", translationApiKey.value);
  }
  async function setTranslationApiType(value: string) {
    translationApiType.value = firstNonEmpty(value, "google");
    await configRepository.setString("VRCX_translationAPIType", translationApiType.value);
  }
  async function setTranslationApiEndpoint(value: string) {
    translationApiEndpoint.value = value;
    await configRepository.setString("VRCX_translationAPIEndpoint", translationApiEndpoint.value);
  }
  async function setTranslationApiModel(value: string) {
    translationApiModel.value = value;
    await configRepository.setString("VRCX_translationAPIModel", translationApiModel.value);
  }
  async function setTranslationApiPrompt(value: string) {
    translationApiPrompt.value = value;
    await configRepository.setString("VRCX_translationAPIPrompt", translationApiPrompt.value);
  }

  async function fetchAvailableModels(overrides: FetchModelsOverrides = {}): Promise<string[]> {
    const baseURL = firstNonEmpty(overrides.endpoint, translationApiEndpoint.value);

    if (!baseURL) {
      toast.warning("Translation endpoint not configured");
      return [];
    }

    let modelsURL: string;
    try {
      const url = new URL(baseURL);
      const basePath = url.pathname.replace(/\/+$/, "");

      if (basePath.endsWith("/chat/completions")) {
        url.pathname = basePath.replace(/\/chat\/completions$/, "/models");
      } else if (basePath.endsWith("/models")) {
        url.pathname = basePath;
      } else {
        url.pathname = `${basePath}/models`;
      }

      url.search = "";
      url.hash = "";
      modelsURL = url.toString();
    } catch {
      const normalizedBaseURL = baseURL.endsWith("/") ? baseURL.slice(0, -1) : baseURL;

      if (normalizedBaseURL.includes("/chat/completions")) {
        modelsURL = normalizedBaseURL.replace(/\/chat\/completions$/, "/models");
      } else if (normalizedBaseURL.endsWith("/models")) {
        modelsURL = normalizedBaseURL;
      } else {
        modelsURL = `${normalizedBaseURL}/models`;
      }
    }

    const keyToUse = overrides.key ?? translationApiKey.value;
    const headers = keyToUse ? { Authorization: `Bearer ${keyToUse}` } : {};

    try {
      const response = await webApiService.execute({
        url: modelsURL,
        method: "GET",
        headers,
      });

      if (response.status !== 200) {
        throw new Error(`Failed to fetch models: ${response.status} - ${response.data}`);
      }

      const data: unknown = JSON.parse(response.data);
      logWebRequest("[EXTERNAL GET]", modelsURL, `(${response.status})`, data);

      const modelIds = readModelIds(data);
      if (modelIds) {
        return modelIds;
      }

      throw new Error("Unexpected API response format");
    } catch (error) {
      console.error("Failed to fetch models:", error);
      toast.error(`Failed to fetch models: ${messageOf(error)}`);
      return [];
    }
  }

  function setBioLanguage(language: string) {
    bioLanguage.value = language;
    void configRepository.setString("VRCX_bioLanguage", language).catch(logSaveFailure);
  }
  async function setProgressPie() {
    progressPie.value = !progressPie.value;
    await configRepository.setBool("VRCX_progressPie", progressPie.value);
  }
  async function setProgressPieFilter() {
    progressPieFilter.value = !progressPieFilter.value;
    await configRepository.setBool("VRCX_progressPieFilter", progressPieFilter.value);
  }
  async function setShowConfirmationOnSwitchAvatar() {
    showConfirmationOnSwitchAvatar.value = !showConfirmationOnSwitchAvatar.value;
    await configRepository.setBool("VRCX_showConfirmationOnSwitchAvatar", showConfirmationOnSwitchAvatar.value);
  }
  async function setGameLogDisabled() {
    gameLogDisabled.value = !gameLogDisabled.value;
    await configRepository.setBool("VRCX_gameLogDisabled", gameLogDisabled.value);
  }

  async function setAvatarAutoCleanup(value: string) {
    avatarAutoCleanup.value = value;
    await configRepository.setString("VRCX_avatarAutoCleanup", value);
  }

  async function purgeAvatarFeedData(days: number | null) {
    let cutoffDate: string | null = null;
    if (days !== null) {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - days);
      cutoffDate = cutoff.toJSON();
    }

    purgeInProgress.value = true;

    const msgBox = toast.warning(t("view.settings.advanced.advanced.database_cleanup.purge_in_progress"), {
      duration: Infinity,
    });

    try {
      await database.purgeAvatarFeedData(cutoffDate);
      await database.vacuum();
      toast.dismiss(msgBox);
      toast.success(t("view.settings.advanced.advanced.database_cleanup.purge_complete"));

      await new Promise((resolve) => setTimeout(resolve, 1500));
      VRCXUpdaterStore.restartVRCX(false);
    } catch (err) {
      console.error(err);
      toast.dismiss(msgBox);
      toast.error(t("view.settings.advanced.advanced.database_cleanup.purge_failed", { error: err }));
    } finally {
      purgeInProgress.value = false;
    }
  }

  async function runAvatarAutoCleanup(userId: string) {
    const cleanupSetting = await configRepository.getString("VRCX_avatarAutoCleanup", "Off");
    if (cleanupSetting === "Off") return;

    const configKey = `VRCX_lastAvatarCleanupDate_${userId}`;
    const lastCleanupStr = await configRepository.getString(configKey, "");
    const now = new Date();

    if (lastCleanupStr) {
      const lastCleanup = new Date(lastCleanupStr);
      const daysSinceLastCleanup = (now.getTime() - lastCleanup.getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceLastCleanup < 7) return;
    }

    const days = parseLeadingInt(cleanupSetting);
    if (Number.isNaN(days) || days <= 0) return;

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    const cutoffDate = cutoff.toJSON();

    try {
      await database.purgeAvatarFeedData(cutoffDate);
      await configRepository.setString(configKey, now.toJSON());
      console.log(`Auto-cleaned avatar feed data older than ${days} days`);
    } catch (err) {
      console.error("Avatar auto-cleanup failed:", err);
    }
  }

  async function setSaveInstanceEmoji() {
    saveInstanceEmoji.value = !saveInstanceEmoji.value;
    await configRepository.setBool("VRCX_saveInstanceEmoji", saveInstanceEmoji.value);
  }

  async function setUGCFolderPath(path: string | null | undefined) {
    if (typeof path !== "string") {
      path = "";
    }
    ugcFolderPath.value = path;
    await configRepository.setString("VRCX_userGeneratedContentPath", path);
  }

  async function setAutoDeleteOldPrints() {
    autoDeleteOldPrints.value = !autoDeleteOldPrints.value;
    await configRepository.setBool("VRCX_autoDeleteOldPrints", autoDeleteOldPrints.value);
  }

  async function setNotificationOpacity(value: number) {
    notificationOpacity.value = value;
    await configRepository.setInt("VRCX_notificationOpacity", value);
  }

  async function setVrcRegistryAutoBackup() {
    vrcRegistryAutoBackup.value = !vrcRegistryAutoBackup.value;
    await configRepository.setBool("VRCX_vrcRegistryAutoBackup", vrcRegistryAutoBackup.value);
  }

  async function setVrcRegistryAskRestore() {
    vrcRegistryAskRestore.value = !vrcRegistryAskRestore.value;
    await configRepository.setBool("VRCX_vrcRegistryAskRestore", vrcRegistryAskRestore.value);
  }

  function checkSentryConsent() {
    void modalStore
      .confirm({
        description: t("view.settings.advanced.advanced.anonymous_error_reporting.consent_description"),
        title: t("view.settings.advanced.advanced.anonymous_error_reporting.consent_title"),
      })
      .then(({ ok }) => {
        if (!ok) return;
        void modalStore
          .confirm({
            description: t("view.settings.advanced.advanced.anonymous_error_reporting.enabled_restart_description"),
            title: t("confirm.restart_required_title"),
            confirmText: t("confirm.restart_now"),
            cancelText: t("confirm.restart_later"),
          })
          .then(({ ok }) => {
            if (!ok) return;

            sentryErrorReporting.value = true;
            void configRepository.setBool("VRCX_SentryEnabled", true).catch(logSaveFailure);

            VRCXUpdaterStore.restartVRCX(false);
          })
          .catch(logDialogFailure);
      })
      .catch(logDialogFailure);
  }

  function setSentryErrorReporting() {
    if (VRCXUpdaterStore.branch !== "Nightly") return;

    void modalStore
      .confirm({
        description: t("view.settings.advanced.advanced.anonymous_error_reporting.disabled_restart_description"),
        title: t("confirm.restart_required_title"),
        confirmText: t("confirm.restart_now"),
        cancelText: t("confirm.restart_later"),
      })
      .then(async ({ ok }) => {
        if (!ok) return;

        sentryErrorReporting.value = !sentryErrorReporting.value;
        await configRepository.setBool("VRCX_SentryEnabled", sentryErrorReporting.value);
        VRCXUpdaterStore.restartVRCX(false);
      })
      .catch(logDialogFailure);
  }

  async function getSqliteTableSizes() {
    const [gps, status, bio, avatar, onlineOffline, friendLogHistory, notification, location, joinLeave, portalSpawn, videoPlay, event, external] =
      await Promise.all([
        database.getGpsTableSize(),
        database.getStatusTableSize(),
        database.getBioTableSize(),
        database.getAvatarTableSize(),
        database.getOnlineOfflineTableSize(),
        database.getFriendLogHistoryTableSize(),
        database.getNotificationTableSize(),
        database.getLocationTableSize(),
        database.getJoinLeaveTableSize(),
        database.getPortalSpawnTableSize(),
        database.getVideoPlayTableSize(),
        database.getEventTableSize(),
        database.getExternalTableSize(),
      ]);

    sqliteTableSizes.value = {
      gps,
      status,
      bio,
      avatar,
      onlineOffline,
      friendLogHistory,
      notification,
      location,
      joinLeave,
      portalSpawn,
      videoPlay,
      event,
      external,
    };
  }

  function handleSetAppLauncherSettings() {
    void AppApi.SetAppLauncherSettings(enableAppLauncher.value, enableAppLauncherAutoClose.value, enableAppLauncherRunProcessOnce.value).catch(
      logActionFailure
    );
  }

  async function lookupYouTubeVideo(videoId: string): Promise<YouTubeVideoLookup | null> {
    if (!youTubeApiKey.value) {
      console.warn("no Youtube API key configured");
      return null;
    }
    let data: YouTubeVideoLookup | null = null;
    const apiKey = youTubeApiKey.value;
    try {
      const url = `https://www.googleapis.com/youtube/v3/videos?id=${encodeURIComponent(videoId)}&part=snippet,contentDetails&key=${apiKey}`;
      const response = await webApiService.execute({
        url,
        method: "GET",
        headers: {
          Referer: "https://vrcx.app",
        },
      });
      const json: unknown = JSON.parse(response.data);
      logWebRequest("[EXTERNAL GET]", url, `(${response.status})`, json);
      if (response.status === 200) {
        const lookup = readYouTubeVideoLookup(json);
        if (!lookup) {
          throw new Error("YouTube API returned an unexpected response");
        }
        data = lookup;
      } else {
        throw new Error(`Error: ${response.data}`);
      }
    } catch {
      console.error(`YouTube video lookup failed for ${videoId}`);
    }
    return data;
  }

  async function translateText(text: string, targetLang: string, overrides?: TranslationOverrides): Promise<string | null> {
    if (!translationApi.value) {
      toast.warning("Translation API disabled");
      return null;
    }

    const provider = firstNonEmpty(overrides?.type, translationApiType.value, "google");

    if (provider === "google") {
      const keyToUse = overrides?.key ?? translationApiKey.value;
      if (!keyToUse) {
        toast.warning("No Translation API key configured");
        return null;
      }
      try {
        const url = `https://translation.googleapis.com/language/translate/v2?key=${keyToUse}`;
        const request = {
          url,
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Referer: "https://vrcx.app",
          },
          body: JSON.stringify({
            q: text,
            target: targetLang,
            format: "text",
          }),
        };
        const response = await webApiService.execute(request);
        if (response.status !== 200) {
          throw new Error(`Translation API error: ${response.status} - ${response.data}`);
        }
        const data: unknown = JSON.parse(response.data);
        logWebRequest("[EXTERNAL POST]", url, `(${response.status})`, data);
        const translated = readGoogleTranslatedText(data);
        if (translated === undefined) {
          throw new Error("Translation API returned no translated text");
        }
        return translated;
      } catch (err) {
        toast.error(`Translation failed: ${messageOf(err)}`);
        return null;
      }
    }

    const endpoint = firstNonEmpty(overrides?.endpoint, translationApiEndpoint.value, "https://api.openai.com/v1/chat/completions");
    const model = firstNonEmpty(overrides?.model, translationApiModel.value, "gpt-5.1");
    const prompt = firstNonEmpty(
      overrides?.prompt,
      translationApiPrompt.value,
      `You are a translation assistant. Translate the user message into ${targetLang}. Only return the translated text.`
    );

    if (!endpoint || !model) {
      toast.warning("Translation endpoint/model missing");
      return null;
    }

    const keyToUse = overrides?.key ?? translationApiKey.value;
    const headers = {
      "Content-Type": "application/json",
      Referer: "https://vrcx.app",
      "HTTP-Referer": "https://vrcx.app",
      "X-Title": "VRCX",
      ...(keyToUse ? { Authorization: `Bearer ${keyToUse}` } : {}),
    };

    try {
      const request = {
        url: endpoint,
        method: "POST",
        headers,
        body: JSON.stringify({
          model,
          messages: [
            {
              role: "system",
              content: prompt,
            },
            {
              role: "user",
              content: text,
            },
          ],
        }),
      };
      const response = await webApiService.execute(request);

      if (response.status !== 200) {
        throw new Error(`Translation API error: ${response.status} - ${response.data}`);
      }

      const data: unknown = JSON.parse(response.data);
      logWebRequest("[EXTERNAL POST]", endpoint, `(${response.status})`, data);

      return readChatCompletionContent(data)?.trim() ?? null;
    } catch {
      toast.error(`Translation failed`);
      return null;
    }
  }

  function cropPrintsChanged() {
    if (!cropInstancePrints.value) return;
    void modalStore
      .confirm({
        description: t("view.settings.advanced.advanced.save_instance_prints_to_file.crop_convert_old"),
        title: "",
        confirmText: t("view.settings.advanced.advanced.save_instance_prints_to_file.crop_convert_old_confirm"),
        cancelText: t("view.settings.advanced.advanced.save_instance_prints_to_file.crop_convert_old_cancel"),
      })
      .then(async ({ ok }) => {
        if (!ok) return;
        const msgBox = toast.warning("Batch print cropping in progress...", {
          duration: Infinity,
          position: "bottom-right",
        });
        try {
          await AppApi.CropAllPrints(ugcFolderPath.value);
          toast.success("Batch print cropping complete");
        } catch (err) {
          console.error(err);
          toast.error(`Batch print cropping failed: ${String(err)}`);
        } finally {
          toast.dismiss(msgBox);
        }
      })
      .catch(logDialogFailure);
  }

  function askDeleteAllScreenshotMetadata() {
    void modalStore
      .confirm({
        description: t("view.settings.advanced.advanced.delete_all_screenshot_metadata.ask"),
        title: "",
        confirmText: t("view.settings.advanced.advanced.delete_all_screenshot_metadata.confirm_yes"),
        cancelText: t("view.settings.advanced.advanced.delete_all_screenshot_metadata.confirm_no"),
      })
      .then(({ ok }) => {
        if (!ok) return;
        deleteAllScreenshotMetadata();
      })
      .catch(logDialogFailure);
  }

  function deleteAllScreenshotMetadata() {
    void modalStore
      .confirm({
        description: t("view.settings.advanced.advanced.delete_all_screenshot_metadata.confirm"),
        title: "",
        confirmText: t("view.settings.advanced.advanced.save_instance_prints_to_file.crop_convert_old_confirm"),
        cancelText: t("view.settings.advanced.advanced.save_instance_prints_to_file.crop_convert_old_cancel"),
      })
      .then(async ({ ok }) => {
        if (!ok) return;
        const msgBox = toast.warning("Batch metadata removal in progress...", {
          duration: Infinity,
          position: "bottom-right",
        });
        try {
          await AppApi.DeleteAllScreenshotMetadata();
          toast.success("Batch metadata removal complete");
        } catch (err) {
          console.error(err);
          toast.error(`Batch metadata removal failed: ${String(err)}`);
        } finally {
          toast.dismiss(msgBox);
        }
      })
      .catch(logDialogFailure);
  }

  function resetUGCFolder() {
    void setUGCFolderPath("").catch(logSaveFailure);
  }

  async function openUGCFolder() {
    await AppApi.OpenUGCPhotosFolder(ugcFolderPath.value);
  }

  async function folderSelectorDialog(oldPath?: string | null) {
    if (state.folderSelectorDialogVisible) return;
    oldPath ??= "";

    state.folderSelectorDialogVisible = true;
    let newFolder: string;
    if (isHostWindows) {
      newFolder = await AppApi.OpenFolderSelectorDialog(oldPath);
    } else {
      newFolder = await window.electron.openDirectoryDialog();
    }

    state.folderSelectorDialogVisible = false;
    return newFolder;
  }

  async function openUGCFolderSelector() {
    const path = await folderSelectorDialog(ugcFolderPath.value);
    await setUGCFolderPath(path);
  }

  function showVRChatConfig(): Promise<void> {
    isVRChatConfigDialogVisible.value = true;
    if (!gameStore.VRChatUsedCacheSize) {
      void gameStore.getVRChatCacheSize().catch(logActionFailure);
    }
    return Promise.resolve();
  }

  function promptAutoClearVRCXCacheFrequency() {
    void modalStore
      .prompt({
        title: t("prompt.auto_clear_cache.header"),
        description: t("prompt.auto_clear_cache.description"),
        confirmText: t("prompt.auto_clear_cache.ok"),
        cancelText: t("prompt.auto_clear_cache.cancel"),
        inputValue: (vrcxStore.clearVRCXCacheFrequency / 3600 / 2).toString(),
        pattern: /\d+$/,
        errorMessage: t("prompt.auto_clear_cache.input_error"),
      })
      .then(async ({ ok, value }) => {
        if (!ok) return;
        const hours = parseLeadingInt(value);
        if (value && !Number.isNaN(hours)) {
          vrcxStore.setClearVRCXCacheFrequency(hours * 3600 * 2);
          updateLoopStore.setNextClearVRCXCacheCheck(vrcxStore.clearVRCXCacheFrequency / 2);
          await configRepository.setString("VRCX_clearVRCXCacheFrequency", vrcxStore.clearVRCXCacheFrequency.toString());
        }
      })
      .catch(logDialogFailure);
  }

  return {
    state,

    bioLanguage,
    enablePrimaryPassword,
    relaunchVRChatAfterCrash,
    vrcQuitFix,
    autoSweepVRChatCache,
    selfInviteOverride,
    saveInstancePrints,
    cropInstancePrints,
    saveInstanceStickers,
    avatarRemoteDatabase,
    enableAppLauncher,
    enableAppLauncherAutoClose,
    enableAppLauncherRunProcessOnce,
    screenshotHelper,
    screenshotHelperModifyFilename,
    screenshotHelperCopyToClipboard,
    youTubeApi,
    translationApi,
    youTubeApiKey,
    translationApiKey,
    translationApiType,
    translationApiEndpoint,
    translationApiModel,
    translationApiPrompt,
    progressPie,
    progressPieFilter,
    showConfirmationOnSwitchAvatar,
    gameLogDisabled,
    sqliteTableSizes,
    avatarAutoCleanup,
    purgeInProgress,
    ugcFolderPath,
    currentUserInventory,
    autoDeleteOldPrints,
    notificationOpacity,
    isVRChatConfigDialogVisible,
    saveInstanceEmoji,
    vrcRegistryAutoBackup,
    vrcRegistryAskRestore,
    sentryErrorReporting,

    setEnablePrimaryPassword,
    setEnablePrimaryPasswordConfigRepository,
    setBioLanguage,
    setRelaunchVRChatAfterCrash,
    setVrcQuitFix,
    setAutoSweepVRChatCache,
    setSelfInviteOverride,
    setSaveInstancePrints,
    setCropInstancePrints,
    setSaveInstanceStickers,
    setAvatarRemoteDatabase,
    setEnableAppLauncher,
    setEnableAppLauncherAutoClose,
    setEnableAppLauncherRunProcessOnce,
    setScreenshotHelper,
    setScreenshotHelperModifyFilename,
    setScreenshotHelperCopyToClipboard,
    setYouTubeApi,
    setTranslationApi,
    setYouTubeApiKey,
    setTranslationApiKey,
    setTranslationApiType,
    setTranslationApiEndpoint,
    setTranslationApiModel,
    setTranslationApiPrompt,
    setProgressPie,
    setProgressPieFilter,
    setShowConfirmationOnSwitchAvatar,
    setGameLogDisabled,
    setAvatarAutoCleanup,
    purgeAvatarFeedData,
    runAvatarAutoCleanup,
    setUGCFolderPath,
    cropPrintsChanged,
    setAutoDeleteOldPrints,
    setNotificationOpacity,
    getSqliteTableSizes,
    handleSetAppLauncherSettings,
    lookupYouTubeVideo,
    translateText,
    fetchAvailableModels,
    resetUGCFolder,
    openUGCFolder,
    openUGCFolderSelector,
    folderSelectorDialog,
    showVRChatConfig,
    promptAutoClearVRCXCacheFrequency,
    setSaveInstanceEmoji,
    setVrcRegistryAutoBackup,
    setVrcRegistryAskRestore,
    setSentryErrorReporting,
    checkSentryConsent,
    askDeleteAllScreenshotMetadata,
  };
});
