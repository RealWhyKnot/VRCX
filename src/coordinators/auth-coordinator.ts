import type { CurrentUser } from "vrchat";

import { i18n } from "../plugins/i18n";

import Noty from "noty";

import type { Json } from "../types/vrcx";
import { closeWebSocket, initWebsocket } from "../services/websocket";
import { escapeTag } from "../shared/utils/base/string";
import { queryClient } from "../queries/client";
import { useAuthStore } from "../stores/auth";
import { useInstanceStore } from "../stores/instance";
import { useNotificationStore } from "../stores/notification";
import { useUpdateLoopStore } from "../stores/update-loop";
import { useUserStore } from "../stores/user";
import { applyCurrentUser } from "./current-user-apply";
import { watchState } from "../services/watch-state";

import { configRepository } from "../services/config";
import { webApiService } from "../services/webapi";

export async function runLogoutFlow() {
  const authStore = useAuthStore();
  const userStore = useUserStore();
  const notificationStore = useNotificationStore();
  const t = i18n.global.t;

  if (watchState.isLoggedIn) {
    new Noty({
      type: "success",
      text: t("message.auth.logout_greeting", {
        name: `<strong>${escapeTag(userStore.currentUser.displayName)}</strong>`,
      }),
    }).show();
  }

  userStore.setUserDialogVisible(false);
  watchState.isLoggedIn = false;
  watchState.isFriendsLoaded = false;
  watchState.isFavoritesLoaded = false;
  notificationStore.setNotificationInitStatus(false);
  await authStore.updateStoredUser(userStore.currentUser);
  void webApiService.clearCookies().catch((err: unknown) => console.error(err));
  authStore.loginForm.lastUserLoggedIn = "";
  await configRepository.remove("lastUserLoggedIn");
  authStore.setAttemptingAutoLogin(false);
  authStore.autoLoginAttempts.clear();
  closeWebSocket();
  queryClient.clear();
}

export function runLoginSuccessFlow(json: Json<CurrentUser>) {
  const updateLoopStore = useUpdateLoopStore();
  const authStore = useAuthStore();
  const instanceStore = useInstanceStore();

  updateLoopStore.setNextCurrentUserRefresh(420);
  applyCurrentUser(json);
  void initWebsocket()?.catch((err: unknown) => console.error(err));
  void authStore.getPermissions().catch((err: unknown) => console.error(err));
  void instanceStore.loadInstanceCategoriesAndVibes().catch((err: unknown) => console.error(err));
}
