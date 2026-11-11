import { reactive, ref, watch } from "vue";
import { defineStore } from "pinia";
import { toast } from "vue-sonner";
import { useI18n } from "vue-i18n";

import type { CreateInstanceRequestRegion, GroupAccessType, InstanceType } from "vrchat";
import type { ParsedLocation, VrcxInstance, VrcxUser, VrcxCreateInstanceRequest } from "../types/vrcx";
import type {
  CreateInstanceDialogOptions,
  CurrentInstanceWorld,
  GroupDialogView,
  GroupInstanceEntry,
  GroupInstanceInput,
  InstanceEntry,
  InstanceRoom,
  InstanceUserEntry,
  NamedRefTarget,
  PlayerRef,
  PreviousInstancesTableState,
  PreviousInstancesVariant,
  QueuedInstance,
  RoomLocation,
  UserRefTarget,
  WorldDialogView,
} from "./instance-types";
import { checkVRChatCache, getBundleDateSize } from "../coordinators/cache-coordinator";
import { compareByDisplayName, compareById, compareByLocationAt } from "../shared/utils/compare";
import { computeDisabledContentSettings, createDefaultInstanceRef, toInstanceRecord, type InstanceJsonInput } from "../shared/utils/instance-transforms";
import { debounce } from "../shared/utils/common";
import { displayLocation, parseLocation } from "../shared/utils/location-parser";
import { evictMapCache } from "../shared/utils/cache-utils";
import { formatFileSize } from "../shared/utils/base/format";
import { getAvailablePlatforms } from "../shared/utils/platform-utils";
import { getGroupName, hasGroupPermission } from "../shared/utils/group";
import { getWorldName } from "../shared/utils/world";
import { isRealInstance } from "../shared/utils/instance";
import { replaceBioSymbols } from "../shared/utils/base/string";
import { instanceRequest } from "../api/instance";
import { queryRequest } from "../api/query-request";
import { userRequest } from "../api/user";
import { worldRequest } from "../api/world";
import { accessTypeLocaleKeyMap } from "../shared/constants/access-type";
import { instanceContentSettings } from "../shared/constants/instance";
import { database } from "../services/database";
import { resolveRef } from "../shared/utils/resolve-ref";
import { useAppearanceSettingsStore } from "./settings/appearance";
import { useFriendStore } from "./friend";
import { useGroupStore } from "./group";
import { useLocationStore } from "./location";
import { useNotificationStore } from "./notification";
import { usePhotonStore } from "./photon";
import { useSharedFeedStore } from "./shared-feed";
import { useUiStore } from "./ui";
import { useUserStore } from "./user";
import { useWorldStore } from "./world";
import { watchState } from "../services/watch-state";

import { configRepository } from "../services/config";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isSlimInstance(value: unknown): value is { instanceId: string; n_users: number } {
  return isRecord(value) && typeof value["instanceId"] === "string" && typeof value["n_users"] === "number";
}

function isInstanceRef(value: unknown): value is Partial<VrcxInstance> {
  return isRecord(value);
}

function isVrcxUser(value: unknown): value is VrcxUser {
  return isRecord(value);
}

function isPhotonMember(value: unknown): value is { id?: string; displayName?: string } {
  return isRecord(value);
}

function isPhotonJointime(value: unknown): value is { inVRMode: boolean | null; groupOnNameplate: string; canModerateInstance: boolean } {
  return isRecord(value);
}

function isPhotonTimeout(value: unknown): value is { userId?: string; displayName?: string; time: number } {
  return isRecord(value);
}

