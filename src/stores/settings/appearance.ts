import { computed, ref, watch } from "vue";
import { defineStore } from "pinia";
import { useI18n } from "vue-i18n";
import { useRouter } from "vue-router";

import { APP_CJK_FONT_PACK_DEFAULT_KEY } from "../../shared/constants/fonts";
import { SEARCH_LIMIT_MAX, SEARCH_LIMIT_MIN, TABLE_MAX_SIZE_MAX, TABLE_MAX_SIZE_MIN } from "../../shared/constants/settings";
import {
  applyAppCjkFontPack,
  applyAppFontFamily,
  changeAppThemeStyle,
  changeHtmlLangAttribute,
  getThemeMode,
  setSystemIsDarkMode,
  updateTrustColorClasses,
} from "../../shared/utils/base/ui";
import { createSidebarSortControls } from "./appearance-sidebar";
import { createTrustColourControls } from "./appearance-trust";
import { openTableLimitsDialog, saveTableLimits } from "./appearance-limits";
import { readAppearanceConfig, readLegacySortMethods } from "./appearance-config";
import {
  applyAccessibleStatusClass,
  applyTableDensity,
  clampInt,
  createBooleanToggle,
  DEFAULT_SIDEBAR_SORT_METHODS,
  DEFAULT_TABLE_PAGE_SIZES,
  isDarkThemeMode,
  MAX_TABLE_PAGE_SIZE,
  normalizeAppCjkFontPack,
  normalizeAppFontFamily,
  normalizeTableDensity,
  normalizeTablePageSizes,
  parseJsonValue,
  parseStringArray,
  resolveLastDarkTheme,
  saveSetting,
  TRUST_COLOR_DEFAULTS,
} from "./appearance-helpers";
import type { TableDensity, TableLimitsDialogState, TrustColors } from "./appearance-helpers";
import { configRepository } from "../../services/config";
import { loadLocalizedStrings } from "../../plugins/i18n";
import { useFeedStore } from "../feed";
import { useGameLogStore } from "../gameLog";
import { useUiStore } from "../ui";
import { useUserStore } from "../user";
import { useVrStore } from "../vr";
import { useVrcxStore } from "../vrcx";
import { watchState } from "../../services/watch-state";

