import { reactive, ref, watch } from "vue";
import { defineStore } from "pinia";
import { useI18n } from "vue-i18n";

import { languageCodes } from "../../localization/locales";
import { useGameStore } from "../game";
import { useModalStore } from "../modal";
import { useUpdateLoopStore } from "../update-loop";
import { useVRCXUpdaterStore } from "../vrcx-updater";
import { useVrcxStore } from "../vrcx";
import { watchState } from "../../services/watch-state";
import { configRepository } from "../../services/config";
import { firstNonEmpty } from "./advanced-helpers";
import { logSaveFailure, logActionFailure } from "./advanced-failure-logs";
import { createAdvancedTranslation } from "./advanced-translation";
import { createAdvancedUgcAndScreenshots } from "./advanced-ugc-and-screenshots";
import { createAdvancedSentry } from "./advanced-sentry";
import { createAdvancedDataMaintenance } from "./advanced-data-maintenance";

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

  function handleSetAppLauncherSettings() {
    void AppApi.SetAppLauncherSettings(enableAppLauncher.value, enableAppLauncherAutoClose.value, enableAppLauncherRunProcessOnce.value).catch(
      logActionFailure
    );
  }

  const { fetchAvailableModels, lookupYouTubeVideo, translateText } = createAdvancedTranslation({
    youTubeApiKey,
    translationApi,
    translationApiKey,
    translationApiType,
    translationApiEndpoint,
    translationApiModel,
    translationApiPrompt,
  });
  const { cropPrintsChanged, askDeleteAllScreenshotMetadata, resetUGCFolder, openUGCFolder, folderSelectorDialog, openUGCFolderSelector, showVRChatConfig } =
    createAdvancedUgcAndScreenshots({
      gameStore,
      modalStore,
      state,
      cropInstancePrints,
      ugcFolderPath,
      isVRChatConfigDialogVisible,
      setUGCFolderPath,
      t,
    });
  const { checkSentryConsent, setSentryErrorReporting } = createAdvancedSentry({
    VRCXUpdaterStore,
    modalStore,
    sentryErrorReporting,
    t,
  });
  const { setAvatarAutoCleanup, purgeAvatarFeedData, runAvatarAutoCleanup, getSqliteTableSizes, promptAutoClearVRCXCacheFrequency } =
    createAdvancedDataMaintenance({
      vrcxStore,
      VRCXUpdaterStore,
      modalStore,
      updateLoopStore,
      sqliteTableSizes,
      avatarAutoCleanup,
      purgeInProgress,
      t,
    });

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
