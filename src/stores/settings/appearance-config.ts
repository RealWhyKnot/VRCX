import { APP_CJK_FONT_PACK_DEFAULT_KEY, APP_FONT_DEFAULT_KEY } from "../../shared/constants/fonts";
import { DEFAULT_SIDEBAR_SORT_METHODS, DEFAULT_TABLE_PAGE_SIZES, TRUST_COLOR_DEFAULTS } from "./appearance-helpers";
import { configRepository } from "../../services/config";

export function readAppearanceConfig(fallbackDarkTheme: string) {
  return Promise.all([
    configRepository.getString("VRCX_appLanguage"),
    configRepository.getBool("VRCX_displayVRCProfileThemes", true),
    configRepository.getBool("VRCX_displayVRCProfileBackgrounds", false),
    configRepository.getFloat("VRCX_profileBackgroundOpacity", 0.5),
    configRepository.getBool("VRCX_displayVRCProfileCosmetics", false),
    configRepository.getBool("VRCX_hideNicknames", false),
    configRepository.getBool("VRCX_showInstanceIdInLocation", false),
    configRepository.getBool("VRCX_isAgeGatedInstancesVisible", true),
    configRepository.getBool("VRCX_isClosedInstancesVisible", true),
    configRepository.getBool("VRCX_sortFavorites", true),
    configRepository.getBool("VRCX_instanceUsersSortAlphabetical", false),
    configRepository.getInt("VRCX_tablePageSize", 20),
    configRepository.getString("VRCX_tablePageSizes", JSON.stringify(DEFAULT_TABLE_PAGE_SIZES)),
    configRepository.getBool("VRCX_dtHour12", false),
    configRepository.getBool("VRCX_dtIsoFormat", false),
    configRepository.getInt("VRCX_weekStartsOn", 1),
    configRepository.getString("VRCX_sidebarSortMethods", JSON.stringify(DEFAULT_SIDEBAR_SORT_METHODS)),
    configRepository.getInt("VRCX_navPanelWidth", 240),
    configRepository.getBool("VRCX_sidebarGroupByInstance", true),
    configRepository.getBool("VRCX_hideFriendsInSameInstance", false),
    configRepository.getBool("VRCX_sameInstanceAboveFavorites", false),
    configRepository.getBool("VRCX_sidebarDivideByFriendGroup", true),
    configRepository.getString("VRCX_sidebarFavoriteGroups", "[]"),
    configRepository.getString("VRCX_sidebarFavoriteGroupOrder", "[]"),
    configRepository.getBool("VRCX_sidebarCosmetics", false),
    configRepository.getBool("VRCX_hideUserNotes", false),
    configRepository.getBool("VRCX_hideUserMemos", false),
    configRepository.getBool("VRCX_hideUnfriends", false),
    configRepository.getBool("VRCX_randomUserColours", false),
    configRepository.getString("VRCX_tableDensity"),
    configRepository.getBool("VRCX_compactTableMode", false),
    configRepository.getString("VRCX_trustColor", JSON.stringify(TRUST_COLOR_DEFAULTS)),
    configRepository.getBool("VRCX_notificationIconDot", true),
    configRepository.getBool("VRCX_navIsCollapsed", false),
    configRepository.getBool("VRCX_dataTableStriped", false),
    configRepository.getBool("VRCX_accessibleStatusIndicators", false),
    configRepository.getBool("VRCX_showNewDashboardButton", true),
    configRepository.getString("VRCX_fontFamily", APP_FONT_DEFAULT_KEY),
    configRepository.getString("VRCX_customFontFamily", ""),
    configRepository.getString("VRCX_cjkFontPack", APP_CJK_FONT_PACK_DEFAULT_KEY),
    configRepository.getString("VRCX_lastDarkTheme", fallbackDarkTheme),
  ]);
}

export async function readLegacySortMethods(): Promise<string[] | null> {
  const isOrderFriendsGroupPrivate = await configRepository.getBool("orderFriendGroupPrivate");
  if (isOrderFriendsGroupPrivate === null) {
    return null;
  }
  await configRepository.remove("orderFriendGroupPrivate");

  const isOrderFriendsGroupStatus = await configRepository.getBool("orderFriendsGroupStatus");
  await configRepository.remove("orderFriendsGroupStatus");

  const isOrderFriendsGroupGPS = await configRepository.getBool("orderFriendGroupGPS");
  await configRepository.remove("orderFriendGroupGPS");

  const isOrderOnlineFor = await configRepository.getBool("orderFriendGroup0");
  await configRepository.remove("orderFriendGroup0");
  await configRepository.remove("orderFriendGroup1");
  await configRepository.remove("orderFriendGroup2");
  await configRepository.remove("orderFriendGroup3");

  const sortOrder: string[] = [];
  if (isOrderFriendsGroupPrivate) {
    sortOrder.push("Sort Private to Bottom");
  }
  if (isOrderFriendsGroupStatus) {
    sortOrder.push("Sort by Status");
  }
  if (isOrderOnlineFor && isOrderFriendsGroupGPS) {
    sortOrder.push("Sort by Time in Instance");
  }
  if (!isOrderOnlineFor) {
    sortOrder.push("Sort Alphabetically");
  }
  if (sortOrder.length > 0) {
    while (sortOrder.length < 3) {
      sortOrder.push("");
    }
  }
  return sortOrder;
}
