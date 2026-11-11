import { reactive, ref, watch } from "vue";
import { defineStore } from "pinia";
import { toast } from "vue-sonner";
import { useI18n } from "vue-i18n";

import { DEFAULT_MAX_TABLE_SIZE, DEFAULT_SEARCH_LIMIT, SEARCH_LIMIT_MAX, SEARCH_LIMIT_MIN } from "../shared/constants/settings";
import { debounce } from "../shared/utils/common";
import { parseLocation } from "../shared/utils/location-parser";
import { parseFileSaveResult } from "../shared/utils/file-save-result";
import type { FileSaveResult } from "../shared/utils/file-save-result";
import { AppDebug } from "../services/app-config";
import { database } from "../services/database";
import { refreshCustomScript } from "../shared/utils/base/ui";
import { useAdvancedSettingsStore } from "./settings/advanced";
import { useAvatarProviderStore } from "./avatar-provider";
import { useFavoriteStore } from "./favorite";
import { useGameLogStore } from "./gameLog";
import { useGameStore } from "./game";
import { addCustomTag } from "../coordinators/user-tags-status";
import { useLocationStore } from "./location";
import { useModalStore } from "./modal";
import { useNotificationStore } from "./notification";
import { usePhotonStore } from "./photon";
import { useSearchStore } from "./search";
import { useUpdateLoopStore } from "./update-loop";
import { useUserStore } from "./user";
import { clearVRCXCache } from "../coordinators/vrcx-coordinator";
import { resetSearchIndexOnLogin } from "../coordinators/search-index-coordinator";
import { watchState } from "../services/watch-state";
import { configRepository } from "../services/config";
import { isIpcMessage, logError, param254, parseLeadingInt, type IpcVrcxMessage } from "./vrcx-messages";
import { createVrcxLaunchCommands } from "./vrcx-launch-commands";
import { createVrcxRegistryBackup } from "./vrcx-registry-backup";

