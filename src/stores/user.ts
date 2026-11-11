import { computed, reactive, ref, shallowReactive, watch } from "vue";
import { defineStore } from "pinia";
import { useI18n } from "vue-i18n";
import { compareByCreatedAt, compareByName, compareByUpdatedAt } from "../shared/utils/compare";
import { getAllUserMemos } from "../coordinators/memo-coordinator";
import { userRequest } from "../api/user";
import { cosmeticsRequest } from "../api/cosmetics";
import { marketplaceRequest } from "../api/marketplace";
import { AppDebug } from "../services/app-config";
import { processBulk } from "../services/request";
import { useAppearanceSettingsStore } from "./settings/appearance";
import { useFriendStore } from "./friend";
import { useInstanceStore } from "./instance";
import { useLocationStore } from "./location";
import { useModalStore } from "./modal";
import { useUiStore } from "./ui";
import { watchState } from "../services/watch-state";
import type { Json, VrcxUser } from "../types/vrcx";
import type { ContentFilter, OrderOptionShort, PublicProfile, SortOptionProductPurchase } from "vrchat";
import { applyUserDialogLocation } from "./user-dialog-location";
import { checkNote as checkNoteWithDeps, initUserNotes as initUserNotesWithDeps } from "./user-notes";
import type { UserNotesDeps } from "./user-notes";
import {
  type CachedCosmetic,
  type CachedProductPurchase,
  type ClientConfigState,
  type LanguageEntry,
  type CurrentUserState,
  type CustomUserTag,
  type EditProfileDialogState,
  type UserDialogState,
  type UserStoreNotesState,
} from "./user-state";
import { createCurrentUserState, createEditProfileDialogState, createUserDialogState } from "./user-state-factories";
import { applyPresenceLocation } from "./user-presence-location";
import { logUserStoreError } from "./user-store-error-log";

function isConfirmResult(value: unknown): value is { ok: boolean } {
  return typeof value === "object" && value !== null && "ok" in value && typeof value.ok === "boolean";
}

function valueOrFallback(value: string | undefined, fallback: string) {
  return value === undefined || value === "" ? fallback : value;
}

