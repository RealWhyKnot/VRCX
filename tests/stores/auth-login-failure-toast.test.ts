import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { Mock } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { nextTick, reactive } from "vue";

import { links } from "../../src/shared/constants/link";
import { createCurrentUserState } from "../../src/stores/user-state";

type AnyFn = (...args: unknown[]) => unknown;

type WarningOptions = {
  description: string;
  duration: number;
  action: { label: string; onClick: () => void };
};

type AuthError = Error & { status: number; endpoint: string };

type LoginParamsOverrides = Partial<{ username: string; password: string; endpoint: string; websocket: string }>;

const mockWatchState = reactive({
  isLoggedIn: false,
  isFriendsLoaded: false,
  isFavoritesLoaded: false,
});

const mocks = vi.hoisted(() => ({
  toast: {
    dismiss: vi.fn<AnyFn>(),
    error: vi.fn<AnyFn>(),
    info: vi.fn<AnyFn>(),
    success: vi.fn<AnyFn>(),
    warning: vi.fn<(message: string, options: WarningOptions) => string>(),
  },
  request: vi.fn<AnyFn>(),
  authRequest: {
    getConfig: vi.fn<AnyFn>(),
  },
  runLoginSuccessFlow: vi.fn<AnyFn>(),
  runLogoutFlow: vi.fn<AnyFn>(),
  runHandleAutoLoginFlow: vi.fn<AnyFn>(),
  getCurrentUser: vi.fn<AnyFn>(),
  initWebsocket: vi.fn<AnyFn>(),
  advancedSettingsStore: {
    enablePrimaryPassword: false,
    setEnablePrimaryPassword: vi.fn<AnyFn>(),
    setEnablePrimaryPasswordConfigRepository: vi.fn<AnyFn>(),
    runAvatarAutoCleanup: vi.fn<AnyFn>(),
  },
  generalSettingsStore: {
    autoLoginDelayEnabled: false,
    autoLoginDelaySeconds: 0,
  },
  modalStore: {
    prompt: vi.fn<AnyFn>(),
    otpPrompt: vi.fn<AnyFn>(),
    confirm: vi.fn<AnyFn>(),
    alert: vi.fn<AnyFn>(),
  },
  updateLoopStore: {
    setNextCurrentUserRefresh: vi.fn<AnyFn>(),
    setIpcTimeout: vi.fn<AnyFn>(),
  },
  userStore: {
    currentUser: {
      id: "usr_me",
      displayName: "Tester",
    },
    setUserDialogVisible: vi.fn<AnyFn>(),
  },
  vrcxStore: {
    waitForDatabaseInit: vi.fn<AnyFn>().mockResolvedValue(true),
  },
  configRepository: {
    getString: vi.fn<AnyFn>(),
    getBool: vi.fn<AnyFn>(),
    setString: vi.fn<AnyFn>(),
    setBool: vi.fn<AnyFn>(),
    remove: vi.fn<AnyFn>(),
  },
  webApiService: {
    clearCookies: vi.fn<AnyFn>().mockResolvedValue(undefined),
    getCookies: vi.fn<AnyFn>().mockResolvedValue([]),
    setCookies: vi.fn<AnyFn>().mockResolvedValue(undefined),
  },
  security: {
    encrypt: vi.fn<AnyFn>(),
    decrypt: vi.fn<AnyFn>(),
  },
  notyShow: vi.fn<AnyFn>(),
  appDebug: {
    endpointDomain: "",
    websocketDomain: "",
    endpointDomainVrchat: "https://vrchat.com",
    websocketDomainVrchat: "wss://pubsub.vrchat.com",
    errorNoty: null,
  },
}));

vi.mock("vue-sonner", () => ({
  toast: mocks.toast,
}));

vi.mock("noty", () => ({
  default: class NotyMock {
    show(...args: unknown[]) {
      mocks.notyShow(...args);
    }
  },
}));