export const useVrcxStore = defineStore("Vrcx", () => {
  const gameStore = useGameStore();
  const locationStore = useLocationStore();
  const notificationStore = useNotificationStore();

  const favoriteStore = useFavoriteStore();
  const userStore = useUserStore();
  const photonStore = usePhotonStore();
  const advancedSettingsStore = useAdvancedSettingsStore();
  const searchStore = useSearchStore();
  const avatarProviderStore = useAvatarProviderStore();
  const gameLogStore = useGameLogStore();
  const updateLoopStore = useUpdateLoopStore();
  const { t } = useI18n();
  const modalStore = useModalStore();

  const state = reactive({
    databaseVersion: 0,
    locationX: 0,
    locationY: 0,
    sizeWidth: 800,
    sizeHeight: 600,
    windowState: "",
    externalNotifierVersion: 0,
  });
  const databaseUpgradeState = ref({
    visible: false,
    fromVersion: 0,
    toVersion: 0,
  });
  const databaseReadyForAutoLogin = ref(false);

  let resolveDatabaseInit: () => void = () => undefined;
  const databaseInitComplete = new Promise<void>((resolve) => {
    resolveDatabaseInit = () => resolve();
  });

  const currentlyDroppingFile = ref<string | null>(null);
  const isRegistryBackupDialogVisible = ref(false);
  const ipcEnabled = ref(false);
  const clearVRCXCacheFrequency = ref(172800);
  const maxTableSize = ref(DEFAULT_MAX_TABLE_SIZE);
  const searchLimit = ref(DEFAULT_SEARCH_LIMIT);
  const proxyServer = ref("");
  const appStartAt = Date.now();
  const isBrowserFocused = ref(true);

  async function init() {
    try {
      if (isHostLinux) {
        try {
          window.electron.ipcRenderer.on("launch-command", (command) => {
            if (typeof command === "string" && command) {
              eventLaunchCommand(command);
            }
          });

          window.electron.onWindowPositionChanged((_event, position) => {
            state.locationX = position.x;
            state.locationY = position.y;
            debounce(saveVRCXWindowOption, 300)();
          });

          window.electron.onWindowSizeChanged((_event, size) => {
            state.sizeWidth = size.width;
            state.sizeHeight = size.height;
            debounce(saveVRCXWindowOption, 300)();
          });

          window.electron.onWindowStateChange((_event, newState) => {
            state.windowState = newState;
            debounce(saveVRCXWindowOption, 300)();
          });

          window.electron.onBrowserFocus(() => {
            onBrowserFocus();
          });

          window.electron.onBrowserBlur(() => {
            onBrowserBlur();
          });
        } catch (err) {
          console.error("Failed to register Linux IPC handlers:", err);
        }
      }

      state.databaseVersion = await configRepository.getInt("VRCX_databaseVersion", 0);
      const isDatabaseUpgradeSucceeded = await updateDatabaseVersion();
      if (!isDatabaseUpgradeSucceeded) {
        return;
      }

      clearVRCXCacheFrequency.value = await configRepository.getInt("VRCX_clearVRCXCacheFrequency", 172800);

      if (!(await VRCXStorage.Get("VRCX_DatabaseLocation"))) {
        await VRCXStorage.Set("VRCX_DatabaseLocation", "");
      }
      if (!(await VRCXStorage.Get("VRCX_ProxyServer"))) {
        await VRCXStorage.Set("VRCX_ProxyServer", "");
      }
      if ((await VRCXStorage.Get("VRCX_DisableGpuAcceleration")) === "") {
        await VRCXStorage.Set("VRCX_DisableGpuAcceleration", "false");
      }
      if ((await VRCXStorage.Get("VRCX_DisableVrOverlayGpuAcceleration")) === "") {
        await VRCXStorage.Set("VRCX_DisableVrOverlayGpuAcceleration", "false");
      }
      proxyServer.value = await VRCXStorage.Get("VRCX_ProxyServer");
      state.locationX = parseLeadingInt(await VRCXStorage.Get("VRCX_LocationX"));
      state.locationY = parseLeadingInt(await VRCXStorage.Get("VRCX_LocationY"));
      state.sizeWidth = parseLeadingInt(await VRCXStorage.Get("VRCX_SizeWidth"));
      state.sizeHeight = parseLeadingInt(await VRCXStorage.Get("VRCX_SizeHeight"));
      state.windowState = await VRCXStorage.Get("VRCX_WindowState");

      maxTableSize.value = await configRepository.getInt("VRCX_maxTableSize_v2", DEFAULT_MAX_TABLE_SIZE);
      database.setMaxTableSize(maxTableSize.value);

      searchLimit.value = await configRepository.getInt("VRCX_searchLimit", DEFAULT_SEARCH_LIMIT);
      if (searchLimit.value < SEARCH_LIMIT_MIN) {
        searchLimit.value = SEARCH_LIMIT_MIN;
      }
      if (searchLimit.value > SEARCH_LIMIT_MAX) {
        searchLimit.value = SEARCH_LIMIT_MAX;
      }
      database.setSearchTableSize(searchLimit.value);

      refreshCustomScript().catch(logError);
      databaseReadyForAutoLogin.value = true;
    } finally {
      resolveDatabaseInit();
    }
  }

  resetSearchIndexOnLogin();
  init().catch(logError);

  async function updateDatabaseVersion() {
    const databaseVersion = 18;
    if (state.databaseVersion < databaseVersion) {
      databaseUpgradeState.value = {
        visible: state.databaseVersion > 0,
        fromVersion: state.databaseVersion,
        toVersion: databaseVersion,
      };
      console.log(`Updating database from ${state.databaseVersion} to ${databaseVersion}...`);
      try {
        await database.upgradeDatabaseVersion();
        await database.vacuum();
        await database.optimize();
        await configRepository.setInt("VRCX_databaseVersion", databaseVersion);
        console.log("Database update complete.");
        state.databaseVersion = databaseVersion;
        databaseUpgradeState.value.visible = false;
      } catch (err) {
        console.error(err);
        databaseUpgradeState.value.visible = false;
        await modalStore.alert({
          title: t("message.database.upgrade_failed_title"),
          description: t("message.database.upgrade_failed_description"),
          dismissible: false,
        });
        AppApi.ShowDevTools().catch(logError);
        return false;
      }
    }
    return true;
  }

  async function waitForDatabaseInit() {
    await databaseInitComplete;
    return databaseReadyForAutoLogin.value;
  }

  function setProxyServer(value: string) {
    proxyServer.value = value;
  }

  function setIpcEnabled(isEnabled: boolean) {
    ipcEnabled.value = isEnabled;
  }

  function setClearVRCXCacheFrequency(value: number) {
    clearVRCXCacheFrequency.value = value;
  }

  function setMaxTableSize(value: number) {
    maxTableSize.value = value;
  }

  function setSearchLimit(value: number) {
    searchLimit.value = value;
  }

  async function eventVrcxMessage(data: IpcVrcxMessage) {
    switch (data.MsgType) {
      case "CustomTag":
        addCustomTag(data);
        break;
      case "ClearCustomTags":
        userStore.customUserTags.forEach((_value, key) => {
          userStore.customUserTags.delete(key);
          const ref = userStore.cachedUsers.get(key);
          if (typeof ref !== "undefined") {
            ref.$customTag = "";
            ref.$customTagColour = "";
          }
        });
        break;
      case "Noty": {
        if (photonStore.photonLoggingEnabled || (state.externalNotifierVersion && state.externalNotifierVersion > 21)) {
          return;
        }
        const entry = {
          created_at: new Date().toJSON(),
          type: "Event" as const,
          data: data.Data,
        };
        notificationStore.queueGameLogNoty(entry);
        const persistedEntry = await database.addGamelogEventToDatabase(entry);
        if (persistedEntry) {
          gameLogStore.addGameLog(persistedEntry);
        }
        break;
      }
      case "External": {
        const displayName = data.DisplayName ?? "";
        const isNotify = data.notify ?? true;
        const entry = {
          created_at: new Date().toJSON(),
          type: "External" as const,
          message: data.Data,
          displayName,
          userId: data.UserId,
          location: locationStore.lastLocation.location,
        };
        if (isNotify) {
          notificationStore.queueGameLogNoty(entry);
        }
        const persistedEntry = await database.addGamelogExternalToDatabase(entry);
        if (persistedEntry) {
          gameLogStore.addGameLog(persistedEntry);
        }
        break;
      }
      default:
        console.log("VRCXMessage:", data);
        break;
    }
  }

  function saveVRCXWindowOption() {
    if (isHostLinux) {
      VRCXStorage.Set("VRCX_LocationX", state.locationX.toString()).catch(logError);
      VRCXStorage.Set("VRCX_LocationY", state.locationY.toString()).catch(logError);
      VRCXStorage.Set("VRCX_SizeWidth", state.sizeWidth.toString()).catch(logError);
      VRCXStorage.Set("VRCX_SizeHeight", state.sizeHeight.toString()).catch(logError);
      VRCXStorage.Set("VRCX_WindowState", state.windowState).catch(logError);
    }
  }

  async function processScreenshot(path: string) {
    let newPath = path;
    if (advancedSettingsStore.screenshotHelper) {
      const location = parseLocation(locationStore.lastLocation.location);
      const players: { id: string; displayName: string }[] = [];
      const metadata = {
        application: "VRCX",
        version: 1,
        author: {
          id: userStore.currentUser.id,
          displayName: userStore.currentUser.displayName,
        },
        world: {
          name: locationStore.lastLocation.name,
          id: location.worldId,
          instanceId: locationStore.lastLocation.location,
        },
        players,
      };
      for (const user of locationStore.lastLocation.playerList.values()) {
        players.push({
          id: user.userId,
          displayName: user.displayName,
        });
      }
      let result: FileSaveResult;
      try {
        result = parseFileSaveResult(
          await AppApi.AddScreenshotMetadata(path, JSON.stringify(metadata), location.worldId, advancedSettingsStore.screenshotHelperModifyFilename)
        );
      } catch (e) {
        console.error("Failed to add screenshot metadata", e);
        return;
      }
      if (result.status === "accessDenied") {
        toast.error("Failed to add screenshot metadata, access denied. Make sure VRCX has permission to access the screenshot folder.", { duration: 10000 });
      }
      if (result.status !== "saved") {
        console.error("Failed to add screenshot metadata", path);
        return;
      }
      newPath = result.path;
      console.log("Screenshot metadata added", newPath);
    }
    if (advancedSettingsStore.screenshotHelperCopyToClipboard) {
      await AppApi.CopyImageToClipboard(newPath);
      console.log("Screenshot copied to clipboard", newPath);
    }
  }

  async function ipcEvent(json: string) {
    if (!watchState.isLoggedIn) {
      return;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(json);
    } catch {
      console.log(`IPC invalid JSON, ${json}`);
      return;
    }
    if (!isIpcMessage(parsed)) {
      console.log("IPC:", parsed);
      return;
    }
    const data = parsed;

    switch (data.type) {
      case "OnEvent":
        if (!gameStore.isGameRunning) {
          console.log("Game closed, skipped event", data);
          return;
        }
        if (AppDebug.debugPhotonLogging || AppDebug.debugIPC) {
          console.log("OnEvent", data.OnEventData.Code, "Param[254]:", param254(data.OnEventData.Parameters), data.OnEventData);
        }
        photonStore.parsePhotonEvent(data.OnEventData, data.dt);
        photonStore.photonEventPulse();
        break;
      case "OnOperationResponse":
        if (!gameStore.isGameRunning) {
          console.log("Game closed, skipped event", data);
          return;
        }
        if (AppDebug.debugPhotonLogging || AppDebug.debugIPC) {
          console.log(
            "OnOperationResponse",
            data.OnOperationResponseData.OperationCode,
            "Param[254]:",
            param254(data.OnOperationResponseData.Parameters),
            data.OnOperationResponseData
          );
        }
        photonStore.parseOperationResponse(data.OnOperationResponseData, data.dt);
        photonStore.photonEventPulse();
        break;
      case "OnOperationRequest":
        if (!gameStore.isGameRunning) {
          console.log("Game closed, skipped event", data);
          return;
        }
        if (AppDebug.debugPhotonLogging || AppDebug.debugIPC) {
          console.log("OnOperationRequest", data.OnOperationRequestData.OperationCode, data.OnOperationRequestData);
        }
        break;
      case "VRCEvent":
        if (!gameStore.isGameRunning) {
          console.log("Game closed, skipped event", data);
          return;
        }
        if (AppDebug.debugIPC) {
          console.log("VRCEvent:", data);
        }
        photonStore.parseVRCEvent(data);
        photonStore.photonEventPulse();
        break;
      case "Event7List":
        if (AppDebug.debugIPC) {
          console.log("Event7List:", data);
        }
        photonStore.photonEvent7List.clear();
        for (const [id, dt] of Object.entries(data.Event7List)) {
          photonStore.photonEvent7List.set(parseLeadingInt(id), dt);
        }
        photonStore.setPhotonLastEvent7List(Date.parse(data.dt));
        break;
      case "VrcxMessage":
        if (AppDebug.debugPhotonLogging || AppDebug.debugIPC) {
          console.log("VrcxMessage:", data);
        }
        await eventVrcxMessage(data);
        break;
      case "Ping":
        if (AppDebug.debugIPC) {
          console.log("IPC Ping");
        }
        if (!photonStore.photonLoggingEnabled) {
          photonStore.setPhotonLoggingEnabled();
        }
        ipcEnabled.value = true;
        updateLoopStore.setIpcTimeout(60);
        break;
      case "MsgPing":
        if (AppDebug.debugIPC) {
          console.log("MsgPing:", data);
        }
        state.externalNotifierVersion = data.version;
        break;
      case "LaunchCommand":
        eventLaunchCommand(data.command);
        break;
      case "VRCXLaunch":
        console.log("VRCXLaunch:", data);
        break;
      default:
        console.log("IPC:", data);
    }
  }

  function dragEnterCef(filePath: string) {
    currentlyDroppingFile.value = filePath;
  }

  watch(
    () => watchState.isLoggedIn,
    (isLoggedIn) => {
      isRegistryBackupDialogVisible.value = false;
      if (isLoggedIn) {
        startupLaunchCommand().catch(logError);
      }
    },
    { flush: "sync" }
  );

  function onBrowserFocus() {
    isBrowserFocused.value = true;
  }

  function onBrowserBlur() {
    isBrowserFocused.value = false;
  }

  const { startupLaunchCommand, eventLaunchCommand } = createVrcxLaunchCommands({
    favoriteStore,
    advancedSettingsStore,
    searchStore,
    avatarProviderStore,
    t,
  });
  const { backupVrcRegistry, checkAutoBackupRestoreVrcRegistry, showRegistryBackupDialog, tryAutoBackupVrcRegistry } = createVrcxRegistryBackup({
    advancedSettingsStore,
    modalStore,
    isRegistryBackupDialogVisible,
    t,
  });

  return {
    state,

    appStartAt,
    databaseUpgradeState,
    databaseReadyForAutoLogin,
    proxyServer,
    setProxyServer,
    setIpcEnabled,
    setClearVRCXCacheFrequency,
    setMaxTableSize,
    setSearchLimit,
    currentlyDroppingFile,
    isRegistryBackupDialogVisible,
    ipcEnabled,
    clearVRCXCacheFrequency,
    maxTableSize,
    searchLimit,
    clearVRCXCache,
    eventVrcxMessage,
    eventLaunchCommand,
    showRegistryBackupDialog,
    checkAutoBackupRestoreVrcRegistry,
    tryAutoBackupVrcRegistry,
    processScreenshot,
    ipcEvent,
    dragEnterCef,
    backupVrcRegistry,
    updateDatabaseVersion,
    waitForDatabaseInit,
    onBrowserFocus,
    onBrowserBlur,
    isBrowserFocused,
  };
});
