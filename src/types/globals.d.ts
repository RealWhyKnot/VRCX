type AppDebug = {
  debug: boolean;
  debugWebSocket: boolean;
  debugUserDiff: boolean;
  debugPhotonLogging: boolean;
  debugGameLog: boolean;
  debugWebRequests: boolean;
  debugFriendState: boolean;
  debugRecompute: boolean;
  debugIPC: boolean;
  debugVrcPlus: boolean;
  errorNoty: string | number | undefined;
  dontLogMeOut: boolean;
  endpointDomain: string;
  endpointDomainVrchat: string;
  websocketDomain: string;
  websocketDomainVrchat: string;
};

type HostAppApi = {
  ShowDevTools(): Promise<void>;
  SetVR(active: boolean, hmdOverlay: boolean, wristOverlay: boolean, menuButton: boolean, overlayHand: number): Promise<void>;
  SetZoom(zoomLevel: number): Promise<void>;
  GetZoom(): Promise<number>;
  DesktopNotification(boldText: string, text?: string, image?: string): Promise<void>;
  RestartApplication(isUpgrade: boolean): Promise<void>;
  CheckForUpdateExe(): Promise<boolean>;
  ExecuteVrOverlayFunction(functionName: string, json: string): Promise<void>;
  FocusWindow(): Promise<void>;
  ChangeTheme(value: number): Promise<void>;
  DoFunny(): Promise<void>;
  GetClipboard(): Promise<string>;
  SetStartup(enabled: boolean): Promise<void>;
  CopyImageToClipboard(path: string): Promise<void>;
  FlashWindow(): Promise<void>;
  SetUserAgent(): Promise<void>;
  SetTrayIconNotification(notify: boolean): Promise<void>;
  OpenCalendarFile(icsContent: string): Promise<void>;

  GetColourFromUserID(userId: string): Promise<number>;
  OpenLink(url: string): Promise<void>;
  OpenDiscordProfile(discordId: string): Promise<void>;
  OpenSteamStorePage(appId: number): Promise<void>;
  GetLaunchCommand(): Promise<string | null>;
  IPCAnnounceStart(): Promise<void>;
  SendIpc(type: string, data: string): Promise<void>;
  CustomCss(): Promise<string>;
  CustomScript(): Promise<string>;
  CurrentCulture(): Promise<string>;
  CurrentLanguage(): Promise<string>;
  GetVersion(): Promise<string>;
  VrcClosedGracefully(): Promise<boolean>;
  GetColourBulk(userIds: string[]): Promise<Record<string, number>>;
  SetAppLauncherSettings(enabled: boolean, killOnExit: boolean, runProcessOnce: boolean): Promise<void>;
  GetFileBase64(path: string): Promise<string | null>;
  TryOpenInstanceInVrc(launchUrl: string): Promise<boolean>;

  MD5File(blob: string): Promise<string>;
  SignFile(blob: string): Promise<string>;
  FileLength(blob: string): Promise<string>;

  GetVRChatAppDataLocation(): Promise<string>;
  GetVRChatPhotosLocation(): Promise<string>;
  GetUGCPhotoLocation(path?: string): Promise<string>;
  GetVRChatScreenshotsLocation(): Promise<string>;
  GetVRChatCacheLocation(): Promise<string>;
  OpenVrcxAppDataFolder(): Promise<boolean>;
  OpenVrcAppDataFolder(): Promise<boolean>;
  OpenVrcPhotosFolder(): Promise<boolean>;
  OpenUGCPhotosFolder(ugcPath?: string): Promise<boolean>;
  OpenVrcScreenshotsFolder(): Promise<boolean>;
  OpenCrashVrcCrashDumps(): Promise<boolean>;
  OpenShortcutFolder(): Promise<void>;
  OpenFolderAndSelectItem(path: string, isFolder?: boolean): Promise<void>;
  OpenFolderSelectorDialog(defaultPath?: string): Promise<string>;
  OpenFileSelectorDialog(defaultPath?: string, defaultExt?: string, defaultFilter?: string): Promise<string>;

  CheckGameRunning(): Promise<void>;
  IsGameRunning(): Promise<boolean>;
  IsSteamVRRunning(): Promise<boolean>;
  QuitGame(): Promise<number>;
  StartGame(args: string): Promise<boolean>;
  StartGameFromPath(path: string, args: string): Promise<boolean>;

  GetVRChatRegistryKey(key: string): Promise<unknown>;
  GetVRChatRegistryKeyString(key: string): Promise<string | null>;
  SetVRChatRegistryKey(key: string, value: unknown, typeInt: number): Promise<boolean>;
  SetVRChatRegistry(json: string): Promise<void>;
  HasVRChatRegistryFolder(): Promise<boolean>;
  DeleteVRChatRegistryFolder(): Promise<void>;
  ReadVrcRegJsonFile(filepath: string): Promise<string>;
  GetVRChatRegistryJson(): Promise<string>;

  PopulateImageHosts(json: string): Promise<void>;
  GetImage(url: string, fileId: string, version: string): Promise<string>;
  ResizeImageToFitLimits(base64data: string): Promise<string>;
  CropAllPrints(ugcFolderPath: string): Promise<void>;
  CropPrintImage(path: string): Promise<boolean>;
  SavePrintToFile(url: string, ugcFolderPath: string, monthFolder: string, fileName: string): Promise<string | null>;
  SaveStickerToFile(url: string, ugcFolderPath: string, monthFolder: string, fileName: string): Promise<string | null>;
  SaveEmojiToFile(url: string, ugcFolderPath: string, monthFolder: string, fileName: string): Promise<string | null>;

  AddScreenshotMetadata(path: string, metadataString: string, worldId: string, changeFilename?: boolean): Promise<string>;
  GetExtraScreenshotData(path: string, carouselCache: boolean): Promise<string>;
  GetScreenshotMetadata(path: string): Promise<string>;
  FindScreenshotsBySearch(searchQuery: string, searchType?: number): Promise<string>;
  GetLastScreenshot(): Promise<string>;
  DeleteScreenshotMetadata(path: string): Promise<boolean>;
  DeleteAllScreenshotMetadata(): Promise<void>;

  GetVRChatModerations(currentUserId: string): Promise<Record<string, number> | null>;
  GetVRChatUserModeration(currentUserId: string, userId: string): Promise<number>;
  SetVRChatUserModeration(currentUserId: string, userId: string, type: number): Promise<boolean>;

  ReadConfigFile(): Promise<string>;
  ReadConfigFileSafe(): Promise<string>;
  WriteConfigFile(json: string): Promise<void>;

  DownloadUpdate(fileUrl: string, hashString: string, downloadSize: number): Promise<void>;
  CancelUpdate(): Promise<void>;
  CheckUpdateProgress(): Promise<number>;

  XSNotification(title: string, content: string, timeout: number, opacity: number, image?: string): Promise<void>;
  OVRTNotification(
    hudNotification: boolean,
    wristNotification: boolean,
    title: string,
    body: string,
    timeout: number,
    opacity: number,
    image?: string
  ): Promise<void>;
};

