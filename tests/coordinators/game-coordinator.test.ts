import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import * as workerTimers from "worker-timers";

const mocks = vi.hoisted(() => ({
  userStore: {
    currentUser: {
      $online_for: 1000,
      currentAvatar: "avtr_test",
    },
    markCurrentUserGameStarted: vi.fn(),
    markCurrentUserGameStopped: vi.fn(),
  },
  gameStore: {
    isGameNoVR: false,
    state: { lastCrashedTime: null },
    setLastCrashedTime: vi.fn(),
    setLastSession: vi.fn(),
    setIsGameRunning: vi.fn(),
    isGameRunning: false,
    setIsSteamVRRunning: vi.fn(),
    isSteamVRRunning: false,
  },
  instanceStore: {
    removeAllQueuedInstances: vi.fn(),
  },
  updateLoopStore: {
    setIpcTimeout: vi.fn(),
    setNextDiscordUpdate: vi.fn(),
  },
  gameLogStore: {
    clearNowPlaying: vi.fn(),
    resetNowPlayingProducers: vi.fn(),
  },
  launchStore: {
    launchGame: vi.fn().mockResolvedValue(undefined),
  },
  locationStore: {
    lastLocation: { location: "", playerList: { size: 0 } },
  },
  vrStore: {
    updateVRLastLocation: vi.fn(),
    updateOpenVR: vi.fn(),
  },
  advancedSettingsStore: {
    autoSweepVRChatCache: false,
    relaunchVRChatAfterCrash: false,
    gameLogDisabled: false,
  },
  configRepository: {
    setBool: vi.fn().mockResolvedValue(undefined),
    setString: vi.fn().mockResolvedValue(undefined),
  },
  addAvatarWearTime: vi.fn<(...args: unknown[]) => void>(),
  runLastLocationResetFlow: vi.fn<(...args: unknown[]) => void>(),
}));

vi.mock("vue-sonner", () => ({
  toast: vi.fn(),
}));

vi.mock("../../src/coordinators/cache-coordinator", () => ({
  deleteVRChatCache: vi.fn(),
}));

vi.mock("../../src/services/database", () => ({
  database: new Proxy(
    {},
    {
      get: (_target, prop) => {
        if (prop === "__esModule") return false;
        return vi.fn().mockResolvedValue(null);
      },
    }
  ),
}));

vi.mock("../../src/stores/settings/advanced", () => ({
  useAdvancedSettingsStore: () => mocks.advancedSettingsStore,
}));

vi.mock("../../src/stores/avatar", () => ({
  useAvatarStore: () => ({}),
}));

vi.mock("../../src/coordinators/avatar-coordinator", () => ({
  addAvatarWearTime: (...args: unknown[]) => mocks.addAvatarWearTime(...args),
}));

vi.mock("../../src/stores/gameLog", () => ({
  useGameLogStore: () => mocks.gameLogStore,
}));

vi.mock("../../src/stores/game", () => ({
  useGameStore: () => mocks.gameStore,
}));

vi.mock("../../src/stores/instance", () => ({
  useInstanceStore: () => mocks.instanceStore,
}));

vi.mock("../../src/stores/launch", () => ({
  useLaunchStore: () => mocks.launchStore,
}));

vi.mock("../../src/stores/location", () => ({
  useLocationStore: () => mocks.locationStore,
}));

vi.mock("../../src/coordinators/location-coordinator", () => ({
  runLastLocationResetFlow: (...args: unknown[]) => mocks.runLastLocationResetFlow(...args),
}));

vi.mock("../../src/stores/modal", () => ({
  useModalStore: () => ({}),
}));

vi.mock("../../src/stores/notification", () => ({
  useNotificationStore: () => ({ queueGameLogNoty: vi.fn() }),
}));

vi.mock("../../src/stores/update-loop", () => ({
  useUpdateLoopStore: () => mocks.updateLoopStore,
}));

vi.mock("../../src/stores/user", () => ({
  useUserStore: () => mocks.userStore,
}));

vi.mock("../../src/stores/vr", () => ({
  useVrStore: () => mocks.vrStore,
}));

vi.mock("../../src/stores/world", () => ({
  useWorldStore: () => ({ updateVRChatWorldCache: vi.fn() }),
}));

vi.mock("../../src/services/config", () => ({
  configRepository: mocks.configRepository,
}));

vi.mock("worker-timers", () => ({
  setTimeout: vi.fn(),
}));