export const useUserStore = defineStore("User", () => {
  const appearanceSettingsStore = useAppearanceSettingsStore();
  const friendStore = useFriendStore();
  const locationStore = useLocationStore();
  const instanceStore = useInstanceStore();
  const modalStore = useModalStore();
  const uiStore = useUiStore();
  const { t } = useI18n();

  const currentUser = ref<CurrentUserState>(createCurrentUserState());

  const currentUserCredits = ref<number | null>(null);

  const userDialog = ref<UserDialogState>(createUserDialogState());

  const editProfileDialog = ref<EditProfileDialogState>(createEditProfileDialogState());

  const currentTravelers = reactive(new Map<string, VrcxUser>());
  const subsetOfLanguages = ref<Record<string, string>>({});
  const sendBoopDialog = ref({
    visible: false,
    userId: "",
  });
  const showUserDialogHistory = reactive(new Set<string>());
  const customUserTags = reactive(new Map<string, CustomUserTag>());

  const state = reactive<UserStoreNotesState>({
    instancePlayerCount: new Map<string, number>(),
    lastNoteCheck: null,
    lastDbNoteDate: null,
    notes: new Map<string, string>(),
  });

  const cachedUsers = shallowReactive(new Map<string, VrcxUser>());
  const cachedProfiles = ref(new Map<string, Json<PublicProfile>>());
  const cachedUserIdsByDisplayName = shallowReactive(new Map<string, Set<string>>());

  const cachedProfileEffects = shallowReactive(new Map<string, CachedCosmetic>());
  const cachedIconFrames = shallowReactive(new Map<string, CachedCosmetic>());
  const cachedNameplateEffects = shallowReactive(new Map<string, CachedCosmetic>());

  const cachedPurchases = ref(new Map<string, CachedProductPurchase>());
  const activePurchases = computed(() =>
    Array.from(cachedPurchases.value.values()).filter((purchase) => purchase.purchaseActive && purchase.buyerId === currentUser.value.id)
  );
  const ownedListingIds = computed(() => new Set(activePurchases.value.map((purchase) => purchase.listingId)));
  const ownedProductIds = computed(() => new Set(activePurchases.value.flatMap((purchase) => purchase.products.map((product) => product.id))));

  const currentUserClientConfig = ref<ClientConfigState>({
    accessReduceDecorAnim: false,
    configString: "",
  });

  const notesDeps: UserNotesDeps = {
    state,
    cachedUsers,
    friends: friendStore.friends,
  };

  function addCachedUserDisplayNameEntry(displayName: string, userId: string) {
    if (!displayName || !userId) {
      return;
    }
    let userIds = cachedUserIdsByDisplayName.get(displayName);
    if (!userIds) {
      userIds = new Set();
      cachedUserIdsByDisplayName.set(displayName, userIds);
    }
    userIds.add(userId);
  }

  function removeCachedUserDisplayNameEntry(displayName: string, userId: string) {
    if (!displayName || !userId) {
      return;
    }
    const userIds = cachedUserIdsByDisplayName.get(displayName);
    if (!userIds) {
      return;
    }
    userIds.delete(userId);
    if (userIds.size === 0) {
      cachedUserIdsByDisplayName.delete(displayName);
    }
  }

  function syncCachedUserDisplayName(user: VrcxUser, previousDisplayName = "") {
    if (!user.id) {
      return;
    }
    if (previousDisplayName && previousDisplayName !== user.displayName) {
      removeCachedUserDisplayNameEntry(previousDisplayName, user.id);
    }
    addCachedUserDisplayNameEntry(user.displayName, user.id);
  }

  function setCachedUser(user: VrcxUser, previousDisplayName = "", { skipIndex = false } = {}) {
    if (!user.id) {
      return;
    }
    cachedUsers.set(user.id, user);
    if (!skipIndex) {
      syncCachedUserDisplayName(user, previousDisplayName);
    }
  }

  function deleteCachedUser(userId: string) {
    const user = cachedUsers.get(userId);
    if (!user) {
      return false;
    }
    removeCachedUserDisplayNameEntry(user.displayName, userId);
    return cachedUsers.delete(userId);
  }

  function deleteCachedProfile(userId: string) {
    if (!cachedProfiles.value.has(userId)) {
      return false;
    }
    return cachedProfiles.value.delete(userId);
  }

  function clearCachedUsers() {
    cachedUsers.clear();
    cachedProfiles.value.clear();
    cachedUserIdsByDisplayName.clear();
    cachedPurchases.value.clear();
  }

  function setCachedPurchases(purchases: CachedProductPurchase[]) {
    for (const purchase of purchases) {
      cachedPurchases.value.set(purchase.purchaseId, purchase);
    }
  }

  async function getAllProductPurchases() {
    const order: OrderOptionShort = "desc";
    const sort: SortOptionProductPurchase = "purchaseDate";
    await processBulk({
      fn: (params) => marketplaceRequest.getProductPurchases(params),
      N: 0,
      params: {
        buyerId: currentUser.value.id,
        order,
        sort,
        n: 50,
        offset: 0,
      },
    });
  }

  function rebuildCachedUserDisplayNameIndex() {
    cachedUserIdsByDisplayName.clear();
    for (const user of cachedUsers.values()) {
      addCachedUserDisplayNameEntry(user.displayName, user.id);
    }
  }

  const isLocalUserVrcPlusSupporter = computed(() => currentUser.value.$isVRCPlus || AppDebug.debugVrcPlus);

  watch(
    () => watchState.isLoggedIn,
    (isLoggedIn) => {
      if (!isLoggedIn) {
        currentTravelers.clear();
        showUserDialogHistory.clear();
        state.instancePlayerCount.clear();
        customUserTags.clear();
        state.notes.clear();
        subsetOfLanguages.value = {};
        uiStore.clearDialogCrumbs();
      }
    },
    { flush: "sync" }
  );

  watch(
    () => watchState.isFriendsLoaded,
    (isFriendsLoaded) => {
      if (isFriendsLoaded) {
        void getAllUserMemos().catch(logUserStoreError("Error loading user memos:"));
        void initUserNotes().catch(logUserStoreError("Error initializing user notes:"));
      }
    },
    { flush: "sync" }
  );

  function applyUserLanguage(user: { tags: string[]; $languages: LanguageEntry[] }) {
    user.$languages = [];
    const languagePrefix = "language_";
    const prefixLength = languagePrefix.length;

    for (const tag of user.tags) {
      if (tag.startsWith(languagePrefix)) {
        const key = tag.substring(prefixLength);
        const value = subsetOfLanguages.value[key];

        if (value !== undefined) {
          user.$languages.push({ key, value });
        }
      }
    }
  }

  function applyUserDialogLocationForStore(shouldUpdateInstanceOccupants = false) {
    applyUserDialogLocation(
      {
        userDialog,
        currentUser,
        cachedUsers,
        friends: friendStore.friends,
        appearanceSettingsStore,
        instanceStore,
        locationStore,
      },
      shouldUpdateInstanceOccupants
    );
  }

  function getUserDialogAvatarComparator() {
    const { avatarSorting } = userDialog.value;
    if (avatarSorting === "update") {
      return compareByUpdatedAt;
    }
    if (avatarSorting === "createdAt") {
      return compareByCreatedAt;
    }
    return compareByName;
  }

  function sortUserDialogAvatars(array: UserDialogState["avatars"]) {
    userDialog.value.avatars = array.sort(getUserDialogAvatarComparator());
  }

  function sortUserDialogLicensedAvatars(array: UserDialogState["licensedAvatars"]) {
    userDialog.value.licensedAvatars = array.sort(getUserDialogAvatarComparator());
  }

  function initUserNotes() {
    return initUserNotesWithDeps(notesDeps);
  }

  function checkNote(userId: string, newNote: string | undefined) {
    return checkNoteWithDeps(notesDeps, userId, newNote);
  }

  function showSendBoopDialog(userId: string) {
    sendBoopDialog.value.userId = userId;
    sendBoopDialog.value.visible = true;
  }

  function setUserDialogMemo(value: string) {
    userDialog.value.memo = value;
  }

  function setUserDialogVisible(isVisible: boolean) {
    userDialog.value.visible = isVisible;
  }

  function setUserDialogIsFavorite(isFavorite: boolean) {
    userDialog.value.isFavorite = isFavorite;
  }

  function setCurrentUserColour(value: string) {
    currentUser.value.$userColour = value;
  }

  function setCurrentUserLocationState(location: string, travelingToLocation: string, timestamp = Date.now()) {
    currentUser.value.$location_at = timestamp;
    currentUser.value.$travelingToTime = timestamp;
    currentUser.value.$locationTag = location;
    currentUser.value.$travelingToLocation = travelingToLocation;
  }

  function setCurrentUserTravelingToTime(value: number) {
    currentUser.value.$travelingToTime = value;
  }

  function setCurrentUser(value: CurrentUserState) {
    currentUser.value = value;
  }

  function setCurrentUserCredits(value: number | null) {
    currentUserCredits.value = value;
  }

  function setSubsetOfLanguages(value: Record<string, string>) {
    subsetOfLanguages.value = value;
  }

  function showEditProfileDialog() {
    const D = editProfileDialog.value;
    const statusHistory = currentUser.value.statusHistory;
    const statusHistoryArray = [];
    for (let i = 0; i < statusHistory.length; ++i) {
      statusHistoryArray.push({
        no: i + 1,
        status: statusHistory[i] ?? "",
      });
    }
    D.socialStatusHistoryTable = statusHistoryArray;

    D.status = currentUser.value.status;
    D.statusDescription = currentUser.value.statusDescription;
    D.pronouns = currentUser.value.pronouns;
    D.bannerColor = currentUser.value.bannerColor;
    D.bannerUrl = currentUser.value.bannerUrl;
    D.bannerType = currentUser.value.bannerType;
    D.iconUrl = currentUser.value.iconUrl;

    D.themeId = "";
    D.themes = [];
    D.themeName = "";
    D.themeButtonColor = "";
    D.themeIconColor = "";
    D.themeSubtextColor = "";

    void userRequest
      .getSelfProfile()
      .then((args) => {
        const profile = args.json;
        D.selfProfileRef = profile;

        const themes = profile.themes ?? [];
        D.status = profile.status ?? "";
        D.statusDescription = profile.statusDescription ?? "";
        D.pronouns = profile.pronouns ?? "";
        D.bio = profile.bio ?? "";
        D.bioLinks = (profile.bioLinks ?? []).slice();
        D.bannerColor = profile.bannerColor ?? "";
        D.bannerUrl = profile.bannerUrl ?? "";
        D.bannerType = valueOrFallback(profile.bannerType, "color");
        D.userIcon = profile.userIcon ?? "";

        D.themes = themes;
        D.themeId = profile.themeId ?? "";
        const selectedTheme = themes.find((theme) => theme.id === profile.themeId);
        D.themeName = selectedTheme?.name ?? "";
        D.themeButtonColor = profile.themeButtonColor ?? "";
        D.themeIconColor = profile.themeIconColor ?? "";
        D.themeSubtextColor = profile.themeSubtextColor ?? "";
        D.backgroundType = valueOrFallback(profile.backgroundType, "default");
        D.backgroundTextureId = profile.backgroundTextureId ?? "";
        D.backgroundGradientBottom = profile.backgroundGradientBottom ?? "";
        D.backgroundGradientTop = profile.backgroundGradientTop ?? "";
        D.nameplateEffect = profile.nameplateEffect ?? "";
        D.profileEffect = profile.profileEffect ?? "";
        D.iconFrame = profile.iconFrame ?? "";
      })
      .catch(logUserStoreError("Error loading self profile:"));

    D.visible = true;
  }

  function markCurrentUserGameStarted() {
    currentUser.value.$online_for = Date.now();
    currentUser.value.$offline_for = null;
    currentUser.value.$previousAvatarSwapTime = Date.now();
  }

  function markCurrentUserGameStopped() {
    currentUser.value.$online_for = 0;
    currentUser.value.$offline_for = Date.now();
    currentUser.value.$previousAvatarSwapTime = null;
  }

  async function confirmCurrentUserToggle(command: string, isEnableAction: boolean) {
    const action = isEnableAction ? t("confirm.enable_action") : t("confirm.disable_action");
    const result = await modalStore.confirm({
      title: t("confirm.title"),
      description: t("confirm.command_question_toggle", {
        action,
        command,
      }),
    });
    if (!isConfirmResult(result)) {
      return false;
    }
    return result.ok;
  }

  async function toggleAvatarCopying() {
    if (!(await confirmCurrentUserToggle(t("dialog.user.info.avatar_cloning"), !currentUser.value.allowAvatarCopying))) {
      return;
    }
    await userRequest.saveCurrentUser({
      allowAvatarCopying: !currentUser.value.allowAvatarCopying,
    });
  }

  async function toggleAllowBooping() {
    if (!(await confirmCurrentUserToggle(t("dialog.user.info.booping"), !currentUser.value.isBoopingEnabled))) {
      return;
    }
    await userRequest.saveCurrentUser({
      isBoopingEnabled: !currentUser.value.isBoopingEnabled,
    });
  }

  async function toggleSharedConnectionsOptOut() {
    if (!(await confirmCurrentUserToggle(t("dialog.user.info.show_mutual_friends"), currentUser.value.hasSharedConnectionsOptOut))) {
      return;
    }
    await userRequest.saveCurrentUser({
      hasSharedConnectionsOptOut: !currentUser.value.hasSharedConnectionsOptOut,
    });
  }

  async function toggleDiscordFriendsOptOut() {
    if (!(await confirmCurrentUserToggle(t("dialog.user.info.show_discord_connections"), currentUser.value.hasDiscordFriendsOptOut))) {
      return;
    }
    await userRequest.saveCurrentUser({
      hasDiscordFriendsOptOut: !currentUser.value.hasDiscordFriendsOptOut,
    });
  }

  async function toggleReducedProfileAnimations() {
    const isAccessReduceDecorAnim = !currentUserClientConfig.value.accessReduceDecorAnim;
    if (!(await confirmCurrentUserToggle(t("dialog.user.info.reduced_profile_animations"), isAccessReduceDecorAnim))) {
      return;
    }
    const { json } = await userRequest.saveClientConfig({ accessReduceDecorAnim: isAccessReduceDecorAnim });
    currentUserClientConfig.value = json;
  }

  function getClientConfig() {
    void userRequest
      .getClientConfig()
      .then(({ json }) => {
        currentUserClientConfig.value = json;
      })
      .catch(logUserStoreError("Error loading client config:"));
  }

  function changePassword(currentPassword: string, password: string) {
    return userRequest.saveCurrentUser({
      currentPassword,
      password,
    });
  }

  function changeContentFilterSettings(contentFilters: ContentFilter[]) {
    return userRequest.saveCurrentUser({
      contentFilters,
    });
  }

  watch(
    () => watchState.isLoggedIn,
    (isLoggedIn) => {
      if (isLoggedIn) {
        getCosmetics();
        getClientConfig();
        void getAllProductPurchases().catch(logUserStoreError("Error loading product purchases:"));
      }
    },
    { flush: "sync" }
  );

  function getCosmetics() {
    void cosmeticsRequest
      .getProfileEffects()
      .then(({ json }) => {
        json.forEach((effect) => {
          cachedProfileEffects.set(effect.id, effect);
        });
      })
      .catch(logUserStoreError("Error loading profile effects:"));
    void cosmeticsRequest
      .getIconFrames()
      .then(({ json }) => {
        json.forEach((frame) => {
          cachedIconFrames.set(frame.id, frame);
        });
      })
      .catch(logUserStoreError("Error loading icon frames:"));
    void cosmeticsRequest
      .getNameplateEffects()
      .then(({ json }) => {
        json.forEach((effect) => {
          cachedNameplateEffects.set(effect.id, effect);
        });
      })
      .catch(logUserStoreError("Error loading nameplate effects:"));
  }

  return {
    state,

    currentUser,
    currentUserCredits,
    currentTravelers,
    userDialog,
    editProfileDialog,
    subsetOfLanguages,
    sendBoopDialog,
    showUserDialogHistory,
    customUserTags,
    cachedUsers,
    cachedProfiles,
    cachedUserIdsByDisplayName,
    isLocalUserVrcPlusSupporter,
    cachedProfileEffects,
    cachedIconFrames,
    cachedNameplateEffects,
    cachedPurchases,
    ownedListingIds,
    ownedProductIds,
    currentUserClientConfig,
    applyUserLanguage,
    applyPresenceLocation,
    applyUserDialogLocation: applyUserDialogLocationForStore,
    setCachedUser,
    setCachedPurchases,
    getAllProductPurchases,
    syncCachedUserDisplayName,
    deleteCachedUser,
    deleteCachedProfile,
    clearCachedUsers,
    rebuildCachedUserDisplayNameIndex,
    sortUserDialogAvatars,
    sortUserDialogLicensedAvatars,
    initUserNotes,
    showSendBoopDialog,
    showEditProfileDialog,
    setUserDialogMemo,
    setUserDialogVisible,
    setUserDialogIsFavorite,
    setCurrentUserColour,
    setCurrentUserLocationState,
    setCurrentUserTravelingToTime,
    setCurrentUser,
    setSubsetOfLanguages,
    setCurrentUserCredits,
    markCurrentUserGameStarted,
    markCurrentUserGameStopped,
    checkNote,
    toggleSharedConnectionsOptOut,
    toggleDiscordFriendsOptOut,
    toggleAllowBooping,
    toggleReducedProfileAnimations,
    toggleAvatarCopying,
    changePassword,
    changeContentFilterSettings,
    getCosmetics,
  };
});