vi.mock("vue-i18n", () => ({
  useI18n: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("../../src/services/request", () => ({
  request: (...args: unknown[]) => mocks.request(...args),
}));

vi.mock("../../src/api/auth", () => ({
  authRequest: mocks.authRequest,
}));

vi.mock("../../src/coordinators/auth-coordinator", () => ({
  runLoginSuccessFlow: (...args: unknown[]) => mocks.runLoginSuccessFlow(...args),
  runLogoutFlow: (...args: unknown[]) => mocks.runLogoutFlow(...args),
}));

vi.mock("../../src/coordinators/auth-auto-login-coordinator", () => ({
  runHandleAutoLoginFlow: (...args: unknown[]) => mocks.runHandleAutoLoginFlow(...args),
}));

vi.mock("../../src/coordinators/user-coordinator", () => ({
  getCurrentUser: (...args: unknown[]) => mocks.getCurrentUser(...args),
}));

vi.mock("../../src/services/app-config", () => ({
  AppDebug: mocks.appDebug,
  isApiLogSuppressed: vi.fn<AnyFn>(() => true),
  logWebRequest: vi.fn<AnyFn>(),
}));

vi.mock("../../src/shared/utils/base/string", () => ({
  escapeTag: (value: string) => value,
}));

vi.mock("../../src/services/database", () => ({
  database: new Proxy(
    {},
    {
      get: (_target, prop: string | symbol) => {
        if (prop === "__esModule") return false;
        return vi.fn<AnyFn>().mockResolvedValue(undefined);
      },
    }
  ),
}));

vi.mock("../../src/services/security", () => ({
  security: mocks.security,
}));

vi.mock("../../src/services/webapi", () => ({
  webApiService: mocks.webApiService,
}));

vi.mock("../../src/services/watch-state", () => ({
  watchState: mockWatchState,
}));

vi.mock("../../src/services/config", () => ({
  configRepository: mocks.configRepository,
}));

vi.mock("../../src/services/websocket", () => ({
  initWebsocket: (...args: unknown[]) => mocks.initWebsocket(...args),
  closeWebSocket: vi.fn<AnyFn>(),
}));

vi.mock("../../src/stores/settings/advanced", () => ({
  useAdvancedSettingsStore: () => mocks.advancedSettingsStore,
}));

vi.mock("../../src/stores/settings/general", () => ({
  useGeneralSettingsStore: () => mocks.generalSettingsStore,
}));

vi.mock("../../src/stores/modal", () => ({
  useModalStore: () => mocks.modalStore,
}));

vi.mock("../../src/stores/update-loop", () => ({
  useUpdateLoopStore: () => mocks.updateLoopStore,
}));

vi.mock("../../src/stores/user", () => ({
  useUserStore: () => mocks.userStore,
}));

vi.mock("../../src/stores/vrcx", () => ({
  useVrcxStore: () => mocks.vrcxStore,
}));

vi.mock("worker-timers", () => ({
  setTimeout: vi.fn<AnyFn>(),
}));

function flushPromises(): Promise<void> {
  return Promise.resolve().then(() => Promise.resolve());
}

function makeAuthError(message: string, status = 401): AuthError {
  return Object.assign(new Error(message), { status, endpoint: "auth/user" });
}

async function createAuthStore() {
  setActivePinia(createPinia());
  const { useAuthStore } = await import("../../src/stores/auth");
  const store = useAuthStore();
  await flushPromises();
  return store;
}

type AuthStore = Awaited<ReturnType<typeof createAuthStore>>;

async function settle(promise: Promise<unknown>): Promise<void> {
  await promise.then(
    () => undefined,
    (err: unknown) => {
      expect(err).toBeInstanceOf(Error);
    }
  );
}

async function failManualLogin(store: AuthStore, error: AuthError) {
  mocks.authRequest.getConfig.mockResolvedValueOnce({ json: {} });
  mocks.request.mockRejectedValueOnce(error);
  await settle(store.login());
  await flushPromises();
}

async function failSavedAccountLogin(store: AuthStore, error: AuthError, overrides: LoginParamsOverrides = {}) {
  const savedUser = {
    user: { ...createCurrentUserState(), id: "usr_saved", displayName: "Saved User" },
    loginParams: {
      username: "saved@example.com",
      password: "password",
      endpoint: "",
      websocket: "",
      ...overrides,
    },
  };
  mocks.authRequest.getConfig.mockResolvedValueOnce({ json: {} });
  mocks.request.mockRejectedValueOnce(error);
  await settle(store.relogin(savedUser));
  await flushPromises();
}

async function succeedManualLogin(store: AuthStore) {
  mocks.authRequest.getConfig.mockResolvedValueOnce({ json: {} });
  mocks.request.mockResolvedValueOnce({
    id: "usr_me",
    displayName: "Tester",
  });
  await settle(store.login());
  mockWatchState.isLoggedIn = true;
  await nextTick();
  await flushPromises();
}

describe("useAuthStore login failure toast policy", () => {
  let appApi: { CheckGameRunning: Mock<AnyFn>; FlashWindow: Mock<AnyFn>; IPCAnnounceStart: Mock<AnyFn>; OpenLink: Mock<AnyFn> };

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-23T00:00:00.000Z"));
    vi.clearAllMocks();

    mocks.configRepository.getString.mockImplementation((_key: unknown, defaultValue: unknown = "") => Promise.resolve(defaultValue));
    mocks.configRepository.getBool.mockImplementation((_key: unknown, defaultValue: unknown = false) => Promise.resolve(defaultValue));
    mocks.configRepository.setString.mockResolvedValue(undefined);
    mocks.configRepository.setBool.mockResolvedValue(undefined);
    mocks.configRepository.remove.mockResolvedValue(undefined);
    mocks.authRequest.getConfig.mockResolvedValue({ json: {} });
    mocks.request.mockReset();
    mocks.request.mockResolvedValue({});
    mocks.toast.warning.mockReturnValue("login-network-issue-toast");
    mocks.runLoginSuccessFlow.mockReset();
    mocks.runLogoutFlow.mockReset();
    mocks.runHandleAutoLoginFlow.mockReset();
    mocks.getCurrentUser.mockReset();
    mocks.initWebsocket.mockReset();
    mocks.notyShow.mockReset();
    mocks.toast.warning.mockReset();
    mocks.toast.warning.mockReturnValue("login-network-issue-toast");
    mocks.toast.success.mockReset();
    mocks.toast.error.mockReset();
    mocks.toast.info.mockReset();
    mocks.toast.dismiss.mockReset();
    mocks.advancedSettingsStore.enablePrimaryPassword = false;
    mockWatchState.isLoggedIn = false;
    mockWatchState.isFriendsLoaded = false;
    mockWatchState.isFavoritesLoaded = false;
    mocks.userStore.currentUser = {
      id: "usr_me",
      displayName: "Tester",
    };
    mocks.vrcxStore.waitForDatabaseInit.mockResolvedValue(true);

    appApi = {
      CheckGameRunning: vi.fn<AnyFn>(),
      FlashWindow: vi.fn<AnyFn>(),
      IPCAnnounceStart: vi.fn<AnyFn>(),
      OpenLink: vi.fn<AnyFn>(),
    };
    vi.stubGlobal("AppApi", appApi);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  test("shows a single warning toast on the third manual login failure inside 90 seconds", async () => {
    const store = await createAuthStore();
    store.loginForm.username = "tester@example.com";
    store.loginForm.password = "password";

    await failManualLogin(store, makeAuthError("Unauthorized", 401));
    vi.setSystemTime(new Date("2026-03-23T00:00:30.000Z"));
    await failManualLogin(store, makeAuthError("Unauthorized", 401));

    expect(mocks.toast.warning).not.toHaveBeenCalled();

    vi.setSystemTime(new Date("2026-03-23T00:01:00.000Z"));
    await failManualLogin(store, makeAuthError("Unauthorized", 401));

    expect(mocks.toast.warning).toHaveBeenCalledTimes(1);
    expect(mocks.toast.warning).toHaveBeenCalledWith(
      "message.auth.login_network_issue_hint_title",
      expect.objectContaining({
        description: "message.auth.login_network_issue_hint_description",
        duration: Infinity,
      })
    );
    const warningCall = mocks.toast.warning.mock.calls[0];
    expect(warningCall).toBeDefined();
    expect(warningCall?.[1].action.label).toBe("common.actions.open");
    warningCall?.[1].action.onClick();
    expect(appApi.OpenLink).toHaveBeenCalledWith(links.troubleshootingAuthUserConnectionIssues);
  });

  test("does not count explicit password errors toward the warning threshold", async () => {
    const store = await createAuthStore();
    store.loginForm.username = "tester@example.com";
    store.loginForm.password = "password";

    await failManualLogin(store, makeAuthError("Unauthorized", 401));
    vi.setSystemTime(new Date("2026-03-23T00:00:20.000Z"));
    await failManualLogin(store, makeAuthError("Unauthorized", 401));
    vi.setSystemTime(new Date("2026-03-23T00:00:40.000Z"));
    await failManualLogin(store, makeAuthError("Invalid Username/Email or Password", 401));

    expect(mocks.toast.warning).not.toHaveBeenCalled();
  });

  test("does not trigger the warning during auto-login retries", async () => {
    const store = await createAuthStore();
    store.setAttemptingAutoLogin(true);

    const savedUser = {
      user: { ...createCurrentUserState(), id: "usr_me", displayName: "Tester" },
      loginParams: {
        username: "tester@example.com",
        password: "password",
        endpoint: "",
        websocket: "",
      },
    };

    mocks.authRequest.getConfig.mockResolvedValue({ json: {} });
    mocks.request.mockRejectedValueOnce(makeAuthError("Unauthorized", 401));
    await settle(store.relogin(savedUser));
    await flushPromises();

    expect(mocks.toast.warning).not.toHaveBeenCalled();
    expect(mocks.runHandleAutoLoginFlow).not.toHaveBeenCalled();
  });

  test("counts saved-account relogin failures together with manual login failures", async () => {
    const store = await createAuthStore();
    store.loginForm.username = "tester@example.com";
    store.loginForm.password = "password";

    await failManualLogin(store, makeAuthError("Unauthorized", 401));
    vi.setSystemTime(new Date("2026-03-23T00:00:30.000Z"));
    await failSavedAccountLogin(store, makeAuthError("Unauthorized", 401), {
      username: "tester@example.com",
    });

    expect(mocks.toast.warning).not.toHaveBeenCalled();

    vi.setSystemTime(new Date("2026-03-23T00:01:00.000Z"));
    await failManualLogin(store, makeAuthError("Unauthorized", 401));

    expect(mocks.toast.warning).toHaveBeenCalledTimes(1);
  });

  test("resets the failure window after a successful login", async () => {
    const store = await createAuthStore();
    store.loginForm.username = "tester@example.com";
    store.loginForm.password = "password";

    await failManualLogin(store, makeAuthError("Unauthorized", 401));
    vi.setSystemTime(new Date("2026-03-23T00:00:30.000Z"));
    await failManualLogin(store, makeAuthError("Unauthorized", 401));
    vi.setSystemTime(new Date("2026-03-23T00:01:00.000Z"));
    await failManualLogin(store, makeAuthError("Unauthorized", 401));

    expect(mocks.toast.warning).toHaveBeenCalledTimes(1);

    vi.setSystemTime(new Date("2026-03-23T00:01:05.000Z"));
    await succeedManualLogin(store);
    expect(mocks.toast.dismiss).toHaveBeenCalledWith("login-network-issue-toast");

    mocks.toast.warning.mockClear();
    mocks.toast.dismiss.mockClear();

    mockWatchState.isLoggedIn = false;
    await nextTick();

    vi.setSystemTime(new Date("2026-03-23T00:01:10.000Z"));
    await failManualLogin(store, makeAuthError("Unauthorized", 401));
    vi.setSystemTime(new Date("2026-03-23T00:01:30.000Z"));
    await failManualLogin(store, makeAuthError("Unauthorized", 401));

    expect(mocks.toast.warning).not.toHaveBeenCalled();
  });

  test("resets the failure window when the user edits the login form", async () => {
    const store = await createAuthStore();
    store.loginForm.username = "tester@example.com";
    store.loginForm.password = "password";

    await failManualLogin(store, makeAuthError("Unauthorized", 401));
    vi.setSystemTime(new Date("2026-03-23T00:00:20.000Z"));
    await failManualLogin(store, makeAuthError("Unauthorized", 401));
    expect(mocks.toast.warning).not.toHaveBeenCalled();

    store.loginForm.username = "tester2@example.com";
    await nextTick();

    vi.setSystemTime(new Date("2026-03-23T00:00:35.000Z"));
    await failManualLogin(store, makeAuthError("Unauthorized", 401));

    expect(mocks.toast.warning).not.toHaveBeenCalled();
  });

  test("dismisses the sticky warning when credentials change before the next submit", async () => {
    const store = await createAuthStore();
    store.loginForm.username = "tester@example.com";
    store.loginForm.password = "password";

    await failManualLogin(store, makeAuthError("Unauthorized", 401));
    vi.setSystemTime(new Date("2026-03-23T00:00:30.000Z"));
    await failManualLogin(store, makeAuthError("Unauthorized", 401));
    vi.setSystemTime(new Date("2026-03-23T00:01:00.000Z"));
    await failManualLogin(store, makeAuthError("Unauthorized", 401));

    expect(mocks.toast.warning).toHaveBeenCalledTimes(1);

    store.loginForm.password = "new-password";
    vi.setSystemTime(new Date("2026-03-23T00:01:10.000Z"));
    await failManualLogin(store, makeAuthError("Unauthorized", 401));

    expect(mocks.toast.dismiss).toHaveBeenCalledWith("login-network-issue-toast");
    expect(mocks.toast.warning).toHaveBeenCalledTimes(1);
  });
});
