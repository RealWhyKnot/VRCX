import { ref } from "vue";
import { configRepository } from "../../../services/config";
import { logFailure } from "../../../stores/log-failure";

export function useFriendsGroupStates() {
  const isFriendsGroupMe = ref(true);
  const isVIPFriends = ref(true);
  const isOnlineFriends = ref(true);
  const isActiveFriends = ref(true);
  const isOfflineFriends = ref(true);
  const isSidebarGroupByInstanceCollapsed = ref(false);

  function saveBoolConfig(key: string, isEnabled: boolean) {
    void configRepository.setBool(key, isEnabled).catch(logFailure(`save ${key}`));
  }

  function saveFriendsGroupStates() {
    saveBoolConfig("VRCX_isFriendsGroupMe", isFriendsGroupMe.value);
    saveBoolConfig("VRCX_isFriendsGroupFavorites", isVIPFriends.value);
    saveBoolConfig("VRCX_isFriendsGroupOnline", isOnlineFriends.value);
    saveBoolConfig("VRCX_isFriendsGroupActive", isActiveFriends.value);
    saveBoolConfig("VRCX_isFriendsGroupOffline", isOfflineFriends.value);
  }

  async function loadFriendsGroupStates() {
    isFriendsGroupMe.value = await configRepository.getBool("VRCX_isFriendsGroupMe", true);
    isVIPFriends.value = await configRepository.getBool("VRCX_isFriendsGroupFavorites", true);
    isOnlineFriends.value = await configRepository.getBool("VRCX_isFriendsGroupOnline", true);
    isActiveFriends.value = await configRepository.getBool("VRCX_isFriendsGroupActive", true);
    isOfflineFriends.value = await configRepository.getBool("VRCX_isFriendsGroupOffline", true);
    isSidebarGroupByInstanceCollapsed.value = await configRepository.getBool("VRCX_sidebarGroupByInstanceCollapsed", false);
  }

  function toggleSwitchGroupByInstanceCollapsed() {
    isSidebarGroupByInstanceCollapsed.value = !isSidebarGroupByInstanceCollapsed.value;
    saveBoolConfig("VRCX_sidebarGroupByInstanceCollapsed", isSidebarGroupByInstanceCollapsed.value);
  }

  function toggleFriendsGroupMe() {
    isFriendsGroupMe.value = !isFriendsGroupMe.value;
    saveFriendsGroupStates();
  }

  function toggleVIPFriends() {
    isVIPFriends.value = !isVIPFriends.value;
    saveFriendsGroupStates();
  }

  function toggleOnlineFriends() {
    isOnlineFriends.value = !isOnlineFriends.value;
    saveFriendsGroupStates();
  }

  function toggleActiveFriends() {
    isActiveFriends.value = !isActiveFriends.value;
    saveFriendsGroupStates();
  }

  function toggleOfflineFriends() {
    isOfflineFriends.value = !isOfflineFriends.value;
    saveFriendsGroupStates();
  }

  return {
    isFriendsGroupMe,
    isVIPFriends,
    isOnlineFriends,
    isActiveFriends,
    isOfflineFriends,
    isSidebarGroupByInstanceCollapsed,
    loadFriendsGroupStates,
    toggleSwitchGroupByInstanceCollapsed,
    toggleFriendsGroupMe,
    toggleVIPFriends,
    toggleOnlineFriends,
    toggleActiveFriends,
    toggleOfflineFriends,
  };
}