import { getLastLaunchArguments, runCheckIfGameCrashedFlow, runGameRunningChangedFlow } from "../../src/coordinators/game-coordinator";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("getLastLaunchArguments", () => {
  test("returns the arguments of the exited VRChat process", async () => {
    const args = "--profile=2 --no-vr --enable-debug-gui";
    vi.stubGlobal("AppApi", { GetVRChatLaunchArguments: vi.fn().mockResolvedValue(args) });

    expect(await getLastLaunchArguments()).toBe(args);
  });

  test("returns an empty string when there are no arguments", async () => {
    vi.stubGlobal("AppApi", { GetVRChatLaunchArguments: vi.fn().mockResolvedValue("") });

    expect(await getLastLaunchArguments()).toBe("");
  });

  test("returns an empty string when the bridge call fails", async () => {
    vi.stubGlobal("AppApi", { GetVRChatLaunchArguments: vi.fn().mockRejectedValue(new Error("bridge")) });

    expect(await getLastLaunchArguments()).toBe("");
  });
});

describe("runGameRunningChangedFlow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.userStore.currentUser.$online_for = 1000;
    mocks.gameStore.isGameNoVR = false;
  });

  test("persists and stores last game session when game stops", async () => {
    vi.spyOn(Date, "now").mockReturnValue(5000);

    await runGameRunningChangedFlow(false);

    expect(mocks.gameStore.setLastSession).toHaveBeenCalledWith(4000, 5000);
    expect(mocks.configRepository.setString).toHaveBeenCalledWith("VRCX_lastGameSessionMs", "4000");
    expect(mocks.configRepository.setString).toHaveBeenCalledWith("VRCX_lastGameOfflineAt", "5000");
    expect(mocks.userStore.markCurrentUserGameStopped).toHaveBeenCalled();
    expect(mocks.gameLogStore.resetNowPlayingProducers).toHaveBeenCalledOnce();
  });

  test("skips persisting last game session when no valid session start exists", async () => {
    mocks.userStore.currentUser.$online_for = 0;

    await runGameRunningChangedFlow(false);

    expect(mocks.gameStore.setLastSession).not.toHaveBeenCalled();
    expect(mocks.gameLogStore.resetNowPlayingProducers).toHaveBeenCalledOnce();
    expect(mocks.configRepository.setString).not.toHaveBeenCalledWith("VRCX_lastGameSessionMs", expect.any(String));
    expect(mocks.configRepository.setString).not.toHaveBeenCalledWith("VRCX_lastGameOfflineAt", expect.any(String));
  });
});

describe("runCheckIfGameCrashedFlow", () => {
  const location = "wrld_123:456~region(us)";

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.advancedSettingsStore.relaunchVRChatAfterCrash = true;
    mocks.gameStore.isGameNoVR = true;
    mocks.locationStore.lastLocation.location = location;
  });

  afterEach(() => {
    mocks.advancedSettingsStore.relaunchVRChatAfterCrash = false;
    vi.useRealTimers();
  });

  test.each([
    location,
    "wrld_123-456:instance_1.2~group(grp_123-456)~groupAccessType(plus)~ageGate~region(eu)",
    "wrld_123:456~private(usr_123-456)~canRequestInvite~nonce(abc-123)~strict",
  ])("reads the arguments before relaunching into %s", async (validLocation) => {
    const getArguments = vi.fn().mockResolvedValue("--profile=2 --no-vr");
    vi.stubGlobal("AppApi", {
      VrcClosedGracefully: vi.fn().mockResolvedValue(false),
      GetVRChatLaunchArguments: getArguments,
      FocusWindow: vi.fn().mockResolvedValue(undefined),
    });

    mocks.locationStore.lastLocation.location = validLocation;

    runCheckIfGameCrashedFlow();

    const setTimeout = vi.mocked(workerTimers.setTimeout);
    await vi.waitFor(() => expect(setTimeout).toHaveBeenCalledWith(expect.any(Function), 2000));
    expect(getArguments).toHaveBeenCalledOnce();
    getArguments.mockResolvedValue("--profile=3");
    setTimeout.mock.calls[0]?.[0]();

    await vi.waitFor(() => expect(mocks.launchStore.launchGame).toHaveBeenCalledWith(validLocation, "", true, "--profile=2 --no-vr"));
  });

  test.each([
    `${location} --profile=0`,
    `${location}"`,
    `${location}&shortName=other`,
    `${location}%20--profile=0`,
    `${location}^option`,
    `${location}\n`,
    "wrld_123:456~region(us",
    "wrld_123",
    "local:456",
  ])("rejects an invalid log-derived location %j", async (invalidLocation) => {
    vi.useFakeTimers();
    const closure = Promise.withResolvers<boolean>();
    const closedGracefully = vi.fn().mockReturnValue(closure.promise);
    const getArguments = vi.fn().mockResolvedValue("");
    vi.stubGlobal("AppApi", {
      VrcClosedGracefully: closedGracefully,
      GetVRChatLaunchArguments: getArguments,
    });
    mocks.locationStore.lastLocation.location = invalidLocation;

    runCheckIfGameCrashedFlow();
    expect(closedGracefully).toHaveBeenCalledOnce();
    closure.resolve(false);
    await vi.runAllTimersAsync();

    expect(getArguments).not.toHaveBeenCalled();
    expect(workerTimers.setTimeout).not.toHaveBeenCalled();
  });
});
