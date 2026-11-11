import { computed, ref, watch } from "vue";
import { defineStore } from "pinia";
import { toast } from "vue-sonner";
import { useI18n } from "vue-i18n";
import type { SearchUsers } from "vrchat";

import { instanceRequest } from "../api/instance";
import { userRequest } from "../api/user";
import { groupRequest } from "../api/group";
import { useAppearanceSettingsStore } from "./settings/appearance";
import { showGroupDialog } from "../coordinators/group-dialog-coordinator";
import { showWorldDialog } from "../coordinators/world-coordinator";
import { showAvatarDialog } from "../coordinators/avatar-coordinator";
import { showUserDialog } from "../coordinators/user-coordinator";
import { applyUser } from "../coordinators/user-profile-apply";
import { useModalStore } from "./modal";
import { useUserStore } from "./user";
import { watchState } from "../services/watch-state";
import { isVrcxUser } from "./friend-types";
import { logFailure } from "./log-failure";
import type { VrcxUser } from "../types/vrcx";

type SearchUsersQuery = NonNullable<SearchUsers["query"]>;
type SearchUserParams = SearchUsersQuery & { n: number; offset: number; fuzzy?: boolean };

export const useSearchStore = defineStore("Search", () => {
  const userStore = useUserStore();
  const appearanceSettingsStore = useAppearanceSettingsStore();
  const modalStore = useModalStore();
  const { t } = useI18n();

  const searchText = ref("");
  const searchUserResults = ref<VrcxUser[]>([]);
  const friendsListSearch = ref("");

  const directAccessPrompt = ref<ReturnType<typeof modalStore.prompt> | null>(null);

  const stringComparer = computed(() =>
    Intl.Collator(appearanceSettingsStore.appLanguage.replace("_", "-"), {
      usage: "search",
      sensitivity: "base",
    })
  );

  watch(
    () => watchState.isLoggedIn,
    () => {
      searchText.value = "";
      searchUserResults.value = [];
    },
    { flush: "sync" }
  );

  function clearSearch() {
    searchText.value = "";
    searchUserResults.value = [];
  }

  function setSearchText(value: string) {
    searchText.value = value;
  }

  async function searchUserByDisplayName(displayName: string) {
    const params: SearchUserParams = {
      n: 10,
      offset: 0,
      fuzzy: false,
      search: displayName,
    };
    await moreSearchUser(null, params);
  }

  async function moreSearchUser(go: number | null, params: SearchUserParams) {
    if (go) {
      params.offset += params.n * go;
      if (params.offset < 0) {
        params.offset = 0;
      }
    }
    await userRequest.getUsers(params).then((args) => {
      for (const json of args.json) {
        if (!json.displayName) {
          console.error("getUsers gave us garbage", json);
          continue;
        }

        applyUser(json);
      }

      const map = new Map<string, VrcxUser>();
      for (const json of args.json) {
        const cached: unknown = userStore.cachedUsers.get(json.id);
        if (isVrcxUser(cached)) {
          map.set(cached.id, cached);
        }
      }
      searchUserResults.value = Array.from(map.values());
      return args;
    });
  }

  async function directAccessPaste() {
    const cbText = isHostLinux
      ? await window.electron.getClipboardText()
      : await AppApi.GetClipboard().catch((e: unknown) => {
          console.log(e);
          return "";
        });

    const trimemd = cbText.trim();
    if (!directAccessParse(trimemd)) {
      void promptOmniDirectDialog().catch(logFailure("Opening the direct access prompt failed:"));
    } else {
      toast.success(t("prompt.direct_access_omni.message.opened_from_clipboard"));
    }
  }

  function directAccessParse(input: string | null | undefined): boolean {
    if (!input) {
      return false;
    }
    if (directAccessWorld(input)) {
      return true;
    }
    if (input.startsWith("https://vrchat.")) {
      const url = new URL(input);
      const urlPath = url.pathname;
      const urlPathSplit = urlPath.split("/");
      if (urlPathSplit.length < 4) {
        return false;
      }
      const type = urlPathSplit[2];
      if (type === "user") {
        const userId = urlPathSplit[3] ?? "";
        showUserDialog(userId);
        return true;
      } else if (type === "avatar") {
        const avatarId = urlPathSplit[3] ?? "";
        showAvatarDialog(avatarId);
        return true;
      } else if (type === "group") {
        const groupId = urlPathSplit[3] ?? "";
        showGroupDialog(groupId);
        return true;
      }
    } else if (input.startsWith("https://vrc.group/")) {
      const shortCode = input.substring(18);
      showGroupDialogShortCode(shortCode);
      return true;
    } else if (/^[A-Za-z0-9]{3,6}\.[0-9]{4}$/g.test(input)) {
      showGroupDialogShortCode(input);
      return true;
    } else if (input.startsWith("usr_") || /^[A-Za-z0-9]{10}$/g.test(input)) {
      showUserDialog(input);
      return true;
    } else if (input.startsWith("avtr_") || input.startsWith("b_")) {
      showAvatarDialog(input);
      return true;
    } else if (input.startsWith("grp_")) {
      showGroupDialog(input);
      return true;
    }
    return false;
  }

  function directAccessWorld(textBoxInput: string): boolean {
    let worldId: string | null | undefined;
    let shortName: string | null | undefined;
    let input = textBoxInput;
    if (input.startsWith("/home/")) {
      input = `https://vrchat.com${input}`;
    }
    if (input.length === 8) {
      return verifyShortNameInBackground("", input);
    } else if (/^https:\/\/vrch\.at\/[A-Za-z0-9]{8}$/.test(input)) {
      shortName = input.substring(16, 24);
      return verifyShortNameInBackground("", shortName);
    } else if (input.startsWith("https://vrchat.") || input.startsWith("/home/")) {
      const url = new URL(input);
      const urlPath = url.pathname;
      const urlPathSplit = urlPath.split("/");
      if (urlPathSplit.length >= 4 && urlPathSplit[2] === "world") {
        worldId = urlPathSplit[3] ?? "";
        showWorldDialog(worldId);
        return true;
      } else if (urlPath.substring(5, 12) === "/launch") {
        const urlParams = new URLSearchParams(url.search);
        worldId = urlParams.get("worldId");
        const instanceId = urlParams.get("instanceId");
        if (instanceId) {
          shortName = urlParams.get("shortName");
          const location = `${String(worldId)}:${instanceId}`;
          if (shortName) {
            return verifyShortNameInBackground(location, shortName);
          }
          showWorldDialog(location);
          return true;
        } else if (worldId) {
          showWorldDialog(worldId);
          return true;
        }
      }
    } else if (input.startsWith("wrld_") || input.startsWith("wld_") || input.startsWith("o_")) {
      if (input.includes("&instanceId=")) {
        input = `https://vrchat.com/home/launch?worldId=${input}`;
        return directAccessWorld(input);
      }
      showWorldDialog(input.trim());
      return true;
    }
    return false;
  }

  async function promptOmniDirectDialog() {
    if (directAccessPrompt.value) return;

    directAccessPrompt.value = modalStore.prompt({
      title: t("prompt.direct_access_omni.header"),
      description: t("prompt.direct_access_omni.description"),
      confirmText: t("prompt.direct_access_omni.ok"),
      cancelText: t("prompt.direct_access_omni.cancel"),
      pattern: /\S+/,
      errorMessage: t("prompt.direct_access_omni.input_error"),
    });

    try {
      const { ok, value } = await directAccessPrompt.value;

      if (ok && value) {
        const input = value.trim();
        if (!directAccessParse(input)) {
          toast.error(t("prompt.direct_access_omni.message.error"));
        }
      }
    } catch (error) {
      console.log(error);
    } finally {
      directAccessPrompt.value = null;
    }
  }

  function showGroupDialogShortCode(shortCode: string) {
    groupRequest
      .groupStrictsearch({ query: shortCode })
      .then((args) => {
        for (const group of args.json) {
          if (group.id && `${group.shortCode}.${group.discriminator}` === shortCode) {
            showGroupDialog(group.id);
            break;
          }
        }
        return args;
      })
      .catch(logFailure("Looking up the group short code failed:"));
  }

  function verifyShortNameInBackground(location: string, shortName: string): true {
    verifyShortName(location, shortName).catch(logFailure("Checking the instance short name failed:"));
    return true;
  }

  function verifyShortName(location: string, shortName: string) {
    return instanceRequest.getInstanceFromShortName({ shortName }).then((args) => {
      const newLocation = args.json.location;
      const newShortName = args.json.shortName;
      if (newShortName) {
        showWorldDialog(newLocation, newShortName);
      } else if (newLocation) {
        showWorldDialog(newLocation);
      } else {
        showWorldDialog(location);
      }
      return args;
    });
  }

  return {
    searchText,
    searchUserResults,
    stringComparer,
    friendsListSearch,

    clearSearch,
    searchUserByDisplayName,
    moreSearchUser,
    directAccessParse,
    directAccessPaste,
    directAccessWorld,
    verifyShortName,
    setSearchText,
  };
});