export const useAppearanceSettingsStore = defineStore("AppearanceSettings", () => {
  const vrStore = useVrStore();
  const feedStore = useFeedStore();
  const gameLogStore = useGameLogStore();
  const vrcxStore = useVrcxStore();
  const userStore = useUserStore();
  const router = useRouter();
  const uiStore = useUiStore();
  const { locale } = useI18n();

  const appLanguage = ref<string>("en");
  const themeMode = ref<string>("");
  const isDarkMode = ref<boolean>(false);
  const lastDarkTheme = ref<string>("dark");
  const appFontFamily = ref<string>("inter");
  const customFontFamily = ref<string>("");
  const appCjkFontPack = ref<string>(APP_CJK_FONT_PACK_DEFAULT_KEY);
  const displayVRCProfileThemes = ref<boolean>(false);
  const displayVRCProfileBackgrounds = ref<boolean>(false);
  const profileBackgroundOpacity = ref<number>(0.5);
  const displayVRCProfileCosmetics = ref<boolean>(false);
  const hideNicknames = ref<boolean>(false);
  const showInstanceIdInLocation = ref<boolean>(false);
  const isAgeGatedInstancesVisible = ref<boolean>(false);
  const isClosedInstancesVisible = ref<boolean>(true);
  const sortFavorites = ref<boolean>(true);
  const instanceUsersSortAlphabetical = ref<boolean>(false);
  const tablePageSize = ref<number>(15);
  const tablePageSizes = ref<number[]>([...DEFAULT_TABLE_PAGE_SIZES]);
  const dtHour12 = ref<boolean>(false);
  const dtIsoFormat = ref<boolean>(false);
  const weekStartsOn = ref<number>(1);
  const sidebarSortMethod1 = ref<string>("Sort Private to Bottom");
  const sidebarSortMethod2 = ref<string>("Sort by Time in Instance");
  const sidebarSortMethod3 = ref<string>("Sort by Last Active");
  const sidebarSortMethods = ref<string[]>([...DEFAULT_SIDEBAR_SORT_METHODS]);
  const navWidth = ref<number>(240);
  const isSidebarGroupByInstance = ref<boolean>(true);
  const isHideFriendsInSameInstance = ref<boolean>(false);
  const isSameInstanceAboveFavorites = ref<boolean>(false);
  const isSidebarDivideByFriendGroup = ref<boolean>(false);
  const sidebarFavoriteGroups = ref<string[]>([]);
  const sidebarFavoriteGroupOrder = ref<string[]>([]);
  const sidebarCosmetics = ref<boolean>(false);
  const hideUserNotes = ref<boolean>(false);
  const hideUserMemos = ref<boolean>(false);
  const hideUnfriends = ref<boolean>(false);
  const randomUserColours = ref<boolean>(false);
  const tableDensity = ref<TableDensity>("standard");
  const trustColor = ref<TrustColors>({ ...TRUST_COLOR_DEFAULTS });
  const currentCulture = ref<string>("");
  const notificationIconDot = ref<boolean>(false);
  const isNavCollapsed = ref<boolean>(true);
  const isSideBarTabShow = computed(() => {
    const currentRouteName = router.currentRoute.value.name;
    return !["friend-list", "charts-instance", "charts-mutual", "charts-hot-worlds"].includes(String(currentRouteName));
  });

  const isDataTableStriped = ref<boolean>(false);
  const accessibleStatusIndicators = ref<boolean>(false);
  const showNewDashboardButton = ref<boolean>(true);
  const tableLimitsDialog = ref<TableLimitsDialogState>({
    visible: false,
    maxTableSize: 500,
    searchLimit: 5000,
  });

  const resolveNavWidth = (widthOrArray: number | number[]): number | null => {
    if (Array.isArray(widthOrArray) && widthOrArray.length > 0) {
      return widthOrArray[widthOrArray.length - 1] ?? null;
    }
    return typeof widthOrArray === "number" ? widthOrArray : null;
  };

  async function initAppearanceSettings() {
    const { initThemeMode, isDarkMode: isInitDarkMode } = await getThemeMode(configRepository);
    const fallbackDarkTheme = isDarkThemeMode(initThemeMode) ? initThemeMode : "dark";
    const [
      appLanguageConfig,
      isDisplayVRCProfileThemesConfig,
      isDisplayVRCProfileBackgroundsConfig,
      profileBackgroundOpacityConfig,
      isDisplayVRCProfileCosmeticsConfig,
      isHideNicknamesConfig,
      isShowInstanceIdInLocationConfig,
      isAgeGatedInstancesVisibleConfig,
      isClosedInstancesVisibleConfig,
      isSortFavoritesConfig,
      isInstanceUsersSortAlphabeticalConfig,
      tablePageSizeConfig,
      tablePageSizesConfig,
      isDtHour12Config,
      isDtIsoFormatConfig,
      weekStartsOnConfig,
      sidebarSortMethodsConfig,
      navWidthConfig,
      isSidebarGroupByInstanceConfig,
      isHideFriendsInSameInstanceConfig,
      isSameInstanceAboveFavoritesConfig,
      isSidebarDivideByFriendGroupConfig,
      sidebarFavoriteGroupsConfig,
      sidebarFavoriteGroupOrderConfig,
      isSidebarCosmeticsConfig,
      isHideUserNotesConfig,
      isHideUserMemosConfig,
      isHideUnfriendsConfig,
      isRandomUserColoursConfig,
      tableDensityConfig,
      isCompactTableModeConfig,
      trustColorConfig,
      isNotificationIconDotConfig,
      isNavIsCollapsedConfig,
      isDataTableStripedConfig,
      isAccessibleStatusIndicatorsConfig,
      isShowNewDashboardButtonConfig,
      appFontFamilyConfig,
      customFontFamilyConfig,
      appCjkFontPackConfig,
      lastDarkThemeConfig,
    ] = await readAppearanceConfig(fallbackDarkTheme);

    if (appLanguageConfig) {
      await changeAppLanguage(appLanguageConfig);
    } else {
      await loadLocalizedStrings("en");
      appLanguage.value = "en";
      locale.value = "en";
      changeHtmlLangAttribute("en");
    }

    themeMode.value = initThemeMode;
    isDarkMode.value = isInitDarkMode;
    lastDarkTheme.value = resolveLastDarkTheme(lastDarkThemeConfig, fallbackDarkTheme);
    const normalizedAppFontFamily = normalizeAppFontFamily(appFontFamilyConfig);
    appFontFamily.value = normalizedAppFontFamily;
    customFontFamily.value = customFontFamilyConfig;
    appCjkFontPack.value = normalizeAppCjkFontPack(appCjkFontPackConfig, APP_CJK_FONT_PACK_DEFAULT_KEY);
    applyAppFontFamily(appFontFamily.value, customFontFamily.value);
    applyAppCjkFontPack(appCjkFontPack.value);
    if (normalizedAppFontFamily !== appFontFamilyConfig) {
      saveSetting(configRepository.setString("VRCX_fontFamily", normalizedAppFontFamily));
    }

    displayVRCProfileThemes.value = isDisplayVRCProfileThemesConfig;
    displayVRCProfileBackgrounds.value = isDisplayVRCProfileBackgroundsConfig;
    profileBackgroundOpacity.value = profileBackgroundOpacityConfig;
    displayVRCProfileCosmetics.value = isDisplayVRCProfileCosmeticsConfig;
    hideNicknames.value = isHideNicknamesConfig;
    showInstanceIdInLocation.value = isShowInstanceIdInLocationConfig;
    isAgeGatedInstancesVisible.value = isAgeGatedInstancesVisibleConfig;
    isClosedInstancesVisible.value = isClosedInstancesVisibleConfig;
    sortFavorites.value = isSortFavoritesConfig;
    instanceUsersSortAlphabetical.value = isInstanceUsersSortAlphabeticalConfig;

    tablePageSizes.value = normalizeTablePageSizes(parseJsonValue(tablePageSizesConfig));

    setTablePageSize(tablePageSizeConfig);

    dtHour12.value = isDtHour12Config;
    dtIsoFormat.value = isDtIsoFormatConfig;
    weekStartsOn.value = [0, 1, 6].includes(weekStartsOnConfig) ? weekStartsOnConfig : 1;

    currentCulture.value = await AppApi.CurrentCulture();

    sidebarSortMethods.value = parseStringArray(sidebarSortMethodsConfig);
    if (sidebarSortMethods.value.length === 3) {
      const [method1, method2, method3] = sidebarSortMethods.value;
      sidebarSortMethod1.value = method1 ?? "";
      sidebarSortMethod2.value = method2 ?? "";
      sidebarSortMethod3.value = method3 ?? "";
    }

    if (trustColorConfig !== JSON.stringify(TRUST_COLOR_DEFAULTS)) {
      await configRepository.setString("VRCX_trustColor", JSON.stringify(TRUST_COLOR_DEFAULTS));
    }
    trustColor.value = { ...TRUST_COLOR_DEFAULTS };
    navWidth.value = clampInt(navWidthConfig, 64, 480);
    isSidebarGroupByInstance.value = isSidebarGroupByInstanceConfig;
    isHideFriendsInSameInstance.value = isHideFriendsInSameInstanceConfig;
    isSameInstanceAboveFavorites.value = isSameInstanceAboveFavoritesConfig;
    isSidebarDivideByFriendGroup.value = isSidebarDivideByFriendGroupConfig;
    sidebarFavoriteGroups.value = parseStringArray(sidebarFavoriteGroupsConfig);
    sidebarFavoriteGroupOrder.value = parseStringArray(sidebarFavoriteGroupOrderConfig);
    sidebarCosmetics.value = isSidebarCosmeticsConfig;
    hideUserNotes.value = isHideUserNotesConfig;
    hideUserMemos.value = isHideUserMemosConfig;
    hideUnfriends.value = isHideUnfriendsConfig;
    randomUserColours.value = isRandomUserColoursConfig;
    notificationIconDot.value = isNotificationIconDotConfig;
    const storedTableDensity = tableDensityConfig ?? "";
    tableDensity.value = normalizeTableDensity(storedTableDensity || (isCompactTableModeConfig ? "compact" : "standard"));
    applyTableDensity(tableDensity.value);
    if (!tableDensityConfig) {
      saveSetting(configRepository.setString("VRCX_tableDensity", tableDensity.value));
    }
    isNavCollapsed.value = isNavIsCollapsedConfig;
    isDataTableStriped.value = isDataTableStripedConfig;
    accessibleStatusIndicators.value = isAccessibleStatusIndicatorsConfig;
    showNewDashboardButton.value = isShowNewDashboardButtonConfig;

    applyAccessibleStatusClass(accessibleStatusIndicators.value);

    await configRepository.remove("VRCX_navWidth");

    const legacySortOrder = await readLegacySortMethods();
    if (legacySortOrder !== null) {
      if (legacySortOrder.length > 0) {
        sidebarSortMethods.value = legacySortOrder;
        sidebarSortMethod1.value = legacySortOrder[0] ?? "";
        sidebarSortMethod2.value = legacySortOrder[1] ?? "";
        sidebarSortMethod3.value = legacySortOrder[2] ?? "";
      }
      setSidebarSortMethods(legacySortOrder);
    }

    updateTrustColorClasses(trustColor.value);

    vrStore.updateVRConfigVars();
  }

  watch(
    () => watchState.isFriendsLoaded,
    (isFriendsLoaded) => {
      if (isFriendsLoaded) {
        tryInitUserColours().catch((error: unknown) => console.error(error));
      }
    },
    { flush: "sync" }
  );

  async function changeAppLanguage(language: string) {
    await setAppLanguage(language);
    vrStore.updateVRConfigVars();
  }

  async function setAppLanguage(language: string) {
    console.log("Language changed:", language);

    await loadLocalizedStrings(language);

    appLanguage.value = language;
    saveSetting(configRepository.setString("VRCX_appLanguage", language));
    locale.value = appLanguage.value;

    changeHtmlLangAttribute(language);
  }

  if (isHostLinux) {
    window.electron.onSystemThemeChanged((_event, isDark) => {
      setSystemIsDarkMode(isDark);
      if (themeMode.value === "system" && isDarkMode.value !== isDark) {
        setThemeMode(themeMode.value);
      }
    });
  } else {
    window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
      if (themeMode.value === "system") {
        setThemeMode(themeMode.value);
      }
    });
  }

  function setThemeMode(mode: string) {
    themeMode.value = mode;
    saveSetting(configRepository.setString("VRCX_ThemeMode", mode));
    if (isDarkThemeMode(mode)) {
      const normalized = resolveLastDarkTheme(mode);
      lastDarkTheme.value = normalized;
      saveSetting(configRepository.setString("VRCX_lastDarkTheme", normalized));
    }
    const { isDark } = changeAppThemeStyle(mode);
    isDarkMode.value = isDark;
    vrStore.updateVRConfigVars();
    updateTrustColor(undefined, undefined).catch((error: unknown) => console.error(error));
  }

  function toggleThemeMode() {
    const nextMode = isDarkMode.value ? "light" : resolveLastDarkTheme(lastDarkTheme.value);
    setThemeMode(nextMode);
  }

  function setAppFontFamily(value: string) {
    const normalized = normalizeAppFontFamily(value);
    appFontFamily.value = normalized;
    saveSetting(configRepository.setString("VRCX_fontFamily", normalized));
    applyAppFontFamily(normalized, customFontFamily.value);
  }

  function setCustomFontFamily(value: string) {
    customFontFamily.value = value;
    saveSetting(configRepository.setString("VRCX_customFontFamily", value));
    if (appFontFamily.value === "custom") {
      applyAppFontFamily("custom", value);
    }
  }

  function setAppCjkFontPack(value: string) {
    const normalized = normalizeAppCjkFontPack(value, APP_CJK_FONT_PACK_DEFAULT_KEY);
    appCjkFontPack.value = normalized;
    saveSetting(configRepository.setString("VRCX_cjkFontPack", normalized));
    applyAppCjkFontPack(normalized);
  }

  const setDisplayVRCProfileThemes = createBooleanToggle(displayVRCProfileThemes, "VRCX_displayVRCProfileThemes");
  const setDisplayVRCProfileBackgrounds = createBooleanToggle(displayVRCProfileBackgrounds, "VRCX_displayVRCProfileBackgrounds");

  function setProfileBackgroundOpacity(value: number) {
    profileBackgroundOpacity.value = value;
    saveSetting(configRepository.setFloat("VRCX_profileBackgroundOpacity", value));
  }

  const setDisplayVRCProfileCosmetics = createBooleanToggle(displayVRCProfileCosmetics, "VRCX_displayVRCProfileCosmetics");

  function setNotificationIconDot() {
    notificationIconDot.value = !notificationIconDot.value;
    saveSetting(configRepository.setBool("VRCX_notificationIconDot", notificationIconDot.value));
    uiStore.updateTrayIconNotify();
  }

  const setHideNicknames = createBooleanToggle(hideNicknames, "VRCX_hideNicknames");
  const setShowInstanceIdInLocation = createBooleanToggle(showInstanceIdInLocation, "VRCX_showInstanceIdInLocation");
  const setIsAgeGatedInstancesVisible = createBooleanToggle(isAgeGatedInstancesVisible, "VRCX_isAgeGatedInstancesVisible");
  const setIsClosedInstancesVisible = createBooleanToggle(isClosedInstancesVisible, "VRCX_isClosedInstancesVisible");
  const setSortFavorites = createBooleanToggle(sortFavorites, "VRCX_sortFavorites");
  const setInstanceUsersSortAlphabetical = createBooleanToggle(instanceUsersSortAlphabetical, "VRCX_instanceUsersSortAlphabetical");

  function setTablePageSize(size: number) {
    const processedSize = clampInt(size, 1, MAX_TABLE_PAGE_SIZE);
    tablePageSize.value = processedSize;
    saveSetting(configRepository.setInt("VRCX_tablePageSize", processedSize));

    return processedSize;
  }

  function setTablePageSizes(sizes: number[]) {
    tablePageSizes.value = normalizeTablePageSizes(sizes);
    saveSetting(configRepository.setString("VRCX_tablePageSizes", JSON.stringify(tablePageSizes.value)));

    const [firstSize] = tablePageSizes.value;
    if (firstSize !== undefined && !tablePageSizes.value.includes(tablePageSize.value)) {
      setTablePageSize(firstSize);
    }
  }

  const setDtHour12 = createBooleanToggle(dtHour12, "VRCX_dtHour12");
  const setDtIsoFormat = createBooleanToggle(dtIsoFormat, "VRCX_dtIsoFormat");

  function setWeekStartsOn(value: number) {
    const v = [0, 1, 6].includes(value) ? value : 1;
    weekStartsOn.value = v;
    saveSetting(configRepository.setInt("VRCX_weekStartsOn", v));
  }

  const { setSidebarSortMethod1, setSidebarSortMethod2, setSidebarSortMethod3, setSidebarSortMethods } = createSidebarSortControls(
    sidebarSortMethod1,
    sidebarSortMethod2,
    sidebarSortMethod3,
    sidebarSortMethods
  );

  function setNavCollapsed(isCollapsed: boolean) {
    isNavCollapsed.value = isCollapsed;
    saveSetting(configRepository.setBool("VRCX_navIsCollapsed", isCollapsed));
  }

  function toggleNavCollapsed() {
    setNavCollapsed(!isNavCollapsed.value);
  }

  function setNavWidth(widthOrArray: number | number[]) {
    const width = resolveNavWidth(widthOrArray);
    if (width) {
      requestAnimationFrame(() => {
        navWidth.value = clampInt(width, 64, 480);
        saveSetting(configRepository.setInt("VRCX_navPanelWidth", navWidth.value));
      });
    }
  }

  const setIsSidebarGroupByInstance = createBooleanToggle(isSidebarGroupByInstance, "VRCX_sidebarGroupByInstance");
  const setIsHideFriendsInSameInstance = createBooleanToggle(isHideFriendsInSameInstance, "VRCX_hideFriendsInSameInstance");
  const setIsSameInstanceAboveFavorites = createBooleanToggle(isSameInstanceAboveFavorites, "VRCX_sameInstanceAboveFavorites");
  const setIsSidebarDivideByFriendGroup = createBooleanToggle(isSidebarDivideByFriendGroup, "VRCX_sidebarDivideByFriendGroup");

  function setSidebarFavoriteGroups(value: string[]) {
    sidebarFavoriteGroups.value = value;
    saveSetting(configRepository.setString("VRCX_sidebarFavoriteGroups", JSON.stringify(value)));
  }

  function setSidebarFavoriteGroupOrder(value: string[]) {
    sidebarFavoriteGroupOrder.value = value;
    saveSetting(configRepository.setString("VRCX_sidebarFavoriteGroupOrder", JSON.stringify(value)));
  }

  const setSidebarCosmetics = createBooleanToggle(sidebarCosmetics, "VRCX_sidebarCosmetics");
  const setHideUserNotes = createBooleanToggle(hideUserNotes, "VRCX_hideUserNotes");
  const setHideUserMemos = createBooleanToggle(hideUserMemos, "VRCX_hideUserMemos");
  const setHideUnfriends = createBooleanToggle(hideUnfriends, "VRCX_hideUnfriends");
  const setRandomUserColours = createBooleanToggle(randomUserColours, "VRCX_randomUserColours");
  const { setTrustColor, applyUserTrustLevel, userColourInit, tryInitUserColours, updateTrustColor } = createTrustColourControls({
    userStore,
    trustColor,
    randomUserColours,
    isDarkMode,
    setRandomUserColours,
  });

  function setTableDensity(density: unknown) {
    const normalized = normalizeTableDensity(density);
    tableDensity.value = normalized;
    applyTableDensity(tableDensity.value);
    saveSetting(configRepository.setString("VRCX_tableDensity", tableDensity.value));
  }

  const toggleStripedDataTable = createBooleanToggle(isDataTableStriped, "VRCX_dataTableStriped");

  const flipAccessibleStatusIndicators = createBooleanToggle(accessibleStatusIndicators, "VRCX_accessibleStatusIndicators");

  function toggleAccessibleStatusIndicators() {
    flipAccessibleStatusIndicators();
    applyAccessibleStatusClass(accessibleStatusIndicators.value);
  }

  const setShowNewDashboardButton = createBooleanToggle(showNewDashboardButton, "VRCX_showNewDashboardButton");

  function showTableLimitsDialog() {
    openTableLimitsDialog(tableLimitsDialog, vrcxStore);
  }

  function closeTableLimitsDialog() {
    tableLimitsDialog.value.visible = false;
  }

  async function saveTableLimitsDialog() {
    await saveTableLimits(tableLimitsDialog, vrcxStore, feedStore, gameLogStore);
  }

  initAppearanceSettings().catch((error: unknown) => console.error(error));

  return {
    appLanguage,
    themeMode,
    isDarkMode,
    appFontFamily,
    appCjkFontPack,
    displayVRCProfileThemes,
    displayVRCProfileBackgrounds,
    profileBackgroundOpacity,
    displayVRCProfileCosmetics,
    hideNicknames,
    showInstanceIdInLocation,
    isAgeGatedInstancesVisible,
    isClosedInstancesVisible,
    sortFavorites,
    instanceUsersSortAlphabetical,
    tablePageSize,
    tablePageSizes,
    dtHour12,
    dtIsoFormat,
    weekStartsOn,
    sidebarSortMethod1,
    sidebarSortMethod2,
    sidebarSortMethod3,
    sidebarSortMethods,
    navWidth,
    isSidebarGroupByInstance,
    isHideFriendsInSameInstance,
    isSameInstanceAboveFavorites,
    isSidebarDivideByFriendGroup,
    sidebarFavoriteGroups,
    sidebarFavoriteGroupOrder,
    sidebarCosmetics,
    hideUserNotes,
    hideUserMemos,
    hideUnfriends,
    randomUserColours,
    tableDensity,
    trustColor,
    currentCulture,
    isSideBarTabShow,
    notificationIconDot,
    isNavCollapsed,
    isDataTableStriped,
    accessibleStatusIndicators,
    showNewDashboardButton,
    tableLimitsDialog,
    TABLE_MAX_SIZE_MIN,
    TABLE_MAX_SIZE_MAX,
    SEARCH_LIMIT_MIN,
    SEARCH_LIMIT_MAX,

    setAppLanguage,
    setDisplayVRCProfileThemes,
    setDisplayVRCProfileBackgrounds,
    setProfileBackgroundOpacity,
    setDisplayVRCProfileCosmetics,
    setHideNicknames,
    setShowInstanceIdInLocation,
    setIsAgeGatedInstancesVisible,
    setIsClosedInstancesVisible,
    setSortFavorites,
    setInstanceUsersSortAlphabetical,
    setTablePageSize,
    setTablePageSizes,
    setDtHour12,
    setDtIsoFormat,
    setWeekStartsOn,
    setSidebarSortMethod1,
    setSidebarSortMethod2,
    setSidebarSortMethod3,
    setSidebarSortMethods,
    setNavWidth,
    setIsSidebarGroupByInstance,
    setIsHideFriendsInSameInstance,
    setIsSameInstanceAboveFavorites,
    setIsSidebarDivideByFriendGroup,
    setSidebarFavoriteGroups,
    setSidebarFavoriteGroupOrder,
    setSidebarCosmetics,
    setHideUserNotes,
    setHideUserMemos,
    setHideUnfriends,
    setRandomUserColours,
    toggleStripedDataTable,
    toggleAccessibleStatusIndicators,
    setShowNewDashboardButton,
    setTableDensity,
    setTrustColor,
    tryInitUserColours,
    updateTrustColor,
    userColourInit,
    applyUserTrustLevel,
    changeAppLanguage,
    showTableLimitsDialog,
    closeTableLimitsDialog,
    saveTableLimitsDialog,
    setNotificationIconDot,
    applyTableDensity,
    setNavCollapsed,
    toggleNavCollapsed,
    setAppFontFamily,
    customFontFamily,
    setCustomFontFamily,
    setAppCjkFontPack,
    setThemeMode,
    toggleThemeMode,
  };
});
