import { ref, watch } from "vue";
import type { Ref } from "vue";
import { storeToRefs } from "pinia";
import type { GroupRole } from "vrchat";

import { buildLegacyInstanceTag, getLaunchURL, isRealInstance } from "../../../shared/utils/instance";
import { parseLocation } from "../../../shared/utils/location-parser";
import { useGroupStore } from "../../../stores/group";
import type { Json, VrcxGroup } from "../../../types/vrcx";
import { useInstanceStore } from "../../../stores/instance";
import { useUserStore } from "../../../stores/user";
import { groupRequest } from "../../../api/group";
import { handleGroupPermissions } from "../../../coordinators/group-membership-coordinator";
import { logFailure } from "../../../stores/log-failure";

import { configRepository } from "../../../services/config";

const logSettingLoadFailure = logFailure("Loading the new instance dialog settings failed:");
const logSettingSaveFailure = logFailure("Saving the new instance dialog settings failed:");

export type NewInstanceDialogState = {
  visible: boolean;
  loading: boolean;
  selectedTab: string;
  instanceCreated: boolean;
  queueEnabled: boolean;
  worldId: string;
  instanceId: string;
  instanceName: string;
  userId: string;
  legacyUserId: string;
  accessType: string;
  region: string;
  groupRegion: string;
  groupId: string;
  groupAccessType: string;
  ageGate: boolean;
  strict: boolean;
  location: string;
  shortName: string;
  displayName: string;
  url: string;
  secureOrShortName: string;
  lastSelectedGroupId: string;
  selectedGroupRoles: Json<GroupRole>[];
  roleIds: string[];
  groupRef: Partial<VrcxGroup>;
  minimumAvatarPerformance: string;
  description: string;
  languages: string[];
  categoryId: string;
  vibeIds: string[];
};

function toStringList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