type HostAppApiVr = {
  Init(): Promise<void>;
  VrInit(): Promise<void>;
  ToggleSystemMonitor(enabled: boolean): Promise<void>;
  CpuUsage(): Promise<number>;
  GetVRDevices(): Promise<string[][]>;
  GetUptime(): Promise<number>;
  CurrentCulture(): Promise<string>;
  CustomVrScript(): Promise<string>;
  GetExecuteVrOverlayFunctionQueue(): Promise<[string, string][]>;
};

type HostWebApi = {
  ClearCookies(): Promise<void>;
  GetCookies(): Promise<string>;
  SetCookies(cookie: string): Promise<void>;
  Execute(options: Record<string, unknown>): Promise<{ Item1: number; Item2: string }>;
  ExecuteJson(requestJson: string): Promise<string>;
};

type HostVRCXStorage = {
  Get(key: string): Promise<string>;
  Set(key: string, value: string): Promise<void>;
  Remove(key: string): Promise<boolean>;
  GetAll(): Promise<string>;
  Flush(): Promise<void>;
  Save(): Promise<void>;
  Load(): Promise<void>;
  GetArray(key: string): Promise<unknown[]>;
  SetArray(key: string, value: unknown[]): Promise<void>;
  GetObject(key: string): Promise<object>;
  SetObject(key: string, value: object): Promise<void>;
};

type HostSQLite = {
  Execute(sql: string, args: Record<string, unknown> | Map<string, unknown> | null): Promise<unknown[][]>;
  ExecuteJson(sql: string, args: Record<string, unknown> | Map<string, unknown> | null): Promise<string>;
  ExecuteNonQuery(sql: string, args: Record<string, unknown> | Map<string, unknown> | null): Promise<number>;
  ExecuteInsert(sql: string, args: Record<string, unknown> | Map<string, unknown> | null): Promise<number>;
};

type HostLogWatcher = {
  Get(): Promise<(string | null)[][]>;
  SetDateTill(date: string): Promise<void>;
  GetLogLines(): Promise<string[]>;
  Reset(): Promise<void>;
};

type HostDiscord = {
  SetAssets(
    details: string,
    state: string,
    detailsUrl: string,
    bigIcon: string,
    bigIconText: string,
    smallIcon: string,
    smallIconText: string,
    startTime: number,
    endTime: number,
    partyId: string,
    partySize: number,
    partyMaxSize: number,
    buttonText: string,
    buttonUrl: string,
    appId: string,
    activityType: number,
    statusDisplayType: number
  ): Promise<void>;
  SetActive(active: boolean): Promise<boolean>;
};

