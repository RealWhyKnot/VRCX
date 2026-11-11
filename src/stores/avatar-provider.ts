import { ref, watch } from "vue";
import { defineStore } from "pinia";

import { router } from "../plugins/router";
import { useAdvancedSettingsStore } from "./settings/advanced";
import { logError } from "./notification/errors";
import { watchState } from "../services/watch-state";

import { configRepository } from "../services/config";

function parseStringList(text: string): string[] {
  const parsed: unknown = JSON.parse(text);
  const items: unknown[] = Array.isArray(parsed) ? parsed : [];
  return items.filter((item): item is string => typeof item === "string");
}

export const useAvatarProviderStore = defineStore("AvatarProvider", () => {
  const advancedSettingsStore = useAdvancedSettingsStore();

  const isAvatarProviderDialogVisible = ref(false);

  const avatarRemoteDatabaseProvider = ref("");

  const avatarRemoteDatabaseProviderList = ref(["https://api.avtrdb.com/v3/avatar/search/vrcx"]);
  watch(
    () => watchState.isLoggedIn,
    () => {
      isAvatarProviderDialogVisible.value = false;
    },
    { flush: "sync" }
  );

  async function initAvatarProviderState(): Promise<void> {
    avatarRemoteDatabaseProviderList.value = parseStringList(
      await configRepository.getString("VRCX_avatarRemoteDatabaseProviderList", '[ "https://api.avtrdb.com/v3/avatar/search/vrcx" ]')
    );
    const deprecated = "https://avtr.just-h.party/vrcx_search.php";
    const v1 = "https://api.avtrdb.com/v1/avatar/search/vrcx";
    const v2 = "https://api.avtrdb.com/v2/avatar/search/vrcx";
    const v3 = "https://api.avtrdb.com/v3/avatar/search/vrcx";

    const newList = avatarRemoteDatabaseProviderList.value.filter((u) => u !== deprecated).map((u) => (u === v1 || u === v2 ? v3 : u));

    if (JSON.stringify(newList) !== JSON.stringify(avatarRemoteDatabaseProviderList.value)) {
      avatarRemoteDatabaseProviderList.value = newList;
      await configRepository.setString("VRCX_avatarRemoteDatabaseProviderList", JSON.stringify(newList));
    }

    const savedProvider = await configRepository.getString("VRCX_avatarRemoteDatabaseProvider");
    if (savedProvider) {
      if (!avatarRemoteDatabaseProviderList.value.includes(savedProvider)) {
        avatarRemoteDatabaseProviderList.value.push(savedProvider);
      }
      await configRepository.remove("VRCX_avatarRemoteDatabaseProvider");
      await configRepository.setString("VRCX_avatarRemoteDatabaseProviderList", JSON.stringify(avatarRemoteDatabaseProviderList.value));
    }
    const firstProvider = avatarRemoteDatabaseProviderList.value[0];
    if (firstProvider !== undefined) {
      avatarRemoteDatabaseProvider.value = firstProvider;
    }
  }

  function addAvatarProvider(url: string) {
    if (!url) {
      return;
    }
    showAvatarProviderDialog();
    if (!avatarRemoteDatabaseProviderList.value.includes(url)) {
      avatarRemoteDatabaseProviderList.value.push(url);
    }
    saveAvatarProviderList().catch(logError);
  }

  function removeAvatarProvider(url: string) {
    const length = avatarRemoteDatabaseProviderList.value.length;
    for (let i = 0; i < length; ++i) {
      if (avatarRemoteDatabaseProviderList.value[i] === url) {
        avatarRemoteDatabaseProviderList.value.splice(i, 1);
      }
    }
    saveAvatarProviderList().catch(logError);
  }

  async function saveAvatarProviderList(): Promise<void> {
    avatarRemoteDatabaseProviderList.value = avatarRemoteDatabaseProviderList.value.filter(Boolean);
    await configRepository.setString("VRCX_avatarRemoteDatabaseProviderList", JSON.stringify(avatarRemoteDatabaseProviderList.value));
    if (avatarRemoteDatabaseProviderList.value.length > 0) {
      avatarRemoteDatabaseProvider.value = avatarRemoteDatabaseProviderList.value[0] ?? "";
      advancedSettingsStore.setAvatarRemoteDatabase(true);
    } else {
      avatarRemoteDatabaseProvider.value = "";
      advancedSettingsStore.setAvatarRemoteDatabase(false);
    }
  }

  function showAvatarProviderDialog() {
    router.push({ name: "settings" }).catch(logError);
    isAvatarProviderDialogVisible.value = true;
  }

  function setAvatarProvider(provider: string) {
    avatarRemoteDatabaseProvider.value = provider;
  }

  initAvatarProviderState().catch(logError);

  return {
    isAvatarProviderDialogVisible,
    avatarRemoteDatabaseProvider,
    avatarRemoteDatabaseProviderList,

    addAvatarProvider,
    removeAvatarProvider,
    saveAvatarProviderList,
    showAvatarProviderDialog,
    setAvatarProvider,
  };
});
