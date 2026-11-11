import { reactive, ref, watch } from "vue";
import { defineStore } from "pinia";
import { useI18n } from "vue-i18n";

import type { ParsedLocation, VrcxUser } from "../types/vrcx";
import type {
  CurrentInstanceWorld,
  GroupInstanceEntry,
  InstanceEntry,
  InstanceUserEntry,
  NamedRefTarget,
  PreviousInstancesTableState,
  PreviousInstancesVariant,
  QueuedInstance,
  UserRefTarget,
} from "./instance-types";
import { checkVRChatCache, getBundleDateSize } from "../coordinators/cache-coordinator";
import { computeDisabledContentSettings, createDefaultInstanceRef, toInstanceRecord } from "../shared/utils/instance-transforms";
import type { InstanceJsonInput } from "../shared/utils/instance-transforms";
import { parseLocation } from "../shared/utils/location-parser";
import { evictMapCache } from "../shared/utils/cache-utils";
import { formatFileSize } from "../shared/utils/base/format";
import { getAvailablePlatforms } from "../shared/utils/platform-utils";
import { isRealInstance } from "../shared/utils/instance";
import { replaceBioSymbols } from "../shared/utils/base/string";
import { instanceRequest } from "../api/instance";
import { queryRequest } from "../api/query-request";
import { worldRequest } from "../api/world";
import { instanceContentSettings } from "../shared/constants/instance";
import { database } from "../services/database";
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
import { isRecord, isInstanceRef, isVrcxUser } from "./instance-type-guards";
import { textOf } from "./instance-value-parsers";
import { friendRefOf, friendLocationTagOf } from "./instance-room-records";
import { createInstanceQueue } from "./instance-queue";
import { createInstancePlayerList } from "./instance-player-list";
import { createPreviousInstancesDialogs } from "./instance-previous-dialogs";
import { createInstanceDialogApply } from "./instance-dialog-apply";
import { createInstanceCreate } from "./instance-create";

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

  const { removeAllQueuedInstances, removeQueuedInstance, applyQueuedInstance, instanceQueueReady, instanceQueueUpdate } = createInstanceQueue({
    notificationStore,
    uiStore,
    sharedFeedStore,
    cachedGroupOf,
    queuedInstances,
    t,
  });
  const { getCurrentInstanceUserList } = createInstancePlayerList({
    locationStore,
    userStore,
    photonStore,
    state,
    cachedUserOf,
    currentInstanceUsersData,
  });
  const {
    hidePreviousInstancesDialogs,
    setPreviousInstancesInfoDialogVisible,
    setPreviousInstancesListDialogVisible,
    showPreviousInstancesInfoDialog,
    showPreviousInstancesListDialog,
  } = createPreviousInstancesDialogs({
    uiStore,
    cachedWorldNameOf,
    previousInstancesInfoDialog,
    previousInstancesListDialog,
    t,
  });
  const { applyWorldDialogInstances, applyGroupDialogInstances } = createInstanceDialogApply({
    locationStore,
    worldStore,
    appearanceSettingsStore,
    groupStore,
    userStore,
    cachedInstances,
    cachedUserOf,
    friendRefs,
  });
  const { getInstanceName, createNewInstance } = createInstanceCreate({
    userStore,
  });

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