type HostAssetBundleManager = {
  SweepCache(): Promise<string>;
  GetCacheSize(): Promise<number>;
  GetVRChatCacheFullLocation(fileId: string, fileVersion: number, variant: string, variantVersion: number): Promise<string>;
  CheckVRChatCache(fileId: string, fileVersion: number, variant: string, variantVersion: number): Promise<{ Item1: number; Item2: boolean; Item3: string }>;
  DeleteCache(fileId: string, fileVersion: number, variant: string, variantVersion: number): Promise<void>;
  DeleteAllCache(): Promise<void>;
};

type HostWebApiService = {
  clearCookies(): Promise<void>;
  getCookies(): Promise<string>;
  setCookies(cookie: string): Promise<void>;
  execute(options: {
    url: string;
    method?: string;
    uploadFilePUT?: boolean;
    fileData?: string;
    fileMIME?: string;
    fileMD5?: string;
    headers?: Record<string, string>;
    data?: unknown;
  }): Promise<{ status: number; data: string }>;
};

type HostInteropApi = {
  callDotNetMethod: (className: string, methodName: string, args: unknown[]) => Promise<unknown>;
};

type HostElectron = {
  getArch: () => Promise<string>;
  getClipboardText: () => Promise<string>;
  getNoUpdater: () => Promise<boolean>;
  setTrayIconNotification: (notify: boolean) => Promise<void>;
  setThemeSource: (source: "system" | "light" | "dark") => Promise<void>;
  onSystemThemeChanged: (listener: (event: import("electron").IpcRendererEvent, isDark: boolean) => void) => () => void;
  openFileDialog: () => Promise<string>;
  openDirectoryDialog: () => Promise<string>;
  desktopNotification: (displayName: string, body?: string, image?: string) => Promise<void>;
  onWindowPositionChanged: (listener: (event: import("electron").IpcRendererEvent, position: { x: number; y: number }) => void) => () => void;
  onWindowSizeChanged: (listener: (event: import("electron").IpcRendererEvent, size: { width: number; height: number }) => void) => () => void;
  onWindowStateChange: (listener: (event: import("electron").IpcRendererEvent, state: "0" | "1" | "2") => void) => () => void;
  onBrowserFocus: (listener: (event: import("electron").IpcRendererEvent) => void) => () => void;
  onBrowserBlur: (listener: (event: import("electron").IpcRendererEvent) => void) => () => void;
  restartApp: () => Promise<void>;
  getOverlayWindow: () => Promise<boolean>;
  updateVr: (active: boolean, hmdOverlay: boolean, wristOverlay: boolean, menuButton: boolean, overlayHand: number) => Promise<void>;
  ipcRenderer: {
    on(channel: string, func: (...args: unknown[]) => void): (() => void) | undefined;
  };
};

declare global {
  const VERSION: string;
  const isBuildNightly: boolean;

  const isHostWindows: boolean;
  const isHostLinux: boolean;

  var $pinia: Record<string, import("pinia").StoreGeneric>;
  var $coordinators: Record<string, unknown>;
  var $bridge: {
    updateIsGameRunning: (typeof import("../coordinators/game-coordinator"))["runUpdateIsGameRunningFlow"];
    updateIsHmdAfk: (typeof import("../coordinators/game-coordinator"))["runUpdateIsHmdAfkFlow"];
    addGameLogEvent: (typeof import("../coordinators/game-log-coordinator"))["addGameLogEvent"];
  };
  var $vr: Record<string, unknown> | undefined;
  var $debug: AppDebug;
  var AppApi: HostAppApi;
  var AppApiVr: HostAppApiVr;
  var AppApiVrElectron: HostAppApiVr;
  var WebApi: HostWebApi;
  var VRCXStorage: HostVRCXStorage;
  var SQLite: HostSQLite;
  var LogWatcher: HostLogWatcher;
  var Discord: HostDiscord;
  var AssetBundleManager: HostAssetBundleManager;
  var webApiService: HostWebApiService;
  var request: Record<string, unknown>;
  var utils: Record<string, unknown>;
  var dayjs: (typeof import("dayjs"))["default"];
  var configRepository: (typeof import("../services/config.ts"))["configRepository"];
  var database: (typeof import("../services/database"))["database"];
  var gameLogService: (typeof import("../services/game-log.ts"))["gameLogService"];
  var sqliteService: (typeof import("../services/sqlite.ts"))["sqliteService"];
  var isVrOverlay: boolean;
  var interopApi: HostInteropApi;
  var electron: HostElectron;

  const CefSharp: {
    PostMessage: (message: unknown) => void;
    BindObjectAsync: (...args: string[]) => Promise<void>;
    BindObject: (name: string) => void;
    ExecuteScriptAsync: (script: string) => Promise<unknown>;
    ExecuteScript: (script: string) => unknown;
    RemoveObjectFromCache?: (name: string) => void;
    DeleteBoundObject?: (name: string) => void;
  };
}

export {};
