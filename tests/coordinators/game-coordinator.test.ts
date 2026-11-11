import { beforeEach, describe, expect, test, vi } from "vitest";

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
vi.mock("../../src/shared/utils/instance", () => ({
  isRealInstance: vi.fn(() => false),
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
  useLaunchStore: () => ({}),
}));

vi.mock("../../src/stores/location", () => ({
  useLocationStore: () => ({
    lastLocation: { location: "", playerList: { size: 0 } },
  }),
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

import { runGameRunningChangedFlow } from "../../src/coordinators/game-coordinator";

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
