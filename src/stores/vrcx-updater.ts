import { computed, ref } from "vue";
import { defineStore } from "pinia";
import { toast } from "vue-sonner";
import { useI18n } from "vue-i18n";

import { logWebRequest } from "../services/app-config";
import { branches } from "../shared/constants/settings";
import { getWhatsNewRelease, normalizeReleaseVersion } from "../shared/constants/whats-new-releases";
import { changeLogRemoveLinks } from "../shared/utils/base/string";

import { configRepository } from "../services/config";

import * as workerTimers from "worker-timers";

type WhatsNewItem = NonNullable<ReturnType<typeof getWhatsNewRelease>>["items"][number];

type WhatsNewDialog = {
  visible: boolean;
  titleKey: string;
  subtitleKey: string;
  items: WhatsNewItem[];
};

type GitHubAsset = {
  name: string;
  state: string;
  content_type: string;
  browser_download_url: string;
  digest?: string | null;
  size: number;
};

type GitHubRelease = {
  name: string;
  tag_name?: string | undefined;
  body: string;
  published_at: string;
  prerelease: boolean;
  assets: GitHubAsset[];
};

type VrcxUpdateDialog = {
  visible: boolean;
  updatePending: boolean;
  updatePendingIsLatest: boolean;
  release: string;
  releases: GitHubRelease[];
};

type ChangeLogDialog = {
  visible: boolean;
  buildName: string;
  changeLog: string;
};

type BranchUrls = {
  urlReleases: string;
  urlLatest: string;
};

type WebApiResponse = {
  status: number;
  data: string;
};

const branchUrls: Readonly<Record<string, BranchUrls | undefined>> = branches;

function getBranchUrls(name: string): BranchUrls {
  const urls = branchUrls[name];
  if (urls === undefined) {
    throw new Error(`Unknown VRCX update branch: ${name}`);
  }
  return urls;
}

function isUnknownArray(value: unknown): value is unknown[] {
  return Array.isArray(value);
}

function isGitHubRelease(value: unknown): value is GitHubRelease {
  return typeof value === "object" && value !== null && "name" in value && typeof value.name === "string" && "assets" in value && Array.isArray(value.assets);
}

function isLatestRelease(value: unknown): value is GitHubRelease {
  return (
    isGitHubRelease(value) &&
    value.name !== "" &&
    "published_at" in value &&
    typeof value.published_at === "string" &&
    value.published_at !== "" &&
    "body" in value &&
    typeof value.body === "string"
  );
}

function readJsonMessage(value: unknown): unknown {
  return typeof value === "object" && value !== null && "message" in value ? value.message : undefined;
}

function emptyWhatsNewDialog(): WhatsNewDialog {
  return {
    visible: false,
    titleKey: "",
    subtitleKey: "",
    items: [],
  };
}

