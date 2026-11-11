import { toast } from "vue-sonner";
import type { useI18n } from "vue-i18n";

import { avatarRequest } from "../api/avatar";
import { queryRequest } from "../api/query-request";
import { addLocalWorldFavorite } from "../coordinators/favorite-coordinator";
import { addLocalAvatarFavorite } from "../coordinators/favorite-local-avatars";
import { showGroupDialog } from "../coordinators/group-dialog-coordinator";
import { showWorldDialog } from "../coordinators/world-coordinator";
import { showAvatarDialog, selectAvatarWithConfirmation, selectAvatarWithoutConfirmation } from "../coordinators/avatar-coordinator";
import { showUserDialog } from "../coordinators/user-coordinator";
import { watchState } from "../services/watch-state";
import { logError } from "./vrcx-messages";
import type { useFavoriteStore } from "./favorite";
import type { useAdvancedSettingsStore } from "./settings/advanced";
import type { useSearchStore } from "./search";
import type { useAvatarProviderStore } from "./avatar-provider";

export type CreateVrcxLaunchCommandsDeps = {
  favoriteStore: ReturnType<typeof useFavoriteStore>;
  advancedSettingsStore: ReturnType<typeof useAdvancedSettingsStore>;
  searchStore: ReturnType<typeof useSearchStore>;
  avatarProviderStore: ReturnType<typeof useAvatarProviderStore>;
  t: ReturnType<typeof useI18n>["t"];
};

export function createVrcxLaunchCommands(deps: CreateVrcxLaunchCommandsDeps) {
  const { favoriteStore, advancedSettingsStore, searchStore, avatarProviderStore, t } = deps;

  async function startupLaunchCommand() {
    const command = await AppApi.GetLaunchCommand();
    if (!command) {
      return;
    }
    if (command.startsWith("crash/")) {
      const crashMessage = command.replace("crash/", "");
      console.error("VRCX recovered from crash:", crashMessage);

      if (advancedSettingsStore.sentryErrorReporting) {
        try {
          import("@sentry/vue")
            .then((sentry) => {
              sentry.withScope((scope) => {
                scope.setLevel("fatal");
                scope.setTag("reason", "crash-recovery");
                scope.setContext("session", {
                  sessionTime: performance.now() / 1000 / 60,
                });
                sentry.captureMessage(`crash message: ${crashMessage}`);
              });
            })
            .catch(logError);
        } catch (error) {
          console.error("Error setting up Sentry feedback:", error);
        }
      }

      toast.success(t("message.crash.vrcx_reload"));
      return;
    }
    eventLaunchCommand(command);
  }

  function eventLaunchCommand(input: string) {
    if (!watchState.isLoggedIn) {
      return;
    }
    console.log("LaunchCommand:", input);
    const args = input.split("/");
    const command = args[0] ?? "";
    const commandArg = args[1]?.trim() ?? "";
    let shouldFocusWindow = true;
    switch (command) {
      case "world":
        if (!searchStore.directAccessWorld(input.replace("world/", ""))) {
          showWorldDialog(commandArg);
        }
        break;
      case "avatar":
        showAvatarDialog(commandArg);
        break;
      case "user":
        showUserDialog(commandArg);
        break;
      case "group":
        showGroupDialog(commandArg);
        break;
      case "local-favorite-world": {
        console.log("local-favorite-world", commandArg);
        const [id, group] = commandArg.split(":");
        if (!id || !group) {
          toast.error("Invalid local favorite world command");
          break;
        }
        queryRequest
          .fetch("world.location", { worldId: id })
          .then(() => {
            searchStore.directAccessWorld(id);
            addLocalWorldFavorite(id, group);
          })
          .catch(logError);
        break;
      }
      case "local-favorite-avatar": {
        console.log("local-favorite-avatar", commandArg);
        const [avatarIdFav, avatarGroup] = commandArg.split(":");
        if (!avatarIdFav || !avatarGroup) {
          toast.error("Invalid local favorite avatar command");
          break;
        }
        avatarRequest
          .getAvatar({ avatarId: avatarIdFav })
          .then(() => {
            showAvatarDialog(avatarIdFav);
            addLocalAvatarFavorite(avatarIdFav, avatarGroup);
          })
          .catch(logError);
        break;
      }
      case "addavatardb":
        avatarProviderStore.addAvatarProvider(input.replace("addavatardb/", ""));
        break;
      case "switchavatar": {
        const avatarId = commandArg;
        const regexAvatarId = /avtr_[0-9A-Fa-f]{8}-([0-9A-Fa-f]{4}-){3}[0-9A-Fa-f]{12}/g;
        if (!avatarId.match(regexAvatarId) || avatarId.length !== 41) {
          toast.error("Invalid Avatar ID");
          break;
        }
        if (advancedSettingsStore.showConfirmationOnSwitchAvatar) {
          selectAvatarWithConfirmation(avatarId);

          shouldFocusWindow = true;
        } else {
          selectAvatarWithoutConfirmation(avatarId)
            .then(() => {
              toast.success("Avatar changed via launch command");
            })
            .catch(logError);
          shouldFocusWindow = false;
        }
        break;
      }
      case "import": {
        const type = args[1];
        if (!type) break;
        const data = input.replace(`import/${type}/`, "");
        if (type === "avatar") {
          favoriteStore.setAvatarImportDialogInput(data);
          favoriteStore.showAvatarImportDialog();
        } else if (type === "world") {
          favoriteStore.setWorldImportDialogInput(data);
          favoriteStore.showWorldImportDialog();
        } else if (type === "friend") {
          favoriteStore.setFriendImportDialogInput(data);
          favoriteStore.showFriendImportDialog();
        }
        break;
      }
    }
    if (shouldFocusWindow) {
      AppApi.FocusWindow().catch(logError);
    }
  }

  return {
    startupLaunchCommand,
    eventLaunchCommand,
  };
}
