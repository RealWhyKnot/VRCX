import type { Ref } from "vue";
import type { CurrentUser } from "vrchat";
import type { Json } from "../types/vrcx";
import { configRepository } from "../services/config";
import { webApiService } from "../services/webapi";
import { getAllSavedCredentials } from "./auth-credentials";
import type { CredentialsToSave, LoginForm } from "./auth-types";

type StoredUserDeps = {
  loginForm: Ref<LoginForm>;
  credentialsToSave: Ref<CredentialsToSave | null>;
};

export function createStoredUserUpdater({ loginForm, credentialsToSave }: StoredUserDeps) {
  return async function updateStoredUser(user: Json<CurrentUser>) {
    const savedCredentials = await getAllSavedCredentials();
    if (credentialsToSave.value) {
      savedCredentials[user.id] = {
        user,
        loginParams: {
          username: "",
          password: "",
          endpoint: "",
          websocket: "",
          ...savedCredentials[user.id]?.loginParams,
          ...credentialsToSave.value,
        },
      };
      credentialsToSave.value = null;
    } else {
      const existing = savedCredentials[user.id];
      if (existing) {
        existing.user = user;
        existing.cookies = await webApiService.getCookies();
      }
    }
    const jsonCredentialsArray = JSON.stringify(savedCredentials);
    await configRepository.setString("savedCredentials", jsonCredentialsArray);
    loginForm.value.lastUserLoggedIn = user.id;
    await configRepository.setString("lastUserLoggedIn", user.id);
  };
}