export const useVRCXUpdaterStore = defineStore("VRCXUpdater", () => {
  const { t } = useI18n();

  const arch = ref("x64");
  const noUpdater = ref(false);
  const isMacOS = computed(() => navigator.platform.includes("Mac"));

  const appVersion = ref("");
  const autoUpdateVRCX = ref("Auto Download");
  const latestAppVersion = ref("");
  const branch = ref("Stable");
  const vrcxId = ref("");
  const checkingForVRCXUpdate = ref(false);
  const VRCXUpdateDialog = ref<VrcxUpdateDialog>({
    visible: false,
    updatePending: false,
    updatePendingIsLatest: false,
    release: "",
    releases: [],
  });
  const changeLogDialog = ref<ChangeLogDialog>({
    visible: false,
    buildName: "",
    changeLog: "",
  });
  const whatsNewDialog = ref<WhatsNewDialog>(emptyWhatsNewDialog());
  const pendingVRCXUpdate = ref(false);
  const pendingVRCXInstall = ref("");
  const updateInProgress = ref(false);
  const updateProgress = ref(0);
  const updateToastRelease = ref("");

  async function initVRCXUpdaterSettings() {
    if (isHostLinux) {
      arch.value = await window.electron.getArch();
      noUpdater.value = await window.electron.getNoUpdater();
      console.log("Architecture:", arch.value);
    }
    if (isMacOS.value) {
      noUpdater.value = true;
    }

    const [savedAutoUpdate, savedVrcxId] = await Promise.all([
      configRepository.getString("VRCX_autoUpdateVRCX", "Auto Download"),
      configRepository.getString("VRCX_id", ""),
    ]);

    if (savedAutoUpdate === "Auto Install") {
      autoUpdateVRCX.value = "Auto Download";
    } else {
      autoUpdateVRCX.value = savedAutoUpdate;
    }
    if (noUpdater.value) {
      autoUpdateVRCX.value = "Off";
    }

    appVersion.value = await AppApi.GetVersion();
    vrcxId.value = savedVrcxId;

    await initBranch();
    await loadVrcxId();

    let hasCheckedForUpdatesDuringAnnouncement = false;
    if (await shouldAnnounceCurrentVersion()) {
      const isWhatsNewShown = showWhatsNewDialog();
      if (isWhatsNewShown) {
        await markCurrentVersionAsSeen();
      } else if (isRecognizedStableReleaseVersion()) {
        const result = await showChangeLogDialog({ prefetch: true });
        hasCheckedForUpdatesDuringAnnouncement = result.checkedForUpdates;
        if (result.shown) {
          await markCurrentVersionAsSeen();
        }
      }
    } else {
      await syncCurrentVersionState();
    }
    if (autoUpdateVRCX.value !== "Off" && !hasCheckedForUpdatesDuringAnnouncement) {
      await checkForVRCXUpdate();
    }
  }

  const currentVersion = computed(() => appVersion.value.replace(" (Linux)", ""));

  async function setAutoUpdateVRCX(value: string) {
    if (value === "Off") {
      pendingVRCXUpdate.value = false;
    }
    autoUpdateVRCX.value = value;
    await configRepository.setString("VRCX_autoUpdateVRCX", value);
  }

  function setLatestAppVersion(value: string) {
    latestAppVersion.value = value;
  }

  function setBranch(value: string) {
    branch.value = value;
    configRepository.setString("VRCX_branch", value).catch((err: unknown) => console.error(err));
  }

  async function initBranch() {
    if (!appVersion.value) {
      return;
    }
    if (currentVersion.value.includes("VRCX Nightly")) {
      branch.value = "Nightly";
    } else {
      branch.value = "Stable";
    }
    await configRepository.setString("VRCX_branch", branch.value);
  }

  async function hasVersionChanged() {
    const lastVersion = await configRepository.getString("VRCX_lastVRCXVersion", "");
    return lastVersion !== currentVersion.value;
  }

  async function markCurrentVersionAsSeen() {
    await configRepository.setString("VRCX_lastVRCXVersion", currentVersion.value);
  }

  async function syncCurrentVersionState() {
    if (await hasVersionChanged()) {
      await markCurrentVersionAsSeen();
      return true;
    }
    return false;
  }

  async function shouldAnnounceCurrentVersion() {
    if (branch.value !== "Stable" || !isRecognizedStableReleaseVersion()) {
      return false;
    }
    const lastVersion = await configRepository.getString("VRCX_lastVRCXVersion", "");
    return Boolean(lastVersion) && lastVersion !== currentVersion.value;
  }

  function isRecognizedStableReleaseVersion() {
    return Boolean(normalizeReleaseVersion(currentVersion.value));
  }

  function showWhatsNewDialog() {
    const release = getWhatsNewRelease(currentVersion.value);

    if (!release) {
      whatsNewDialog.value = emptyWhatsNewDialog();
      return false;
    }

    whatsNewDialog.value = {
      visible: true,
      titleKey: release.titleKey,
      subtitleKey: release.subtitleKey,
      items: release.items.map((item) => ({ ...item })),
    };

    return true;
  }

  function closeWhatsNewDialog() {
    whatsNewDialog.value.visible = false;
  }

  async function openChangeLogDialogOnly() {
    changeLogDialog.value.visible = true;
    if (!changeLogDialog.value.buildName || !changeLogDialog.value.changeLog) {
      await checkForVRCXUpdate();
    }
  }
  async function loadVrcxId() {
    if (!vrcxId.value) {
      vrcxId.value = crypto.randomUUID();
      await configRepository.setString("VRCX_id", vrcxId.value);
    }
  }
  function getAssetOfInterest(assets: GitHubAsset[]) {
    let downloadUrl = "";
    let hashString = "";
    let size = 0;
    for (const asset of assets) {
      if (asset.state !== "uploaded") {
        continue;
      }
      if (
        isHostWindows &&
        (asset.name.endsWith("Setup_x64.exe") || asset.name.endsWith("Setup.exe")) &&
        (asset.content_type === "application/x-msdownload" || asset.content_type === "application/x-msdos-program")
      ) {
        downloadUrl = asset.browser_download_url;
        if (asset.digest?.startsWith("sha256:")) {
          hashString = asset.digest.replace("sha256:", "");
        }
        size = asset.size;
        break;
      }
      if (isHostLinux && asset.name.endsWith(`${arch.value}.AppImage`) && asset.content_type === "application/octet-stream") {
        downloadUrl = asset.browser_download_url;
        if (asset.digest?.startsWith("sha256:")) {
          hashString = asset.digest.replace("sha256:", "");
        }
        size = asset.size;
        break;
      }
    }
    return { downloadUrl, hashString, size };
  }
  async function checkForVRCXUpdate() {
    if (!currentVersion.value || currentVersion.value === "VRCX Nightly Build" || currentVersion.value === "VRCX Build") {
      return false;
    }
    if (branch.value === "Beta") {
      setBranch("Stable");
    }
    if (typeof branchUrls[branch.value] === "undefined") {
      setBranch("Stable");
    }
    const url = getBranchUrls(branch.value).urlLatest;
    checkingForVRCXUpdate.value = true;
    let response: WebApiResponse;
    let json: unknown;
    try {
      response = await webApiService.execute({
        url,
        method: "GET",
        headers: {
          "VRCX-ID": vrcxId.value,
        },
      });
      json = JSON.parse(response.data);
    } catch (error) {
      console.error("Failed to check for VRCX update", error);
      return false;
    } finally {
      checkingForVRCXUpdate.value = false;
    }
    if (response.status !== 200) {
      toast.error(
        t("message.vrcx_updater.failed", {
          message: `${response.status} ${response.data}`,
        })
      );
      return false;
    }
    pendingVRCXUpdate.value = false;
    logWebRequest("[EXTERNAL GET]", url, `(${response.status})`, json);
    if (isLatestRelease(json)) {
      changeLogDialog.value.buildName = json.name;
      changeLogDialog.value.changeLog = changeLogRemoveLinks(json.body);
      const releaseName = json.name;
      setLatestAppVersion(releaseName);
      VRCXUpdateDialog.value.updatePendingIsLatest = false;
      if (autoUpdateVRCX.value === "Off") {
        return true;
      }
      if (releaseName === pendingVRCXInstall.value) {
        VRCXUpdateDialog.value.updatePendingIsLatest = true;
      } else if (releaseName > currentVersion.value) {
        const { downloadUrl, hashString, size } = getAssetOfInterest(json.assets);
        if (!downloadUrl) {
          return true;
        }
        pendingVRCXUpdate.value = true;
        if (updateToastRelease.value !== releaseName) {
          updateToastRelease.value = releaseName;
          toast(t("nav_menu.update_available"), {
            description: releaseName,
            duration: 5000,
            action: {
              label: t("nav_menu.update"),
              onClick: () => {
                showVRCXUpdateDialog().catch((err: unknown) => console.error(err));
              },
            },
          });
        }
        if (autoUpdateVRCX.value === "Auto Download") {
          await downloadVRCXUpdate(downloadUrl, hashString, size, releaseName);
        }
      }
      return true;
    }
    return false;
  }
  async function showVRCXUpdateDialog() {
    const D = VRCXUpdateDialog.value;
    D.visible = true;
    D.updatePendingIsLatest = false;
    D.updatePending = await AppApi.CheckForUpdateExe();
    if (updateInProgress.value) {
      return;
    }
    await loadBranchVersions();
  }

  async function loadBranchVersions() {
    const D = VRCXUpdateDialog.value;
    const url = getBranchUrls(branch.value).urlReleases;
    checkingForVRCXUpdate.value = true;
    let response: WebApiResponse;
    let json: unknown;
    try {
      response = await webApiService.execute({
        url,
        method: "GET",
        headers: {
          "VRCX-ID": vrcxId.value,
        },
      });
      json = JSON.parse(response.data);
    } catch (error) {
      console.error("Failed to check for VRCX update", error);
      return;
    } finally {
      checkingForVRCXUpdate.value = false;
    }
    if (response.status !== 200) {
      toast.error(
        t("message.vrcx_updater.failed", {
          message: `${response.status} ${response.data}`,
        })
      );
      return;
    }
    logWebRequest("[EXTERNAL GET]", url, `(${response.status})`, json);
    const message = readJsonMessage(json);
    if (typeof json !== "object" || message) {
      toast.error(
        t("message.vrcx_updater.failed", {
          message,
        })
      );
      return;
    }
    if (!isUnknownArray(json)) {
      return;
    }
    const releases: GitHubRelease[] = [];
    for (const release of json) {
      if (!isGitHubRelease(release) || release.prerelease) {
        continue;
      }
      if (release.assets.some((asset) => asset.state === "uploaded")) {
        releases.push(release);
      }
    }
    D.releases = releases;
    D.release = releases[0]?.name ?? "";
    VRCXUpdateDialog.value.updatePendingIsLatest = false;
    if (D.release === pendingVRCXInstall.value) {
      VRCXUpdateDialog.value.updatePendingIsLatest = true;
    }
    setBranch(branch.value);
  }
  async function downloadVRCXUpdate(downloadUrl: string, hashString: string, size: number, releaseName: string) {
    if (updateInProgress.value) {
      return;
    }
    try {
      updateInProgress.value = true;
      await downloadFileProgress();
      await AppApi.DownloadUpdate(downloadUrl, hashString, size);
      pendingVRCXInstall.value = releaseName;
    } catch (err) {
      console.error(err);
      toast.error(`${t("message.vrcx_updater.failed_install")} ${String(err)}`);
    } finally {
      updateInProgress.value = false;
      updateProgress.value = 0;
    }
  }
  async function downloadFileProgress() {
    updateProgress.value = await AppApi.CheckUpdateProgress();
    if (updateInProgress.value) {
      workerTimers.setTimeout(() => {
        downloadFileProgress().catch((err: unknown) => console.error(err));
      }, 150);
    }
  }
  function installVRCXUpdate() {
    for (const release of VRCXUpdateDialog.value.releases) {
      if (release.name !== VRCXUpdateDialog.value.release) {
        continue;
      }
      const { downloadUrl, hashString, size } = getAssetOfInterest(release.assets);
      if (!downloadUrl) {
        return;
      }
      const releaseName = release.name;
      downloadVRCXUpdate(downloadUrl, hashString, size, releaseName).catch((err: unknown) => console.error(err));
      break;
    }
  }
  async function showChangeLogDialog(options: { prefetch?: boolean } = {}) {
    const { prefetch = false } = options;

    if (prefetch) {
      const isChangeLogReady = await ensureChangeLogReady();
      if (!isChangeLogReady) {
        return { shown: false, checkedForUpdates: true };
      }
      changeLogDialog.value.visible = true;
      return { shown: true, checkedForUpdates: true };
    }

    changeLogDialog.value.visible = true;
    void ensureChangeLogReady().catch((err: unknown) => console.error(err));
    return { shown: true, checkedForUpdates: true };
  }

  async function ensureChangeLogReady() {
    if (changeLogDialog.value.buildName && changeLogDialog.value.changeLog) {
      return true;
    }
    return checkForVRCXUpdate();
  }
  function restartVRCX(isUpgrade: boolean) {
    if (!isHostLinux) {
      AppApi.RestartApplication(isUpgrade).catch((err: unknown) => console.error(err));
    } else {
      window.electron.restartApp().catch((err: unknown) => console.error(err));
    }
  }
  function updateProgressText() {
    if (updateProgress.value === 100) {
      return t("message.vrcx_updater.checking_hash");
    }
    return `${updateProgress.value}%`;
  }
  async function cancelUpdate() {
    await AppApi.CancelUpdate();
    updateInProgress.value = false;
    updateProgress.value = 0;
  }

  initVRCXUpdaterSettings().catch((err: unknown) => console.error(err));

  return {
    appVersion,
    autoUpdateVRCX,
    latestAppVersion,
    branch,
    currentVersion,
    vrcxId,
    checkingForVRCXUpdate,
    VRCXUpdateDialog,
    changeLogDialog,
    whatsNewDialog,
    pendingVRCXUpdate,
    pendingVRCXInstall,
    updateInProgress,
    updateProgress,
    noUpdater,

    setAutoUpdateVRCX,
    setBranch,

    showWhatsNewDialog,
    closeWhatsNewDialog,
    openChangeLogDialogOnly,
    checkForVRCXUpdate,
    loadBranchVersions,
    installVRCXUpdate,
    showVRCXUpdateDialog,
    showChangeLogDialog,
    restartVRCX,
    updateProgressText,
    cancelUpdate,
  };
});
