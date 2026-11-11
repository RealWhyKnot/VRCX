import { ref, watch } from "vue";
import { defineStore } from "pinia";
import { toast } from "vue-sonner";
import { useI18n } from "vue-i18n";

import Noty from "noty";

import { runLoginSuccessFlow, runLogoutFlow } from "../coordinators/auth-coordinator";
import { AppDebug } from "../services/app-config";
import { authRequest } from "../api/auth";
import { database } from "../services/database";
import { escapeTag } from "../shared/utils/base/string";
import { initWebsocket } from "../services/websocket";
import { request } from "../services/request";
import { runHandleAutoLoginFlow } from "../coordinators/auth-auto-login-coordinator";
import { getCurrentUser } from "../coordinators/user-coordinator";
import { useAdvancedSettingsStore } from "./settings/advanced";
import { useGeneralSettingsStore } from "./settings/general";
import { useModalStore } from "./modal";
import { useUpdateLoopStore } from "./update-loop";
import { useUserStore } from "./user";
import { useVrcxStore } from "./vrcx";
import { watchState } from "../services/watch-state";

import { configRepository } from "../services/config";
import { security } from "../services/security";
import { webApiService } from "../services/webapi";

import * as workerTimers from "worker-timers";
import { useActivityStore } from "./activity";
import { logFailure } from "./log-failure";
import { getAllSavedCredentials, parseStoredCredentials, requireLoginParams, requireUser } from "./auth-credentials";
import { createLoginNetworkHint, shouldCountLoginFailureForNetworkHint } from "./auth-login-hint";
import { createTwoFactorPrompts } from "./auth-two-factor";
import { createPrimaryPassword } from "./auth-primary-password";
import { createStoredUserUpdater } from "./auth-stored-user";
import {
  errorMessageIncludes,
  isAuthUserResponse,
  isRecord,
  toCipherText,
  toConfirmOk,
  toPromptResult,
  type AuthLoginParams,
  type AuthLoginResult,
  type CachedConfig,
  type CachedPermissions,
  type CredentialsToSave,
  type LoginForm,
  type PrimaryPasswordDialog,
  type StoredCredential,
} from "./auth-types";