export function useNewInstanceBuilder(locationTagRef: Ref<string>) {
  const { cachedGroups } = useGroupStore();
  const { currentUser } = storeToRefs(useUserStore());
  const instanceStore = useInstanceStore();
  const { createNewInstance, loadInstanceCategoriesAndVibes } = instanceStore;
  const { instanceCategories, instanceVibes } = storeToRefs(instanceStore);

  const newInstanceDialog = ref<NewInstanceDialogState>({
    visible: false,
    loading: false,

    selectedTab: "Normal",
    instanceCreated: false,
    queueEnabled: false,
    worldId: "",
    instanceId: "",
    instanceName: "",
    userId: "",
    legacyUserId: "",
    accessType: "public",
    region: "US West",
    groupRegion: "",
    groupId: "",
    groupAccessType: "plus",
    ageGate: false,
    strict: false,
    location: "",
    shortName: "",
    displayName: "",
    url: "",
    secureOrShortName: "",
    lastSelectedGroupId: "",
    selectedGroupRoles: [],
    roleIds: [],
    groupRef: {},
    minimumAvatarPerformance: "",
    description: "",
    languages: [],
    categoryId: "",
    vibeIds: [],
  });

  function initializeNewInstanceDialog() {
    configRepository
      .getBool("instanceDialogQueueEnabled", true)
      .then((isEnabled) => (newInstanceDialog.value.queueEnabled = isEnabled))
      .catch(logSettingLoadFailure);

    configRepository
      .getString("instanceDialogInstanceName", "")
      .then((value) => (newInstanceDialog.value.instanceName = value))
      .catch(logSettingLoadFailure);

    configRepository
      .getString("instanceDialogUserId", "")
      .then((value) => (newInstanceDialog.value.legacyUserId = value))
      .catch(logSettingLoadFailure);

    configRepository
      .getString("instanceDialogAccessType", "public")
      .then((value) => (newInstanceDialog.value.accessType = value))
      .catch(logSettingLoadFailure);

    configRepository
      .getString("instanceRegion", "US West")
      .then((value) => (newInstanceDialog.value.region = value))
      .catch(logSettingLoadFailure);

    configRepository
      .getString("instanceDialogGroupId", "")
      .then((value) => (newInstanceDialog.value.groupId = value))
      .catch(logSettingLoadFailure);

    configRepository
      .getString("instanceDialogGroupAccessType", "plus")
      .then((value) => (newInstanceDialog.value.groupAccessType = value))
      .catch(logSettingLoadFailure);

    configRepository
      .getBool("instanceDialogAgeGate", false)
      .then((isAgeGated) => (newInstanceDialog.value.ageGate = isAgeGated))
      .catch(logSettingLoadFailure);

    configRepository
      .getString("instanceDialogDisplayName", "")
      .then((value) => (newInstanceDialog.value.displayName = value))
      .catch(logSettingLoadFailure);

    configRepository
      .getString("instanceDialogMinimumAvatarPerformance", "")
      .then((value) => (newInstanceDialog.value.minimumAvatarPerformance = value))
      .catch(logSettingLoadFailure);

    configRepository
      .getString("instanceDialogDescription", "")
      .then((value) => (newInstanceDialog.value.description = value))
      .catch(logSettingLoadFailure);

    configRepository
      .getArray("instanceDialogLanguages", [])
      .then((value) => (newInstanceDialog.value.languages = toStringList(value)))
      .catch(logSettingLoadFailure);

    configRepository
      .getString("instanceDialogCategoryId", "")
      .then((value) => (newInstanceDialog.value.categoryId = value))
      .catch(logSettingLoadFailure);

    configRepository
      .getArray("instanceDialogVibeIds", [])
      .then((value) => (newInstanceDialog.value.vibeIds = toStringList(value)))
      .catch(logSettingLoadFailure);
  }
  function saveNewInstanceDialog() {
    const {
      accessType,
      region,
      instanceName,
      legacyUserId,
      groupId,
      groupAccessType,
      queueEnabled,
      ageGate,
      displayName,
      minimumAvatarPerformance,
      description,
      languages,
      categoryId,
      vibeIds,
    } = newInstanceDialog.value;

    configRepository.setString("instanceDialogAccessType", accessType).catch(logSettingSaveFailure);
    configRepository.setString("instanceRegion", region).catch(logSettingSaveFailure);
    configRepository.setString("instanceDialogInstanceName", instanceName).catch(logSettingSaveFailure);
    configRepository.setString("instanceDialogUserId", legacyUserId === currentUser.value.id ? "" : legacyUserId).catch(logSettingSaveFailure);
    configRepository.setString("instanceDialogGroupId", groupId).catch(logSettingSaveFailure);
    configRepository.setString("instanceDialogGroupAccessType", groupAccessType).catch(logSettingSaveFailure);
    configRepository.setBool("instanceDialogQueueEnabled", queueEnabled).catch(logSettingSaveFailure);
    configRepository.setBool("instanceDialogAgeGate", ageGate).catch(logSettingSaveFailure);
    configRepository.setString("instanceDialogDisplayName", displayName).catch(logSettingSaveFailure);
    configRepository.setString("instanceDialogMinimumAvatarPerformance", minimumAvatarPerformance).catch(logSettingSaveFailure);
    configRepository.setString("instanceDialogDescription", description).catch(logSettingSaveFailure);
    configRepository.setArray("instanceDialogLanguages", languages).catch(logSettingSaveFailure);
    configRepository.setString("instanceDialogCategoryId", categoryId).catch(logSettingSaveFailure);
    configRepository.setArray("instanceDialogVibeIds", vibeIds).catch(logSettingSaveFailure);
  }

  function refreshGroupRoles(dialog: NewInstanceDialogState) {
    if (dialog.groupId && dialog.groupId !== dialog.lastSelectedGroupId) {
      dialog.roleIds = [];
      const ref = cachedGroups.get(dialog.groupId);
      if (typeof ref !== "undefined") {
        dialog.groupRef = ref;
        dialog.selectedGroupRoles = ref.roles ?? [];
        void groupRequest
          .getGroupRoles({
            groupId: dialog.groupId,
          })
          .then((args) => {
            dialog.lastSelectedGroupId = dialog.groupId;
            dialog.selectedGroupRoles = args.json;
            ref.roles = args.json;
          })
          .catch(logFailure("Loading the group roles failed:"));
      }
    }
    if (!dialog.groupId) {
      dialog.roleIds = [];
      dialog.groupRef = {};
      dialog.selectedGroupRoles = [];
      dialog.lastSelectedGroupId = "";
    }
  }

  function updateNewInstanceDialog(shouldKeepShortName = false) {
    const D = newInstanceDialog.value;
    if (D.instanceId) {
      D.location = `${D.worldId}:${D.instanceId}`;
    } else {
      D.location = D.worldId;
    }
    const L = parseLocation(D.location);
    if (shouldKeepShortName) {
      L.shortName = D.shortName;
    } else {
      D.shortName = "";
    }
    D.url = getLaunchURL(L);
  }
  function buildInstance() {
    const D = newInstanceDialog.value;
    D.instanceCreated = false;
    D.instanceId = "";
    D.shortName = "";
    D.secureOrShortName = "";
    D.userId = currentUser.value.id;
    refreshGroupRoles(D);
    saveNewInstanceDialog();
  }
  function buildLegacyInstance() {
    const D = newInstanceDialog.value;
    D.instanceCreated = false;
    D.shortName = "";
    D.secureOrShortName = "";
    if (D.instanceName) {
      D.instanceName = D.instanceName.replace(/[^A-Za-z0-9]/g, "");
    }
    if (!D.legacyUserId) {
      D.legacyUserId = currentUser.value.id;
    }
    if (D.accessType !== "invite" && D.accessType !== "friends") {
      D.strict = false;
    }

    const instanceName = D.instanceName || (99999 * Math.random() + 1).toFixed(0).padStart(5, "0");

    D.instanceId = buildLegacyInstanceTag({
      instanceName,
      userId: D.legacyUserId,
      accessType: D.accessType,
      groupId: D.groupId,
      groupAccessType: D.groupAccessType,
      region: D.region,
      ageGate: D.ageGate,
      strict: D.strict,
    });

    refreshGroupRoles(D);
    updateNewInstanceDialog(false);
    saveNewInstanceDialog();
  }

  async function initNewInstanceDialog(tag: string) {
    if (!isRealInstance(tag)) {
      return;
    }
    const D = newInstanceDialog.value;
    const L = parseLocation(tag);
    if (D.worldId === L.worldId) {
      D.visible = true;
      return;
    }
    D.worldId = L.worldId;
    D.instanceCreated = false;
    D.lastSelectedGroupId = "";
    D.selectedGroupRoles = [];
    D.groupRef = {};
    D.roleIds = [];
    D.strict = false;
    D.shortName = "";
    D.secureOrShortName = "";
    void loadInstanceCategoriesAndVibes().catch(logFailure("Loading instance categories and vibes failed:"));
    const args = await groupRequest.getGroupPermissions({
      userId: currentUser.value.id,
    });
    handleGroupPermissions(args);
    buildInstance();
    buildLegacyInstance();
    updateNewInstanceDialog();
    D.visible = true;
  }
  async function handleCreateNewInstance() {
    const args = await createNewInstance(newInstanceDialog.value.worldId, newInstanceDialog.value);

    if (args) {
      newInstanceDialog.value.location = args.json.location;
      newInstanceDialog.value.instanceId = args.json.instanceId;
      let secureOrShortName = args.json.secureName;
      if (args.json.shortName) {
        secureOrShortName = args.json.shortName;
      }
      newInstanceDialog.value.secureOrShortName = secureOrShortName;
      newInstanceDialog.value.instanceCreated = true;
      updateNewInstanceDialog();
    }
  }

  function newInstanceTabClick(tabName: string | number) {
    if (tabName === "Normal") {
      buildInstance();
    } else {
      buildLegacyInstance();
    }
  }

  function handleRoleIdsChange(value: unknown) {
    const next = Array.isArray(value) ? value.filter((v): v is string => typeof v === "string" && v.length > 0) : [];
    newInstanceDialog.value.roleIds = next;
    buildInstance();
  }

  function handleLanguagesChange(value: unknown) {
    newInstanceDialog.value.languages = toStringList(value).slice(0, 3);
    buildInstance();
  }

  function handleVibeIdsChange(value: unknown) {
    newInstanceDialog.value.vibeIds = toStringList(value).slice(0, 3);
    buildInstance();
  }

  function handleCategoryIdChange(value: unknown) {
    newInstanceDialog.value.categoryId = typeof value === "string" && value !== "none" ? value : "";
    buildInstance();
  }

  watch(
    () => locationTagRef.value,
    (value) => {
      void initNewInstanceDialog(value).catch(logFailure("Preparing the new instance dialog failed:"));
    }
  );

  initializeNewInstanceDialog();

  return {
    newInstanceDialog,
    buildInstance,
    buildLegacyInstance,
    updateNewInstanceDialog,
    handleCreateNewInstance,
    newInstanceTabClick,
    handleRoleIdsChange,
    handleLanguagesChange,
    handleVibeIdsChange,
    handleCategoryIdChange,
    instanceCategories,
    instanceVibes,
  };
}
