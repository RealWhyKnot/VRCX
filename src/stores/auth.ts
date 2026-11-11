import { reactive, ref, watch } from "vue";
import { defineStore } from "pinia";
import { toast } from "vue-sonner";
import { useI18n } from "vue-i18n";

import Noty from "noty";

import { runLoginSuccessFlow, runLogoutFlow } from "../coordinators/auth-coordinator";
import { AppDebug } from "../services/app-config";
import { authRequest } from "../api/auth";
import { database } from "../services/database";
import { escapeTag } from "../shared/utils/base/string";
import { links } from "../shared/constants/link";
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

export const useAuthStore = defineStore("Auth", () => {
  const advancedSettingsStore = useAdvancedSettingsStore();
  const generalSettingsStore = useGeneralSettingsStore();
  const userStore = useUserStore();
  const updateLoopStore = useUpdateLoopStore();
  const modalStore = useModalStore();
  const vrcxStore = useVrcxStore();
  const activityStore = useActivityStore();

  const { t } = useI18n();
  const autoLoginAttempts = ref(new Set());

  const loginForm = ref({
    loading: false,
    username: "",
    password: "",
    endpoint: "",
    websocket: "",
    saveCredentials: true,
    lastUserLoggedIn: "",
  });

  const enablePrimaryPasswordDialog = ref({
    visible: false,
    password: "",
    rePassword: "",
    beforeClose(done) {
      done();
    },
  });

  const credentialsToSave = ref(null);

  const twoFactorAuthDialogVisible = ref(false);

  const cachedConfig = ref({});

  const cachedPermissions = ref({
    maxUserStickers: 18,
    maxUserEmoji: 18,
    maxUserGallery: 64,
    maxUserIcons: 18,
    maxUserPrints: 64,
  });

  const enableCustomEndpoint = ref(false);

  const attemptingAutoLogin = ref(false);
  const loginNetworkIssueHintState = reactive({
    hinted: false,
    timestamps: [],
    lastAttemptFingerprint: "",
  });
  const loginNetworkIssueHintToastId = ref(null);
  const loginNetworkIssueHintWindowMs = 90000;
  const loginNetworkIssueHintThreshold = 3;

  watch(
    [() => watchState.isLoggedIn, () => userStore.currentUser],
    ([isLoggedIn, currentUser]) => {
      twoFactorAuthDialogVisible.value = false;
      if (isLoggedIn) {
        resetLoginNetworkIssueHintState();
        updateStoredUser(currentUser);
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

  watch([() => loginForm.value.username, () => loginForm.value.password], resetLoginNetworkIssueHintState);

  watch(
    () => watchState.isFriendsLoaded,
    (isFriendsLoaded) => {
      if (isFriendsLoaded) {
        initWebsocket();
        AppApi.IPCAnnounceStart();
      }
    },
    { flush: "sync" }
  );

  async function init() {
    const [lastUserLoggedIn, savedEnableCustomEndpoint] = await Promise.all([
      configRepository.getString("lastUserLoggedIn", ""),
      configRepository.getBool("VRCX_enableCustomEndpoint", false),
    ]);
    loginForm.value.lastUserLoggedIn = lastUserLoggedIn;
    enableCustomEndpoint.value = savedEnableCustomEndpoint;
  }

  init();

  async function getAllSavedCredentials() {
    let savedCredentials = {};
    try {
      savedCredentials = JSON.parse(await configRepository.getString("savedCredentials", "{}"));
      let edited = false;
      for (const userId in savedCredentials) {
        if (savedCredentials[userId].loginParmas) {
          savedCredentials[userId].loginParams = savedCredentials[userId].loginParmas;
          delete savedCredentials[userId].loginParmas;
          edited = true;
        }

        if (!savedCredentials[userId].loginParams.endpoint) {
          savedCredentials[userId].loginParams.endpoint = "";
          edited = true;
        }
        if (!savedCredentials[userId].loginParams.websocket) {
          savedCredentials[userId].loginParams.websocket = "";
          edited = true;
        }
      }
      if (edited) {
        await configRepository.setString("savedCredentials", JSON.stringify(savedCredentials));
      }
    } catch (e) {
      console.error("Failed to get saved credentials:", e);
    }
    return savedCredentials;
  }

  async function getSavedCredentials(userId) {
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
        AppDebug.websocketDomain = user.loginParams.websocket;
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
        }).then(() => {
          toast.success(t("message.auth.email_2fa_resent"));
        });
        return;
      }
    }
    toast.error(t("message.auth.email_2fa_no_credentials"));
  }

  function resetLoginNetworkIssueHintState() {
    if (loginNetworkIssueHintToastId.value) {
      toast.dismiss(loginNetworkIssueHintToastId.value);
      loginNetworkIssueHintToastId.value = null;
    }
    loginNetworkIssueHintState.hinted = false;
    loginNetworkIssueHintState.timestamps = [];
    loginNetworkIssueHintState.lastAttemptFingerprint = "";
  }

  function buildLoginNetworkIssueAttemptFingerprint(params = {}) {
    return [params.username ?? "", params.password ?? "", params.endpoint ?? "", params.websocket ?? ""].join("\u0000");
  }

  function resetLoginNetworkIssueHintStateIfCredentialsChanged(params) {
    const fingerprint = buildLoginNetworkIssueAttemptFingerprint(params);
    if (loginNetworkIssueHintState.lastAttemptFingerprint && loginNetworkIssueHintState.lastAttemptFingerprint !== fingerprint) {
      resetLoginNetworkIssueHintState();
    }
    loginNetworkIssueHintState.lastAttemptFingerprint = fingerprint;
  }

  function shouldCountLoginFailureForNetworkHint(err) {
    if (!err || err.endpoint !== "auth/user") {
      return false;
    }
    if (typeof err.message === "string" && err.message.includes("Invalid Username/Email or Password")) {
      return false;
    }
    return [401].includes(err.status);
  }

  function maybeShowLoginNetworkIssueHint() {
    const now = Date.now();
    loginNetworkIssueHintState.timestamps = loginNetworkIssueHintState.timestamps.filter((timestamp) => timestamp > now - loginNetworkIssueHintWindowMs);
    loginNetworkIssueHintState.timestamps.push(now);
    if (loginNetworkIssueHintState.hinted || loginNetworkIssueHintState.timestamps.length < loginNetworkIssueHintThreshold) {
      return;
    }
    loginNetworkIssueHintState.hinted = true;
    loginNetworkIssueHintToastId.value = toast.warning(t("message.auth.login_network_issue_hint_title"), {
      description: t("message.auth.login_network_issue_hint_description"),
      duration: Infinity,
      action: {
        label: t("common.actions.open"),
        onClick: () => AppApi.OpenLink(links.troubleshootingAuthUserConnectionIssues),
      },
    });
  }

  function enablePrimaryPasswordChange() {
    advancedSettingsStore.setEnablePrimaryPassword(!advancedSettingsStore.enablePrimaryPassword);

    enablePrimaryPasswordDialog.value.password = "";
    enablePrimaryPasswordDialog.value.rePassword = "";
    if (advancedSettingsStore.enablePrimaryPassword) {
      enablePrimaryPasswordDialog.value.visible = true;
    } else {
      modalStore
        .prompt({
          title: t("prompt.primary_password.header"),
          description: t("prompt.primary_password.description"),
          inputType: "password",
          pattern: /[\s\S]{1,32}/,
        })
        .then(async ({ ok, value }) => {
          if (!ok) {
            advancedSettingsStore.setEnablePrimaryPassword(true);
            advancedSettingsStore.setEnablePrimaryPasswordConfigRepository(true);
            return;
          }

          const savedCredentials = JSON.parse(await configRepository.getString("savedCredentials", "{}"));
          for (const userId in savedCredentials) {
            if (!savedCredentials[userId].loginParams.password) continue;
            security
              .decrypt(savedCredentials[userId].loginParams.password, value)
              .then(async (pt) => {
                credentialsToSave.value = {
                  username: savedCredentials[userId].loginParams.username,
                  password: pt,
                };
                await updateStoredUser(savedCredentials[userId].user);
                await configRepository.setBool("enablePrimaryPassword", false);
              })
              .catch(async () => {
                advancedSettingsStore.setEnablePrimaryPassword(true);
                advancedSettingsStore.setEnablePrimaryPasswordConfigRepository(true);
              });
          }
        })
        .catch((err) => {
          console.error(err);
          advancedSettingsStore.setEnablePrimaryPassword(true);
          advancedSettingsStore.setEnablePrimaryPasswordConfigRepository(true);
        });
    }
  }
  async function setPrimaryPassword() {
    await configRepository.setBool("enablePrimaryPassword", advancedSettingsStore.enablePrimaryPassword);
    enablePrimaryPasswordDialog.value.visible = false;
    if (advancedSettingsStore.enablePrimaryPassword) {
      const key = enablePrimaryPasswordDialog.value.password;
      const savedCredentials = await getAllSavedCredentials();
      for (const userId in savedCredentials) {
        if (!savedCredentials[userId].loginParams.password) continue;
        security.encrypt(savedCredentials[userId].loginParams.password, key).then((ct) => {
          credentialsToSave.value = {
            username: savedCredentials[userId].loginParams.username,
            password: ct,
          };
          updateStoredUser(savedCredentials[userId].user);
        });
      }
    }
  }

  async function updateStoredUser(user) {
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
    } else if (typeof savedCredentials[user.id] !== "undefined") {
      savedCredentials[user.id].user = user;
      savedCredentials[user.id].cookies = await webApiService.getCookies();
    }
    const jsonCredentialsArray = JSON.stringify(savedCredentials);
    await configRepository.setString("savedCredentials", jsonCredentialsArray);
    loginForm.value.lastUserLoggedIn = user.id;
    await configRepository.setString("lastUserLoggedIn", user.id);
  }

  function queueSaveCredentials() {
    if (loginForm.value.saveCredentials) {
      credentialsToSave.value = {};
    }
  }

  async function migrateStoredUsers() {
    const savedCredentials = await getAllSavedCredentials();
    for (const name in savedCredentials) {
      const userId = savedCredentials[name]?.user?.id;
      if (userId && userId !== name) {
        savedCredentials[userId] = savedCredentials[name];
        delete savedCredentials[name];
      }
    }
    await configRepository.setString("savedCredentials", JSON.stringify(savedCredentials));
  }

  function checkPrimaryPassword(args) {
    return new Promise((resolve, reject) => {
      if (!advancedSettingsStore.enablePrimaryPassword) {
        resolve(args.password);
        return;
      }
      modalStore
        .prompt({
          title: t("prompt.primary_password.header"),
          description: t("prompt.primary_password.description"),
          inputType: "password",
          pattern: /[\s\S]{1,32}/,
        })
        .then(({ ok, value }) => {
          if (!ok) {
            reject(new Error("primary password prompt cancelled"));
            return;
          }
          security.decrypt(args.password, value).then(resolve).catch(reject);
        })
        .catch(reject);
    });
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
      .then(({ ok }) => {
        if (!ok) return;
        const existingStyle = document.getElementById("login-container-style");
        if (existingStyle) {
          existingStyle.parentNode.removeChild(existingStyle);
        }
        handleLogoutEvent();
      })
      .catch(() => {});
  }

  async function relogin(user, { shouldTrackLoginNetworkIssueHint = !attemptingAutoLogin.value } = {}) {
    const { loginParams } = user;
    if (user.cookies) {
      await webApiService.setCookies(user.cookies);
    }
    loginForm.value.lastUserLoggedIn = user.user.id;
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
        resetLoginNetworkIssueHintStateIfCredentialsChanged({
          username: loginParams.username,
          password,
          endpoint: loginParams.endpoint,
          websocket: loginParams.websocket,
        });
      }
      if (advancedSettingsStore.enablePrimaryPassword && password) {
        try {
          password = await checkPrimaryPassword(loginParams);
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
          maybeShowLoginNetworkIssueHint();
        }
        if (err.message.includes("Check your email")) {
          toast.error(t("message.auth.check_your_email"));
        }
        await handleLogoutEvent();
        throw err;
      }
    } catch (err) {
      const sessionExpired = !loginParams.password && err.status === 401;
      if (sessionExpired || err.message.includes("Invalid Username/Email or Password")) {
        toast.error(t("message.auth.saved_credentials_invalid"));
        await deleteSavedLogin(user.user.id);
      }
      throw err;
    } finally {
      loginForm.value.loading = false;
    }
  }

  async function deleteSavedLogin(userId) {
    const savedCredentials = await getAllSavedCredentials();
    delete savedCredentials[userId];

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
      resetLoginNetworkIssueHintStateIfCredentialsChanged({
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
            const { ok, value } = await modalStore.prompt({
              title: t("prompt.primary_password.header"),
              description: t("prompt.primary_password.description"),
              inputType: "password",
              pattern: /[\s\S]{1,32}/,
            });
            if (ok) {
              const savedCredentials = JSON.parse(await configRepository.getString("savedCredentials"));
              const saveCredential = Object.values(savedCredentials).find((credential) => credential.loginParams.password);
              if (saveCredential) {
                await security.decrypt(saveCredential.loginParams.password, value);
              }
              const pwd = await security.encrypt(loginForm.value.password, value);
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
                  maybeShowLoginNetworkIssueHint();
                }
                throw err;
              }
            }
          } catch {}
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
              maybeShowLoginNetworkIssueHint();
            }
            if (err.message.includes("Check your email")) {
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

  function promptTOTP() {
    if (twoFactorAuthDialogVisible.value) {
      return;
    }
    AppApi.FlashWindow();
    twoFactorAuthDialogVisible.value = true;
    modalStore
      .otpPrompt({
        title: t("prompt.totp.header"),
        description: t("prompt.totp.description"),
        mode: "totp",
        cancelText: t("prompt.totp.use_otp"),
        confirmText: t("prompt.totp.verify"),
      })
      .then(({ ok, reason, value }) => {
        twoFactorAuthDialogVisible.value = false;

        if (reason === "cancel") {
          promptOTP();
          return;
        }
        if (!ok) return;

        authRequest
          .verifyTOTP({
            code: value.trim(),
          })
          .catch((err) => {
            console.error(err);
            clearCookiesTryLogin();
          })
          .then(() => {
            getCurrentUser();
          });
      })
      .catch(() => {
        twoFactorAuthDialogVisible.value = false;
      });
  }

  function promptOTP() {
    if (twoFactorAuthDialogVisible.value) {
      return;
    }
    twoFactorAuthDialogVisible.value = true;
    modalStore
      .otpPrompt({
        title: t("prompt.otp.header"),
        description: t("prompt.otp.description"),
        mode: "otp",
        cancelText: t("prompt.otp.use_totp"),
        confirmText: t("prompt.otp.verify"),
      })
      .then(({ ok, reason, value }) => {
        twoFactorAuthDialogVisible.value = false;

        if (reason === "cancel") {
          promptTOTP();
          return;
        }
        if (!ok) return;

        authRequest
          .verifyOTP({
            code: `${value.slice(0, 4)}-${value.slice(4)}`,
          })
          .catch((err) => {
            console.error(err);
            clearCookiesTryLogin();
          })
          .then(() => {
            getCurrentUser();
          });
      })
      .catch(() => {
        twoFactorAuthDialogVisible.value = false;
      });
  }

  function promptEmailOTP() {
    if (twoFactorAuthDialogVisible.value) {
      return;
    }
    AppApi.FlashWindow();
    twoFactorAuthDialogVisible.value = true;
    modalStore
      .otpPrompt({
        title: t("prompt.email_otp.header"),
        description: t("prompt.email_otp.description"),
        mode: "emailOtp",
        cancelText: t("prompt.email_otp.resend"),
        confirmText: t("prompt.email_otp.verify"),
      })
      .then(({ ok, reason, value }) => {
        twoFactorAuthDialogVisible.value = false;

        if (reason === "cancel") {
          resendEmail2fa();
          return;
        }
        if (!ok) return;

        authRequest
          .verifyEmailOTP({
            code: value.trim(),
          })
          .catch((err) => {
            console.error(err);
            promptEmailOTP();
          })
          .then(() => {
            getCurrentUser();
          });
      })
      .catch(() => {
        twoFactorAuthDialogVisible.value = false;
      });
  }

  function authLogin(params) {
    let { username, password, endpoint, websocket, saveCredentials, cipher } = params;
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
    }).then((json) => {
      const args = {
        json,
        origin: true,
      };
      handleCurrentUserUpdate(json);
      return args;
    });
  }

  function handleCurrentUserUpdate(json) {
    if (json.requiresTwoFactorAuth && json.requiresTwoFactorAuth.includes("emailOtp")) {
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
    let toastId = null;
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
      await new Promise((resolve) => {
        workerTimers.setTimeout(resolve, 1000);
      });
    }
    if (toastId) {
      toast.dismiss(toastId);
    }
  }

  async function loginComplete() {
    if (!userStore.currentUser?.id) {
      console.error("No current user after login complete, aborting post-login flow.");
      return;
    }
    await database.initUserTables(userStore.currentUser.id);
    advancedSettingsStore.runAvatarAutoCleanup(userStore.currentUser.id);
    watchState.isLoggedIn = true;
    AppApi.CheckGameRunning();

    activityStore.startFullCacheBuild(userStore.currentUser.id);
  }

  function setCachedConfig(value) {
    cachedConfig.value = value;
  }

  function setAttemptingAutoLogin(value) {
    attemptingAutoLogin.value = value;
  }

  async function getPermissions() {
    const permissions = await authRequest.getPermissions();
    if (permissions["permission-user-stickers"]?.max) {
      cachedPermissions.value.maxUserStickers = permissions["permission-user-stickers"].max;
    }
    if (permissions["permission-user-emoji"]?.max) {
      cachedPermissions.value.maxUserEmoji = permissions["permission-user-emoji"].max;
    }
    if (permissions["permission-user-gallery"]?.max) {
      cachedPermissions.value.maxUserGallery = permissions["permission-user-gallery"].max;
    }
    if (permissions["permission-user-icons"]?.max) {
      cachedPermissions.value.maxUserIcons = permissions["permission-user-icons"].max;
    }
    if (permissions["permission-user-prints"]?.max) {
      cachedPermissions.value.maxUserPrints = permissions["permission-user-prints"].max;
    }
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