function textOf(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function joinTimeOrNow(storedJoinTime: number | undefined): number {
  if (storedJoinTime) {
    return storedJoinTime;
  }
  return Date.now();
}

function groupAccessTypeOf(value: string): GroupAccessType | undefined {
  if (value === "members" || value === "plus" || value === "public") {
    return value;
  }
  return undefined;
}

function localeKeyOf(accessType: string): string | undefined {
  const entry = Object.entries(accessTypeLocaleKeyMap).find(([name]) => name === accessType);
  return entry?.[1];
}

function toUserRefTarget(source: Record<string, unknown>): UserRefTarget {
  return { id: textOf(source["id"]), displayName: textOf(source["displayName"]) };
}

function toNamedRefTarget(source: Record<string, unknown>): NamedRefTarget {
  return { id: textOf(source["id"]), name: textOf(source["name"]) };
}

function friendRefOf(friend: unknown): VrcxUser | undefined {
  const ref: unknown = isRecord(friend) ? friend["ref"] : undefined;
  return isVrcxUser(ref) ? ref : undefined;
}

function friendLocationTagOf(friend: unknown): string | undefined {
  const location: unknown = isRecord(friend) ? friend["$location"] : undefined;
  if (!isRecord(location)) {
    return undefined;
  }
  const tag = location["tag"];
  return typeof tag === "string" ? tag : undefined;
}

function newEmptyRoom(id: string, tag: string, shortName: string, ref: InstanceRoom["ref"]): InstanceRoom {
  return {
    id,
    tag,
    $location: {},
    friendCount: 0,
    users: [],
    shortName,
    ref,
  };
}

function userCountOf(room: InstanceRoom): number {
  return room.ref.userCount ?? Number.NaN;
}

export const useInstanceStore = defineStore("Instance", () => {
  const locationStore = useLocationStore();
  const worldStore = useWorldStore();
  const friendStore = useFriendStore();
  const appearanceSettingsStore = useAppearanceSettingsStore();
  const groupStore = useGroupStore();
  const notificationStore = useNotificationStore();
  const uiStore = useUiStore();
  const userStore = useUserStore();
  const sharedFeedStore = useSharedFeedStore();
  const photonStore = usePhotonStore();
  const { t } = useI18n();

  const state = reactive<{
    updatePlayerListTimer: ReturnType<typeof setTimeout> | null;
    updatePlayerListPending: boolean;
  }>({
    updatePlayerListTimer: null,
    updatePlayerListPending: false,
  });

  const cachedInstances = new Map<string, InstanceEntry>();

  function userDialogLocationTag(): string | undefined {
    const dialogRef: { $location?: { tag?: string } } = userStore.userDialog.ref;
    return dialogRef.$location?.tag;
  }

  function groupInstancesView(): GroupInstanceEntry[] {
    const entries: GroupInstanceEntry[] = groupStore.groupInstances;
    return entries;
  }

  function cachedWorldNameOf(worldId: string): unknown {
    const world: unknown = worldStore.cachedWorlds.get(worldId);
    return isRecord(world) ? world["name"] : undefined;
  }

  function cachedGroupOf(groupId: string | null): { name: string; iconUrl: string | undefined } | undefined {
    const group: unknown = groupId === null ? undefined : groupStore.cachedGroups.get(groupId);
    if (!isRecord(group)) {
      return undefined;
    }
    const iconUrl = group["iconUrl"];
    return { name: textOf(group["name"]), iconUrl: typeof iconUrl === "string" ? iconUrl : undefined };
  }

  function cachedUserOf(id: string): VrcxUser | undefined {
    const user: unknown = userStore.cachedUsers.get(id);
    return isVrcxUser(user) ? user : undefined;
  }

  function friendEntries(): unknown[] {
    const entries: unknown[] = [];
    for (const friend of friendStore.friends.values()) {
      entries.push(friend);
    }
    return entries;
  }

  function friendRefs(): (VrcxUser | undefined)[] {
    return friendEntries().map(friendRefOf);
  }

  function cleanInstanceCache() {
    const friendLocationTags = new Set(
      friendEntries()
        .map(friendLocationTagOf)
        .filter((tag): tag is string => Boolean(tag))
    );
    evictMapCache(cachedInstances, 200, (_value, key) => friendLocationTags.has(key), {
      sortFn: (a, b) => (Date.parse(a.value.$fetchedAt) || 0) - (Date.parse(b.value.$fetchedAt) || 0),
      logLabel: "Instance cache cleanup",
    });
  }

  const lastInstanceApplied = ref("");

  const instanceCategories = ref<{ deleted: boolean; iconUrl: string; id: string; name: string; order: number }[]>([]);
  const instanceVibes = ref<{ deleted: boolean; id: string; title: string }[]>([]);

  async function loadInstanceCategoriesAndVibes() {
    if (instanceCategories.value.length === 0) {
      try {
        const args = await instanceRequest.getInstanceCategories();
        instanceCategories.value = (Array.isArray(args.json) ? args.json : []).filter((category) => !category.deleted).sort((a, b) => a.order - b.order);
      } catch (err) {
        console.error(err);
      }
    }
    if (instanceVibes.value.length === 0) {
      try {
        const args = await instanceRequest.getInstanceVibes();
        instanceVibes.value = (Array.isArray(args.json) ? args.json : []).filter((vibe) => !vibe.deleted);
      } catch (err) {
        console.error(err);
      }
    }
  }

  function emptyCurrentInstanceWorld(): CurrentInstanceWorld {
    return {
      ref: {},
      instance: {},
      isPC: false,
      isQuest: false,
      isIos: false,
      avatarScalingDisabled: false,
      focusViewDisabled: false,
      inCache: false,
      cacheSize: "",
      fileAnalysis: {},
    };
  }

  const currentInstanceWorld = ref<CurrentInstanceWorld>(emptyCurrentInstanceWorld());

  const currentInstanceLocation = ref<Partial<ParsedLocation>>({});

  const queuedInstances = reactive(new Map<string, QueuedInstance>());

  const previousInstancesInfoDialog = ref({
    instanceId: "",
    lastId: "",
    visible: false,
  });

  const previousInstancesListDialog = ref<{
    visible: boolean;
    variant: PreviousInstancesVariant;
    userRef: UserRefTarget;
    worldRef: NamedRefTarget;
    groupRef: NamedRefTarget;
    lastId: string;
  }>({
    visible: false,
    variant: "user",
    userRef: {
      id: "",
      displayName: "",
    },
    worldRef: {
      id: "",
      name: "",
    },
    groupRef: {
      id: "",
      name: "",
    },
    lastId: "",
  });

  const previousInstancesInfoState = ref<PreviousInstancesTableState>({
    sortBy: [{ id: "created_at", desc: true }],
    search: "",
    pageSize: 10,
    pageIndex: 0,
  });

  const previousInstancesListState = ref<Record<PreviousInstancesVariant, PreviousInstancesTableState>>({
    user: {
      sortBy: [{ id: "created_at", desc: true }],
      search: "",
      pageSize: 10,
      pageIndex: 0,
    },
    world: {
      sortBy: [{ id: "created_at", desc: true }],
      search: "",
      pageSize: 10,
      pageIndex: 0,
    },
    group: {
      sortBy: [{ id: "created_at", desc: true }],
      search: "",
      pageSize: 10,
      pageIndex: 0,
    },
  });

  const instanceJoinHistory = reactive(new Map<string, number>());

  const currentInstanceUsersData = ref<InstanceUserEntry[]>([]);

  watch(
    () => watchState.isLoggedIn,
    (isLoggedIn) => {
      currentInstanceUsersData.value = [];
      instanceJoinHistory.clear();
      hidePreviousInstancesDialogs();
      cachedInstances.clear();
      queuedInstances.clear();
      if (isLoggedIn) {
        void getInstanceJoinHistory().catch((error: unknown) => {
          console.error("Error loading instance join history:", error);
        });
      }
    },
    { flush: "sync" }
  );

  async function getInstanceJoinHistory() {
    try {
      const data: unknown = await database.getInstanceJoinHistory();
      instanceJoinHistory.clear();
      if (data instanceof Map) {
        for (const [key, value] of new Map<unknown, unknown>(data)) {
          if (typeof key === "string" && typeof value === "number") {
            instanceJoinHistory.set(key, value);
          }
        }
      }
    } catch (error) {
      console.error("Failed to get instance join history:", error);
    }
  }

  function addInstanceJoinHistory(location: string, dateTime: string) {
    if (!location || !dateTime) {
      return;
    }

    if (instanceJoinHistory.has(location)) {
      instanceJoinHistory.delete(location);
    }

    const epoch = new Date(dateTime).getTime();
    instanceJoinHistory.set(location, epoch);
  }

  function hidePreviousInstancesDialogs() {
    previousInstancesInfoDialog.value.visible = false;
    previousInstancesListDialog.value.visible = false;
  }

  function setPreviousInstancesInfoDialogVisible(isVisible: boolean) {
    previousInstancesInfoDialog.value.visible = isVisible;
  }

  function setPreviousInstancesListDialogVisible(isVisible: boolean) {
    previousInstancesListDialog.value.visible = isVisible;
  }

  function resolveUserRef(input: unknown) {
    return resolveRef(input, {
      emptyDefault: { id: "", displayName: "" },
      idAlias: "userId",
      nameKey: "displayName",
      fetchFn: (id) => queryRequest.fetch("user.dialog", { userId: id }),
    });
  }

  function resolveWorldRef(input: unknown) {
    return resolveRef(input, {
      emptyDefault: { id: "", name: "" },
      idAlias: "worldId",
      nameKey: "name",
      fetchFn: (id) => queryRequest.fetch("world.location", { worldId: id }),
    });
  }

  function resolveGroupRef(input: unknown) {
    return resolveRef(input, {
      emptyDefault: { id: "", name: "" },
      idAlias: "groupId",
      nameKey: "name",
      fetchFn: (id) => queryRequest.fetch("group.dialog", { groupId: id }),
    });
  }

  function translateAccessType(accessTypeNameRaw: string) {
    const key = localeKeyOf(accessTypeNameRaw);
    if (!key) {
      return accessTypeNameRaw;
    }
    if (accessTypeNameRaw === "groupPublic" || accessTypeNameRaw === "groupPlus") {
      const groupKey = accessTypeLocaleKeyMap.group;
      return `${t(groupKey)} ${t(key)}`;
    }
    return t(key);
  }

  function formatPreviousInstancesInfoLabel(instanceId: string, worldNameOverride = "") {
    const location = parseLocation(instanceId);
    const worldId = location.worldId;
    const worldName = worldNameOverride || (worldId ? textOf(cachedWorldNameOf(worldId)) : "");
    const baseLabel = worldName || worldId || instanceId || "";
    const accessTypeLabel = translateAccessType(location.accessTypeName || "");
    if (!accessTypeLabel || !location.instanceId) {
      return baseLabel;
    }
    return `${baseLabel} · ${accessTypeLabel}`;
  }

  function showPreviousInstancesInfoDialog(instanceId: string) {
    previousInstancesInfoDialog.value.visible = true;
    previousInstancesInfoDialog.value.instanceId = instanceId;
    uiStore.openDialog({
      type: "previous-instances-info",
      id: instanceId || "",
      label: instanceId ? formatPreviousInstancesInfoLabel(instanceId) : "",
    });
    if (instanceId) {
      const location = parseLocation(instanceId);
      if (location.worldId && !cachedWorldNameOf(location.worldId)) {
        queryRequest
          .fetch("world.dialog", { worldId: location.worldId })
          .then((args) => {
            uiStore.setDialogCrumbLabel("previous-instances-info", instanceId, formatPreviousInstancesInfoLabel(instanceId, args.ref.name || ""));
          })
          .catch((error: unknown) => {
            console.error("Error fetching world name for previous instances:", error);
          });
      }
    }
  }

  async function showPreviousInstancesListDialog(variant: PreviousInstancesVariant, targetRef: unknown) {
    previousInstancesListDialog.value.variant = variant;
    let resolved: Record<string, unknown>;
    if (variant === "user") {
      resolved = await resolveUserRef(targetRef);
      previousInstancesListDialog.value.userRef = toUserRefTarget(resolved);
    } else if (variant === "world") {
      resolved = await resolveWorldRef(targetRef);
      previousInstancesListDialog.value.worldRef = toNamedRefTarget(resolved);
    } else {
      resolved = await resolveGroupRef(targetRef);
      previousInstancesListDialog.value.groupRef = toNamedRefTarget(resolved);
    }
    previousInstancesListDialog.value.visible = true;
    const dialogId = textOf(resolved["id"]);
    const label = dialogId ? (variant === "user" ? textOf(resolved["displayName"]) || dialogId : textOf(resolved["name"]) || dialogId) : "";
    uiStore.openDialog({
      type: `previous-instances-${variant}`,
      id: dialogId,
      label,
    });
  }

  function updateCurrentInstanceWorld() {
    let L: ParsedLocation;
    let instanceId = locationStore.lastLocation.location;
    if (locationStore.lastLocation.location === "traveling") {
      instanceId = locationStore.lastLocationDestination;
    }
    if (!instanceId) {
      currentInstanceWorld.value = emptyCurrentInstanceWorld();
      currentInstanceLocation.value = {};
    } else if (instanceId !== currentInstanceLocation.value.tag) {
      currentInstanceWorld.value = emptyCurrentInstanceWorld();
      L = parseLocation(instanceId);
      currentInstanceLocation.value = L;
      worldRequest
        .getWorld({
          worldId: L.worldId,
        })
        .then((args) => {
          const worldRef = args.ref;
          currentInstanceWorld.value.ref = worldRef;
          const { isPC, isQuest, isIos } = getAvailablePlatforms(worldRef.unityPackages);
          currentInstanceWorld.value.isPC = isPC;
          currentInstanceWorld.value.isQuest = isQuest;
          currentInstanceWorld.value.isIos = isIos;
          currentInstanceWorld.value.avatarScalingDisabled = worldRef.tags.includes("feature_avatar_scaling_disabled");
          currentInstanceWorld.value.focusViewDisabled = worldRef.tags.includes("feature_focus_view_disabled");
          checkVRChatCache(worldRef)
            .then((cacheInfo) => {
              if (cacheInfo.Item1 > 0) {
                currentInstanceWorld.value.inCache = true;
                currentInstanceWorld.value.cacheSize = formatFileSize(cacheInfo.Item1);
              }
            })
            .catch((error: unknown) => {
              console.error("Error checking VRChat cache:", error);
            });
          void getBundleDateSize(worldRef).catch((error: unknown) => {
            console.error("Error getting bundle date size:", error);
          });
          return args;
        })
        .catch((error: unknown) => {
          console.error("Error fetching world data:", error);
        });
    } else if (typeof currentInstanceLocation.value.worldId === "string") {
      void queryRequest
        .fetch("world.location", {
          worldId: currentInstanceLocation.value.worldId,
        })
        .then((args) => {
          currentInstanceWorld.value.ref = args.ref;
          const { isPC, isQuest, isIos } = getAvailablePlatforms(args.ref.unityPackages);
          currentInstanceWorld.value.isPC = isPC;
          currentInstanceWorld.value.isQuest = isQuest;
          currentInstanceWorld.value.isIos = isIos;
          void checkVRChatCache(args.ref)
            .then((cacheInfo) => {
              if (cacheInfo.Item1 > 0) {
                currentInstanceWorld.value.inCache = true;
                currentInstanceWorld.value.cacheSize = formatFileSize(cacheInfo.Item1);
              }
            })
            .catch((error: unknown) => {
              console.error("Error checking VRChat cache:", error);
            });
        })
        .catch((error: unknown) => {
          console.error("Error fetching world data:", error);
        });
    }
    if (isRealInstance(instanceId)) {
      const ref = cachedInstances.get(instanceId);
      if (typeof ref !== "undefined") {
        currentInstanceWorld.value.instance = ref;
      } else {
        L = parseLocation(instanceId);
        if (L.isRealInstance) {
          instanceRequest
            .getInstance({
              worldId: L.worldId,
              instanceId: L.instanceId,
            })
            .then((args) => {
              currentInstanceWorld.value.instance = isInstanceRef(args.ref) ? args.ref : {};
            })
            .catch((error: unknown) => {
              console.error("Error fetching instance data:", error);
            });
        }
      }
    }
  }

  function applyInstance(input: InstanceJsonInput | null | undefined): InstanceEntry | null {
    if (!input?.id) {
      return null;
    }
    if (input.$fetchedAt === undefined || input.$fetchedAt === "") {
      input.$fetchedAt = new Date().toJSON();
    }
    const json = toInstanceRecord(input);
    let ref = cachedInstances.get(input.id);
    if (typeof ref === "undefined") {
      const created = createDefaultInstanceRef(json);
      ref = { ...created, $location: parseLocation(created.location) };
      cachedInstances.set(ref.id, ref);
      cleanInstanceCache();
    } else {
      Object.assign(ref, json);
    }
    ref.$location = parseLocation(ref.location);
    const entry = ref;
    if (ref.world.id) {
      void queryRequest
        .fetch("world.location", {
          worldId: ref.world.id,
        })
        .then((args) => {
          entry.world = args.ref;
          return args;
        })
        .catch((error: unknown) => {
          console.error("Error fetching world location:", error);
        });
    }
    if (ref.world.name) {
      ref.world.name = replaceBioSymbols(ref.world.name);
    }
    if (ref.world.description) {
      ref.world.description = replaceBioSymbols(ref.world.description);
    }
    ref.$disabledContentSettings = computeDisabledContentSettings(json.contentSettings, instanceContentSettings);
    if (ref.displayName) {
      ref.displayName = replaceBioSymbols(ref.displayName);
    }
    if (ref.description) {
      ref.description = replaceBioSymbols(ref.description);
    }
    if (userStore.userDialog.visible && userDialogLocationTag() === ref.id) {
      userStore.applyUserDialogLocation();
    }
    if (worldStore.worldDialog.visible && worldStore.worldDialog.id === ref.worldId) {
      applyWorldDialogInstances();
    }
    if (groupStore.groupDialog.visible && groupStore.groupDialog.id === ref.ownerId) {
      applyGroupDialogInstances();
    }
    for (const groupInstance of groupInstancesView()) {
      if (groupInstance.instance.id === ref.id) {
        groupInstance.instance = ref;
      }
    }
    lastInstanceApplied.value = ref.id;
    return ref;
  }

  async function getInstanceName(location: string) {
    let instanceName: string | null | undefined = "";

    const L = parseLocation(location);
    if (L.isRealInstance && L.worldId && L.instanceId) {
      try {
        const args = await instanceRequest.getInstance({
          worldId: L.worldId,
          instanceId: L.instanceId,
        });
        const ref = args.ref;
        if (ref === null) {
          throw new Error(`Instance record missing for ${location}`);
        }
        instanceName = ref.displayName;
      } catch (e) {
        console.error("getInstanceName failed location", location, e);
      }
    }

    return instanceName;
  }

  async function createNewInstance(worldId = "", options?: CreateInstanceDialogOptions) {
    const D: CreateInstanceDialogOptions = options ?? {
      loading: false,
      accessType: await configRepository.getString("instanceDialogAccessType", "public"),
      region: await configRepository.getString("instanceRegion", "US West"),
      worldId,
      groupId: await configRepository.getString("instanceDialogGroupId", ""),
      groupAccessType: await configRepository.getString("instanceDialogGroupAccessType", "plus"),
      ageGate: await configRepository.getBool("instanceDialogAgeGate", false),
      queueEnabled: await configRepository.getBool("instanceDialogQueueEnabled", true),
      roleIds: [],
      groupRef: {},
    };

    let type: InstanceType = "public";
    let canRequestInvite = false;
    switch (D.accessType) {
      case "friends":
        type = "friends";
        break;
      case "friends+":
        type = "hidden";
        break;
      case "invite":
        type = "private";
        break;
      case "invite+":
        type = "private";
        canRequestInvite = true;
        break;
      case "group":
        type = "group";
        break;
    }
    let region: CreateInstanceRequestRegion = "us";
    if (D.region === "US East") {
      region = "use";
    } else if (D.region === "Europe") {
      region = "eu";
    } else if (D.region === "Japan") {
      region = "jp";
    }
    const params: VrcxCreateInstanceRequest = {
      type,
      canRequestInvite,
      worldId: D.worldId,
      ownerId: userStore.currentUser.id,
      region,
    };
    if (type === "group") {
      const groupAccessType = groupAccessTypeOf(D.groupAccessType);
      if (groupAccessType) {
        params.groupAccessType = groupAccessType;
      }
      params.ownerId = D.groupId;
      params.queueEnabled = D.queueEnabled;
      if (D.groupAccessType === "members") {
        params.roleIds = D.roleIds;
      }
    }
    if (D.minimumAvatarPerformance) {
      params.minimumAvatarPerformance = D.minimumAvatarPerformance;
    }
    const canAgeGate =
      type === "group" ? hasGroupPermission(D.groupRef, "group-instance-age-gated-create") : userStore.currentUser.ageVerificationStatus === "18+";
    if (D.ageGate && canAgeGate) {
      params.ageGate = true;
    }
    if (D.displayName) {
      params.displayName = D.displayName;
    }
    if (D.description) {
      params.description = D.description;
    }
    if (D.languages?.length) {
      params.languages = D.languages;
    }
    if (D.categoryId) {
      params.categoryId = D.categoryId;
    }
    if (D.vibeIds?.length) {
      params.vibeIds = D.vibeIds;
    }
    try {
      const args = await instanceRequest.createInstance(params);
      return args;
    } catch (err) {
      console.error(err);
      return null;
    }
  }

  function applyWorldDialogInstances() {
    debounce(applyWorldDialogInstancesDebounced, 100)();
  }

  function applyWorldDialogInstancesDebounced() {
    const D: WorldDialogView = worldStore.worldDialog;
    if (!D.visible) {
      return;
    }
    const instances = new Map<string, InstanceRoom>();
    if (D.ref.slimInstances) {
      for (const instance of D.ref.slimInstances) {
        if (!isSlimInstance(instance)) {
          continue;
        }
        const { instanceId } = instance;
        instances.set(instanceId, {
          id: instanceId,
          tag: `${D.id}:${instanceId}`,
          $location: {},
          friendCount: 0,
          users: [],
          shortName: "",
          ref: {
            userCount: instance.n_users,
            capacity: D.ref.capacity,
          },
        });
      }
    }
    const instanceId = D.$location.instanceId;
    const shortName = D.$location.shortName ?? "";
    if (instanceId && typeof instances.get(instanceId) === "undefined") {
      instances.set(instanceId, newEmptyRoom(instanceId, `${D.id}:${instanceId}`, shortName, {}));
    }
    const cachedCurrentUser = cachedUserOf(userStore.currentUser.id);
    const lastLocation$ = cachedCurrentUser?.$location;
    const playersInInstance = locationStore.lastLocation.playerList;
    if (lastLocation$?.worldId === D.id && playersInInstance.size > 0) {
      const friendsInInstance = locationStore.lastLocation.friendList;
      const instance = newEmptyRoom(lastLocation$.instanceId ?? "", lastLocation$.tag ?? "", "", {});
      instance.friendCount = friendsInInstance.size;
      instances.set(instance.id, instance);
      for (const friend of friendsInInstance.values()) {
        const isMissingUser = !instance.users.some(function (user) {
          return friend.userId === user.id;
        });
        if (isMissingUser) {
          const ref = cachedUserOf(friend.userId);
          if (typeof ref !== "undefined") {
            instance.users.push(ref);
          }
        }
      }
    }
    for (const ref of friendRefs()) {
      if (
        ref?.$location.worldId !== D.id ||
        (ref.$location.instanceId === lastLocation$?.instanceId && playersInInstance.size > 0 && ref.location !== "traveling")
      ) {
        continue;
      }
      if (ref.location === locationStore.lastLocation.location) {
        continue;
      }
      const friendInstanceId = ref.$location.instanceId ?? "";
      let instance = instances.get(friendInstanceId);
      if (typeof instance === "undefined") {
        instance = newEmptyRoom(friendInstanceId, `${D.id}:${friendInstanceId}`, "", {});
        instances.set(friendInstanceId, instance);
      }
      instance.users.push(ref);
    }
    const currentRef = cachedUserOf(userStore.currentUser.id);
    if (currentRef?.$location.worldId === D.id) {
      const currentInstanceId = currentRef.$location.instanceId ?? "";
      let instance = instances.get(currentInstanceId);
      if (typeof instance === "undefined") {
        instance = newEmptyRoom(currentInstanceId, `${D.id}:${currentInstanceId}`, "", {});
        instances.set(currentInstanceId, instance);
      }
      instance.users.push(currentRef);
    }
    const rooms: InstanceRoom[] = [];
    for (const instance of instances.values()) {
      const L: RoomLocation = { ...parseLocation(`${D.id}:${instance.id}`), user: {} };
      instance.location = L.tag;
      if (!L.shortName) {
        L.shortName = instance.shortName;
      }
      instance.$location = L;
      const cachedOwnerId = cachedInstances.get(L.tag)?.ownerId;
      if (!L.userId && cachedOwnerId && !cachedOwnerId.startsWith("grp_")) {
        L.userId = cachedOwnerId;
      }
      if (L.userId) {
        const ref = cachedUserOf(L.userId);
        if (typeof ref === "undefined") {
          void userRequest
            .getUser({
              userId: L.userId,
            })
            .then((args) => {
              if (args.ref.id === L.userId) {
                Object.assign(L.user, args.ref);
                instance.$location = L;
                applyWorldDialogInstances();
              }
            })
            .catch((error: unknown) => {
              console.error("Error fetching user for instance:", error);
            });
        } else {
          L.user = ref;
        }
      }
      if (instance.friendCount === 0) {
        instance.friendCount = instance.users.length;
      }
      if (appearanceSettingsStore.instanceUsersSortAlphabetical) {
        instance.users.sort(compareByDisplayName);
      } else {
        instance.users.sort(compareByLocationAt);
      }
      rooms.push(instance);
    }

    for (const room of rooms) {
      const ref = cachedInstances.get(room.tag);
      if (typeof ref !== "undefined") {
        Object.assign(room.ref, ref);
      }
    }
    rooms.sort(function (a, b) {
      if (b.location === D.$location.tag || b.location === lastLocation$?.tag) {
        if (a.location === D.$location.tag) {
          return -1;
        }
        return 1;
      }
      if (a.location === D.$location.tag || a.location === lastLocation$?.tag) {
        if (b.location === D.$location.tag) {
          return 1;
        }
        return -1;
      }

      if (a.users.length === 0 && b.users.length === 0 && a.ref.userCount !== b.ref.userCount) {
        if (userCountOf(a) < userCountOf(b)) {
          return 1;
        }
        return -1;
      }

      if (a.users.length !== b.users.length) {
        if (a.users.length < b.users.length) {
          return 1;
        }
        return -1;
      }

      return compareById(a, b);
    });
    D.rooms = rooms;
  }

  function applyGroupDialogInstances(inputInstances?: GroupInstanceInput[]) {
    const D: GroupDialogView = groupStore.groupDialog;
    if (!D.visible) {
      return;
    }
    const instances = new Map<string, InstanceRoom>();
    for (const instance of D.instances) {
      instances.set(instance.tag, {
        ...instance,
        friendCount: 0,
        users: [],
      });
    }
    if (typeof inputInstances !== "undefined") {
      for (const instance of inputInstances) {
        instances.set(instance.location, {
          id: instance.instanceId,
          tag: instance.location,
          $location: {},
          friendCount: 0,
          users: [],
          shortName: instance.shortName ?? "",
          ref: instance,
        });
      }
    }
    const cachedCurrentUser = cachedUserOf(userStore.currentUser.id);
    const lastLocation$ = cachedCurrentUser?.$location;
    const currentLocation = lastLocation$?.tag;
    const playersInInstance = locationStore.lastLocation.playerList;
    if (lastLocation$?.groupId === D.id && playersInInstance.size > 0) {
      const friendsInInstance = locationStore.lastLocation.friendList;
      const instance = newEmptyRoom(lastLocation$.instanceId ?? "", currentLocation ?? "", "", {});
      instance.friendCount = friendsInInstance.size;
      instances.set(currentLocation ?? "", instance);
      for (const friend of friendsInInstance.values()) {
        const isMissingUser = !instance.users.some(function (user) {
          return friend.userId === user.id;
        });
        if (isMissingUser) {
          const ref = cachedUserOf(friend.userId);
          if (typeof ref !== "undefined") {
            instance.users.push(ref);
          }
        }
      }
    }
    for (const ref of friendRefs()) {
      if (
        ref?.$location.groupId !== D.id ||
        (ref.$location.instanceId === lastLocation$?.instanceId && playersInInstance.size > 0 && ref.location !== "traveling")
      ) {
        continue;
      }
      if (ref.location === locationStore.lastLocation.location) {
        continue;
      }
      const tag = ref.$location.tag ?? "";
      let instance = instances.get(tag);
      if (typeof instance === "undefined") {
        instance = newEmptyRoom(ref.$location.instanceId ?? "", tag, "", {});
        instances.set(tag, instance);
      }
      instance.users.push(ref);
    }
    const currentRef = cachedUserOf(userStore.currentUser.id);
    if (currentRef?.$location.groupId === D.id) {
      const tag = currentRef.$location.tag ?? "";
      let instance = instances.get(tag);
      if (typeof instance === "undefined") {
        instance = newEmptyRoom(currentRef.$location.instanceId ?? "", tag, "", {});
        instances.set(tag, instance);
      }
      instance.users.push(currentRef);
    }
    const rooms: InstanceRoom[] = [];
    for (const instance of instances.values()) {
      const L = parseLocation(instance.tag);
      instance.location = instance.tag;
      instance.$location = L;
      if (instance.friendCount === 0) {
        instance.friendCount = instance.users.length;
      }
      if (appearanceSettingsStore.instanceUsersSortAlphabetical) {
        instance.users.sort(compareByDisplayName);
      } else {
        instance.users.sort(compareByLocationAt);
      }
      rooms.push(instance);
    }

    for (const room of rooms) {
      const ref = cachedInstances.get(room.tag);
      if (typeof ref !== "undefined") {
        Object.assign(room.ref, ref);
      } else if (isRealInstance(room.tag)) {
        void instanceRequest
          .getInstance({
            worldId: room.$location.worldId ?? "",
            instanceId: room.$location.instanceId ?? "",
          })
          .catch((error: unknown) => {
            console.error("Error fetching instance for room:", error);
          });
      }
    }
    rooms.sort(function (a, b) {
      if (b.location === currentLocation) {
        return 1;
      }
      if (a.location === currentLocation) {
        return -1;
      }

      if (a.users.length === 0 && b.users.length === 0) {
        if (userCountOf(a) < userCountOf(b)) {
          return 1;
        }
        return -1;
      }

      if (a.users.length < b.users.length) {
        return 1;
      }
      return -1;
    });
    D.instances = rooms;
  }

  function removeAllQueuedInstances() {
    queuedInstances.forEach((ref) => {
      toast.info(`Removed instance ${ref.$worldName} from queue`);
      toast.dismiss(ref.$msgBox ?? undefined);
    });
    queuedInstances.clear();
  }

  function removeQueuedInstance(instanceId: string) {
    const ref = queuedInstances.get(instanceId);
    if (typeof ref !== "undefined") {
      toast.dismiss(ref.$msgBox ?? undefined);
      queuedInstances.delete(instanceId);
    }
  }

  function applyQueuedInstance(instanceId: string) {
    queuedInstances.forEach((ref) => {
      if (ref.location !== instanceId) {
        toast.info(
          t("message.instance.removed_form_queue", {
            worldName: ref.$worldName,
          })
        );
        toast.dismiss(ref.$msgBox ?? undefined);
        queuedInstances.delete(ref.location);
      }
    });
    if (!instanceId) {
      return;
    }
    if (!queuedInstances.has(instanceId)) {
      const L = parseLocation(instanceId);
      if (L.isRealInstance) {
        instanceRequest
          .getInstance({
            worldId: L.worldId,
            instanceId: L.instanceId,
          })
          .then((args) => {
            const queueSize = args.json.queueSize;
            if (queueSize) {
              void instanceQueueUpdate(instanceId, queueSize, queueSize).catch((error: unknown) => {
                console.error("Error updating instance queue:", error);
              });
            }
          })
          .catch((error: unknown) => {
            console.error("Error fetching instance data for queue:", error);
          });
      }
      void instanceQueueUpdate(instanceId, 0, 0).catch((error: unknown) => {
        console.error("Error updating instance queue:", error);
      });
    }
  }

  function instanceQueueReady(instanceId: string) {
    const ref = queuedInstances.get(instanceId);
    if (typeof ref !== "undefined") {
      toast.dismiss(ref.$msgBox ?? undefined);
      queuedInstances.delete(instanceId);
    }
    const L = parseLocation(instanceId);
    const group = cachedGroupOf(L.groupId);
    const groupName = group?.name ?? "";
    const worldName = ref?.$worldName ?? "";
    const location = displayLocation(instanceId, worldName, groupName);
    toast.success(`Instance ready to join ${location}`);
    const noty = {
      created_at: new Date().toJSON(),
      type: "group.queueReady",
      ...(group?.iconUrl === undefined ? {} : { imageUrl: group.iconUrl }),
      message: `Instance ready to join ${location}`,
      location: instanceId,
      ...(L.groupId ? { senderUserId: L.groupId } : {}),
      groupName,
      worldName,
    };
    if (notificationStore.notificationTable.filters[0].value.length === 0 || notificationStore.notificationTable.filters[0].value.includes(noty.type)) {
      uiStore.notifyMenu("notification");
    }
    notificationStore.queueNotificationNoty(noty);
    void sharedFeedStore.addEntry(noty).catch((error: unknown) => {
      console.error("Error adding shared feed entry:", error);
    });
    const notificationRows: unknown[] = notificationStore.notificationTable.data;
    notificationRows.push(noty);
  }

  async function instanceQueueUpdate(instanceId: string, position: number, queueSize: number) {
    let ref = queuedInstances.get(instanceId);
    if (typeof ref === "undefined") {
      ref = {
        $msgBox: null,
        $groupName: "",
        $worldName: "",
        location: instanceId,
        position: 0,
        queueSize: 0,
        updatedAt: 0,
      };
    }
    ref.position = position;
    ref.queueSize = queueSize;
    ref.updatedAt = Date.now();
    if (!ref.$groupName) {
      ref.$groupName = await getGroupName(instanceId);
    }
    if (!ref.$worldName) {
      ref.$worldName = await getWorldName(instanceId);
    }
    const location = displayLocation(instanceId, ref.$worldName, ref.$groupName);
    toast.dismiss(ref.$msgBox ?? undefined);
    ref.$msgBox = toast.info(`You are in position ${ref.position} of ${ref.queueSize} in the queue for ${location} `, {
      duration: Infinity,
      position: "bottom-right",
      closeButton: true,
      class: "vrc-instance-queue-message",
    });
    queuedInstances.set(instanceId, ref);
  }

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
    state,

    cachedInstances,
    lastInstanceApplied,
    currentInstanceWorld,
    currentInstanceLocation,
    queuedInstances,
    previousInstancesInfoDialog,
    previousInstancesInfoState,
    previousInstancesListDialog,
    previousInstancesListState,
    instanceJoinHistory,
    currentInstanceUsersData,
    instanceCategories,
    instanceVibes,

    applyInstance,
    loadInstanceCategoriesAndVibes,
    updateCurrentInstanceWorld,
    createNewInstance,
    applyWorldDialogInstances,
    applyGroupDialogInstances,
    removeAllQueuedInstances,
    removeQueuedInstance,
    applyQueuedInstance,
    instanceQueueReady,
    instanceQueueUpdate,
    hidePreviousInstancesDialogs,
    setPreviousInstancesInfoDialogVisible,
    setPreviousInstancesListDialogVisible,
    showPreviousInstancesInfoDialog,
    showPreviousInstancesListDialog,
    addInstanceJoinHistory,
    getCurrentInstanceUserList,
    getInstanceJoinHistory,
    getInstanceName,
  };
});