export const useAuthStore = defineStore("Auth", () => {
  const advancedSettingsStore = useAdvancedSettingsStore();
  const generalSettingsStore = useGeneralSettingsStore();
  const userStore = useUserStore();
  const updateLoopStore = useUpdateLoopStore();
  const modalStore = useModalStore();
  const vrcxStore = useVrcxStore();
  const activityStore = useActivityStore();

  const { t } = useI18n();
  const autoLoginAttempts = ref(new Set<number>());

  const loginForm = ref<LoginForm>({
    loading: false,
    username: "",
    password: "",
    endpoint: "",
    websocket: "",
    saveCredentials: true,
    lastUserLoggedIn: "",
  });

  const enablePrimaryPasswordDialog = ref<PrimaryPasswordDialog>({
    visible: false,
    password: "",
    rePassword: "",
    beforeClose(done: () => void) {
      done();
    },
  });

  const credentialsToSave = ref<CredentialsToSave | null>(null);

  const twoFactorAuthDialogVisible = ref(false);

  const cachedConfig = ref<CachedConfig>({});

  const cachedPermissions = ref<CachedPermissions>({
    maxUserStickers: 18,
    maxUserEmoji: 18,
    maxUserGallery: 64,
    maxUserIcons: 18,
    maxUserPrints: 64,
  });

  const enableCustomEndpoint = ref(false);

  const attemptingAutoLogin = ref(false);

  const updateStoredUser = createStoredUserUpdater({ loginForm, credentialsToSave });
  const loginNetworkHint = createLoginNetworkHint(t);
  const { promptTOTP, promptEmailOTP } = createTwoFactorPrompts({
    modalStore,
    twoFactorAuthDialogVisible,
    t,
    clearCookiesTryLogin,
    resendEmail2fa,
  });
  const { enablePrimaryPasswordChange, setPrimaryPassword, checkPrimaryPassword } = createPrimaryPassword({
    advancedSettingsStore,
    modalStore,
    t,
    credentialsToSave,
    enablePrimaryPasswordDialog,
    updateStoredUser,
  });

  watch(
    [() => watchState.isLoggedIn, () => userStore.currentUser],
    ([isLoggedIn, currentUser]) => {
      twoFactorAuthDialogVisible.value = false;
      if (isLoggedIn) {
        loginNetworkHint.reset();
        updateStoredUser(currentUser).catch(logFailure("Updating stored user failed:"));
        new Noty({
          type: "success",
          text: t("message.auth.login_greeting", {
            name: `<strong>${escapeTag(currentUser.displayName)}</strong>`,
          }),
        }).show();
      }
    },
    { flush: "sync" }
  );

  watch([() => loginForm.value.username, () => loginForm.value.password], loginNetworkHint.reset);

  watch(
    () => watchState.isFriendsLoaded,
    (isFriendsLoaded) => {
      if (isFriendsLoaded) {
        initWebsocket()?.catch(logFailure("Opening the websocket failed:"));
        AppApi.IPCAnnounceStart().catch(logFailure("Announcing IPC start failed:"));
      }
    },
    { flush: "sync" }
  );

  async function init() {
    const [lastUserLoggedIn, isCustomEndpointEnabled] = await Promise.all([
      configRepository.getString("lastUserLoggedIn", ""),
      configRepository.getBool("VRCX_enableCustomEndpoint", false),
    ]);
    loginForm.value.lastUserLoggedIn = lastUserLoggedIn;
    enableCustomEndpoint.value = isCustomEndpointEnabled;
  }

  init().catch(logFailure("Loading login settings failed:"));

  async function getSavedCredentials(userId: string): Promise<StoredCredential | undefined> {
    const savedCredentials = await getAllSavedCredentials();
    return savedCredentials[userId];
  }

  async function handleLogoutEvent() {
    await runLogoutFlow();
  }

  async function autoLoginAfterMounted() {
    const canAutoLogin = await vrcxStore.waitForDatabaseInit();
    if (!canAutoLogin) {
      console.warn("Skipping auto-login after mount because database initialization did not complete successfully.");
      return;
    }
    if (!advancedSettingsStore.enablePrimaryPassword && (await configRepository.getString("lastUserLoggedIn")) !== null) {
      const user = await getSavedCredentials(loginForm.value.lastUserLoggedIn);
      if (user?.loginParams?.endpoint) {
        AppDebug.endpointDomain = user.loginParams.endpoint;
        AppDebug.websocketDomain = user.loginParams.websocket ?? "";
      }
      await applyAutoLoginDelay();

      loginForm.value.loading = true;
      try {
        await authRequest.getConfig();
        try {
          await getCurrentUser();
        } catch (err) {
          updateLoopStore.setNextCurrentUserRefresh(60);
          console.error(err);
        }
      } finally {
        loginForm.value.loading = false;
      }
    }
  }

  async function clearCookiesTryLogin() {
    await webApiService.clearCookies();
    if (loginForm.value.lastUserLoggedIn) {
      const user = await getSavedCredentials(loginForm.value.lastUserLoggedIn);
      if (user) {
        delete user.cookies;
        await relogin(user, {
          shouldTrackLoginNetworkIssueHint: false,
        });
      }
    }
  }

  async function resendEmail2fa() {
    if (loginForm.value.lastUserLoggedIn) {
      const user = await getSavedCredentials(loginForm.value.lastUserLoggedIn);
      if (user) {
        await webApiService.clearCookies();
        delete user.cookies;
        relogin(user, {
          shouldTrackLoginNetworkIssueHint: false,
        })
          .then(() => {
            toast.success(t("message.auth.email_2fa_resent"));
          })
          .catch(logFailure("Resending the email code failed:"));
        return;
      }
    }
    toast.error(t("message.auth.email_2fa_no_credentials"));
  }

  function queueSaveCredentials() {
    if (loginForm.value.saveCredentials) {
      credentialsToSave.value = {};
    }
  }

  async function migrateStoredUsers() {
    const savedCredentials = await getAllSavedCredentials();
    for (const name of Object.keys(savedCredentials)) {
      const entry = savedCredentials[name];
      const userId = entry?.user?.id;
      if (entry && userId && userId !== name) {
        savedCredentials[userId] = entry;
        Reflect.deleteProperty(savedCredentials, name);
      }
    }
    await configRepository.setString("savedCredentials", JSON.stringify(savedCredentials));
  }

  async function toggleCustomEndpoint() {
    await configRepository.setBool("VRCX_enableCustomEndpoint", enableCustomEndpoint.value);
    loginForm.value.endpoint = "";
    loginForm.value.websocket = "";
  }

  function logout() {
    modalStore
      .confirm({
        description: t("confirm.logout"),
        title: "Confirm",
      })
      .then((result: unknown) => {
        if (!toConfirmOk(result)) return;
        const existingStyle = document.getElementById("login-container-style");
        if (existingStyle) {
          existingStyle.remove();
        }
        handleLogoutEvent().catch(logFailure("Logout failed:"));
      })
      .catch(logFailure("Logout confirmation failed:"));
  }

  async function relogin(
    user: StoredCredential,
    { shouldTrackLoginNetworkIssueHint = !attemptingAutoLogin.value }: { shouldTrackLoginNetworkIssueHint?: boolean } = {}
  ) {
    if (user.cookies) {
      await webApiService.setCookies(user.cookies);
    }
    loginForm.value.lastUserLoggedIn = requireUser(user).id;
    const loginParams = requireLoginParams(user);
    if (loginParams.endpoint) {
      AppDebug.endpointDomain = loginParams.endpoint;
      AppDebug.websocketDomain = loginParams.websocket;
    } else {
      AppDebug.endpointDomain = AppDebug.endpointDomainVrchat;
      AppDebug.websocketDomain = AppDebug.websocketDomainVrchat;
    }

    loginForm.value.loading = true;
    try {
      let password = loginParams.password;
      if (shouldTrackLoginNetworkIssueHint) {
        loginNetworkHint.resetIfCredentialsChanged({
          username: loginParams.username,
          password,
          endpoint: loginParams.endpoint,
          websocket: loginParams.websocket,
        });
      }
      if (advancedSettingsStore.enablePrimaryPassword && password) {
        try {
          password = await checkPrimaryPassword(password);
        } catch (err) {
          toast.error(t("message.auth.incorrect_primary_password"));
          throw err;
        }
      }

      await authRequest.getConfig();
      try {
        if (password) {
          await authLogin({
            username: loginParams.username,
            password,
            endpoint: loginParams.endpoint,
            websocket: loginParams.websocket,
          });
        } else {
          attemptingAutoLogin.value = true;
          try {
            await getCurrentUser();
          } finally {
            attemptingAutoLogin.value = false;
          }
        }
      } catch (err) {
        if (shouldTrackLoginNetworkIssueHint && shouldCountLoginFailureForNetworkHint(err)) {
          loginNetworkHint.maybeShow();
        }
        if (errorMessageIncludes(err, "Check your email")) {
          toast.error(t("message.auth.check_your_email"));
        }
        await handleLogoutEvent();
        throw err;
      }
    } catch (err) {
      const status = isRecord(err) ? err["status"] : undefined;
      const isSessionExpired = !loginParams.password && status === 401;
      if (isSessionExpired || errorMessageIncludes(err, "Invalid Username/Email or Password")) {
        toast.error(t("message.auth.saved_credentials_invalid"));
        await deleteSavedLogin(requireUser(user).id);
      }
      throw err;
    } finally {
      loginForm.value.loading = false;
    }
  }

  async function deleteSavedLogin(userId: string) {
    const savedCredentials = await getAllSavedCredentials();
    Reflect.deleteProperty(savedCredentials, userId);

    if (Object.keys(savedCredentials).length === 0) {
      advancedSettingsStore.setEnablePrimaryPassword(false);
      advancedSettingsStore.setEnablePrimaryPasswordConfigRepository(false);
    }
    await configRepository.setString("savedCredentials", JSON.stringify(savedCredentials));
    toast.success(t("message.auth.account_removed"));
  }

  async function login() {
    await webApiService.clearCookies();
    if (!loginForm.value.loading) {
      loginForm.value.loading = true;
      loginNetworkHint.resetIfCredentialsChanged({
        username: loginForm.value.username,
        password: loginForm.value.password,
        endpoint: loginForm.value.endpoint,
        websocket: loginForm.value.websocket,
      });
      if (loginForm.value.endpoint) {
        AppDebug.endpointDomain = loginForm.value.endpoint;
        AppDebug.websocketDomain = loginForm.value.websocket;
      } else {
        AppDebug.endpointDomain = AppDebug.endpointDomainVrchat;
        AppDebug.websocketDomain = AppDebug.websocketDomainVrchat;
      }
      try {
        await authRequest.getConfig();
        if (loginForm.value.saveCredentials && advancedSettingsStore.enablePrimaryPassword) {
          try {
            const { ok, value } = toPromptResult(
              await modalStore.prompt({
                title: t("prompt.primary_password.header"),
                description: t("prompt.primary_password.description"),
                inputType: "password",
                pattern: /[\s\S]{1,32}/,
              })
            );
            if (ok) {
              const savedCredentials = parseStoredCredentials(await configRepository.getString("savedCredentials"));
              const saveCredential = Object.values(savedCredentials).find((credential) => requireLoginParams(credential).password);
              if (saveCredential) {
                await security.decrypt(requireLoginParams(saveCredential).password, value);
              }
              const pwd = toCipherText(await security.encrypt(loginForm.value.password, value));
              try {
                await authLogin({
                  username: loginForm.value.username,
                  password: loginForm.value.password,
                  endpoint: loginForm.value.endpoint,
                  websocket: loginForm.value.websocket,
                  saveCredentials: loginForm.value.saveCredentials,
                  cipher: pwd,
                });
              } catch (err) {
                if (shouldCountLoginFailureForNetworkHint(err)) {
                  loginNetworkHint.maybeShow();
                }
                throw err;
              }
            }
          } catch (err) {
            console.debug("Login with primary password did not complete:", err);
          }
        } else {
          try {
            await authLogin({
              username: loginForm.value.username,
              password: loginForm.value.password,
              endpoint: loginForm.value.endpoint,
              websocket: loginForm.value.websocket,
              saveCredentials: loginForm.value.saveCredentials,
            });
          } catch (err) {
            if (shouldCountLoginFailureForNetworkHint(err)) {
              loginNetworkHint.maybeShow();
            }
            if (errorMessageIncludes(err, "Check your email")) {
              toast.error(t("message.auth.check_your_email"));
            }
            throw err;
          }
        }
      } finally {
        loginForm.value.loading = false;
      }
    }
  }

  function authLogin(params: AuthLoginParams): Promise<AuthLoginResult> {
    let { password } = params;
    const { username, endpoint, websocket, saveCredentials, cipher } = params;
    const auth = btoa(`${encodeURIComponent(username)}:${encodeURIComponent(password)}`);
    if (saveCredentials) {
      params.saveCredentials = false;
      if (cipher) {
        password = cipher;
      }
      credentialsToSave.value = {
        username,
        password,
        endpoint,
        websocket,
      };
    }
    return request("auth/user", {
      method: "GET",
      headers: {
        Authorization: `Basic ${auth}`,
      },
    }).then((json: unknown) => {
      if (!isAuthUserResponse(json)) {
        throw new TypeError("auth/user returned an unexpected body");
      }
      const args = {
        json,
        origin: true,
      };
      handleCurrentUserUpdate(json);
      return args;
    });
  }

  function handleCurrentUserUpdate(json: AuthLoginResult["json"]) {
    if (json.requiresTwoFactorAuth?.includes("emailOtp")) {
      promptEmailOTP();
    } else if (json.requiresTwoFactorAuth) {
      promptTOTP();
    } else {
      runLoginSuccessFlow(json);
    }
  }

  async function handleAutoLogin() {
    const canAutoLogin = await vrcxStore.waitForDatabaseInit();
    if (!canAutoLogin) {
      console.warn("Skipping auto-login because database initialization did not complete successfully.");
      return;
    }
    await runHandleAutoLoginFlow();
  }

  async function applyAutoLoginDelay() {
    if (!generalSettingsStore.autoLoginDelayEnabled) {
      return;
    }
    const seconds = generalSettingsStore.autoLoginDelaySeconds;
    if (!seconds || seconds <= 0) {
      return;
    }
    let toastId: string | number | null = null;
    for (let remaining = seconds; remaining > 0; remaining--) {
      if (toastId) {
        toast.dismiss(toastId);
      }
      toastId = toast.info(
        t("message.auto_login_delay_countdown", {
          seconds: remaining,
        }),
        { duration: Infinity }
      );
      await new Promise<void>((resolve) => {
        workerTimers.setTimeout(resolve, 1000);
      });
    }
    if (toastId) {
      toast.dismiss(toastId);
    }
  }

  async function loginComplete() {
    if (!userStore.currentUser.id) {
      console.error("No current user after login complete, aborting post-login flow.");
      return;
    }
    await database.initUserTables(userStore.currentUser.id);
    advancedSettingsStore.runAvatarAutoCleanup(userStore.currentUser.id).catch(logFailure("Avatar auto cleanup failed:"));
    watchState.isLoggedIn = true;
    AppApi.CheckGameRunning().catch(logFailure("Checking the game state failed:"));

    activityStore.startFullCacheBuild(userStore.currentUser.id).catch(logFailure("Building the activity cache failed:"));
  }

  function setCachedConfig(value: CachedConfig) {
    cachedConfig.value = value;
  }

  function setAttemptingAutoLogin(isAttempting: boolean) {
    attemptingAutoLogin.value = isAttempting;
  }

  async function getPermissions() {
    await authRequest.getPermissions();
  }

  return {
    autoLoginAttempts,
    loginForm,
    enablePrimaryPasswordDialog,
    credentialsToSave,
    twoFactorAuthDialogVisible,
    cachedConfig,
    cachedPermissions,
    enableCustomEndpoint,
    attemptingAutoLogin,

    clearCookiesTryLogin,
    resendEmail2fa,
    enablePrimaryPasswordChange,
    setPrimaryPassword,
    updateStoredUser,
    queueSaveCredentials,
    migrateStoredUsers,
    checkPrimaryPassword,
    autoLoginAfterMounted,
    toggleCustomEndpoint,
    logout,
    relogin,
    deleteSavedLogin,
    login,
    handleAutoLogin,
    handleLogoutEvent,
    handleCurrentUserUpdate,
    loginComplete,
    getAllSavedCredentials,
    getSavedCredentials,
    setCachedConfig,
    setAttemptingAutoLogin,
    getPermissions,
  };
});
