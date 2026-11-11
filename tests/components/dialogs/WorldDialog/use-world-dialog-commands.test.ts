import { describe, expect, test, vi, beforeEach } from "vitest";
import { ref } from "vue";
import { useWorldDialogCommands } from "../../../../src/components/dialogs/WorldDialog/use-world-dialog-commands";
import type { WorldDialogState } from "../../../../src/stores/world";

const mocks = vi.hoisted(() => ({
  deleteFavorite: vi.fn(),
  deleteWorldPersistData: vi.fn(),
  saveCurrentUser: vi.fn(),
  saveWorld: vi.fn(),
  publishWorld: vi.fn(),
  unpublishWorld: vi.fn(),
  deleteWorld: vi.fn(),
  writeText: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../../../src/api/favorite", () => ({
  favoriteRequest: {
    deleteFavorite: mocks.deleteFavorite,
  },
}));
vi.mock("../../../../src/api/misc", () => ({
  miscRequest: {
    deleteWorldPersistData: mocks.deleteWorldPersistData,
  },
}));
vi.mock("../../../../src/api/user", () => ({
  userRequest: {
    saveCurrentUser: mocks.saveCurrentUser,
  },
}));
vi.mock("../../../../src/api/world", () => ({
  worldRequest: {
    saveWorld: mocks.saveWorld,
    publishWorld: mocks.publishWorld,
    unpublishWorld: mocks.unpublishWorld,
    deleteWorld: mocks.deleteWorld,
  },
}));

vi.mock("../../../../src/shared/utils/app-actions", () => ({
  openExternalLink: vi.fn(),
}));
vi.mock("../../../../src/shared/utils/url-utils", () => ({
  replaceVrcPackageUrl: vi.fn((url: string) => url),
}));

vi.mock("../../../../src/shared/utils/image-upload", () => ({
  handleImageUploadInput: vi.fn(),
  readFileAsBase64: vi.fn(),
  withUploadTimeout: vi.fn((p: unknown) => p),
}));

vi.mock("../../../../src/coordinators/image-upload-coordinator", () => ({
  resizeImageToFitLimits: vi.fn(),
  uploadImageLegacy: vi.fn(),
}));

vi.mock("../../../../src/coordinators/world-coordinator", () => ({
  removeWorldFromCache: vi.fn(),
}));

const { openExternalLink } = await import("../../../../src/shared/utils/app-actions");

function unsettled<T>() {
  return new Promise<T>(() => undefined);
}

function createWorldDialog(overrides: Partial<WorldDialogState> = {}) {
  return ref<WorldDialogState>({
    id: "wrld_123",
    visible: true,
    loading: false,
    activeTab: "Info",
    lastActiveTab: "Info",
    memo: "",
    hasPersistData: true,
    isFavorite: false,
    $location: {
      tag: "wrld_123:12345~region(us)",
      shortName: "Test World",
    },
    ref: {
      name: "Test World",
      description: "A test world",
      authorId: "usr_author",
      capacity: 20,
      recommendedCapacity: 10,
      previewYoutubeId: "abc123",
      imageUrl: "https://example.com/image.jpg",
      unityPackageUrl: "https://example.com/package.unitypackage",
      urlList: ["https://example.com"],
      tags: ["system_approved"],
    },
    avatarScalingDisabled: false,
    focusViewDisabled: false,
    rooms: [],
    inCache: false,
    cacheSize: "",
    cacheLocked: false,
    cachePath: "",
    fileAnalysis: {},
    lastVisit: "",
    visitCount: 0,
    timeSpent: 0,
    isPC: false,
    isQuest: false,
    isIos: false,
    rating: null,
    listings: [],
    ...overrides,
  });
}

function createDeps(overrides = {}) {
  return {
    t: vi.fn((key: string) => key),
    toast: {
      success: vi.fn(),
      error: vi.fn(),
    },
    modalStore: {
      confirm: vi.fn().mockResolvedValue({ ok: true }),
      prompt: vi.fn().mockResolvedValue({ ok: true, value: "new value" }),
    },
    userDialog: ref({ worlds: [] }),
    cachedWorlds: new Map(),
    showWorldDialog: vi.fn(),
    showFavoriteDialog: vi.fn(),
    newInstanceSelfInvite: vi.fn(),
    showPreviousInstancesListDialog: vi.fn().mockResolvedValue(undefined),
    showFullscreenImageDialog: vi.fn(),
    ...overrides,
  };
}

describe("useWorldDialogCommands", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("initial state", () => {
    test("provides reactive state refs", () => {
      const worldDialog = createWorldDialog();
      const { worldAllowedDomainsDialog, isSetWorldTagsDialogVisible, newInstanceDialogLocationTag, cropDialogOpen, cropDialogFile } = useWorldDialogCommands(
        worldDialog,
        createDeps()
      );

      expect(worldAllowedDomainsDialog.value.visible).toBe(false);
      expect(isSetWorldTagsDialogVisible.value).toBe(false);
      expect(newInstanceDialogLocationTag.value).toBe("");
      expect(cropDialogOpen.value).toBe(false);
      expect(cropDialogFile.value).toBeNull();
    });
  });

  describe("worldDialogCommand", () => {
    test("returns early when dialog is not visible", () => {
      const worldDialog = createWorldDialog({ visible: false });
      const deps = createDeps();
      const { worldDialogCommand } = useWorldDialogCommands(worldDialog, deps);

      worldDialogCommand("Refresh");
      expect(deps.showWorldDialog).not.toHaveBeenCalled();
    });

    test("Refresh command calls showWorldDialog with forceRefresh", () => {
      const worldDialog = createWorldDialog();
      const deps = createDeps();
      const { worldDialogCommand } = useWorldDialogCommands(worldDialog, deps);

      worldDialogCommand("Refresh");
      expect(deps.showWorldDialog).toHaveBeenCalledWith(worldDialog.value.$location.tag, worldDialog.value.$location.shortName, { forceRefresh: true });
    });

    test("Add Favorite command calls showFavoriteDialog", () => {
      const worldDialog = createWorldDialog();
      const deps = createDeps();
      const { worldDialogCommand } = useWorldDialogCommands(worldDialog, deps);

      worldDialogCommand("Add Favorite");
      expect(deps.showFavoriteDialog).toHaveBeenCalledWith("world", "wrld_123");
    });

    test("New Instance and Self Invite calls newInstanceSelfInvite", () => {
      const worldDialog = createWorldDialog();
      const deps = createDeps();
      const { worldDialogCommand } = useWorldDialogCommands(worldDialog, deps);

      worldDialogCommand("New Instance and Self Invite");
      expect(deps.newInstanceSelfInvite).toHaveBeenCalledWith("wrld_123");
    });

    test("Previous Instances calls showPreviousInstancesListDialog", () => {
      const worldDialog = createWorldDialog();
      const deps = createDeps();
      const { worldDialogCommand } = useWorldDialogCommands(worldDialog, deps);

      worldDialogCommand("Previous Instances");
      expect(deps.showPreviousInstancesListDialog).toHaveBeenCalledWith("world", worldDialog.value.ref);
    });

    test("Change Tags sets isSetWorldTagsDialogVisible to true", () => {
      const worldDialog = createWorldDialog();
      const deps = createDeps();
      const { worldDialogCommand, isSetWorldTagsDialogVisible, registerCallbacks } = useWorldDialogCommands(worldDialog, deps);

      registerCallbacks({
        showSetWorldTagsDialog: () => {
          isSetWorldTagsDialogVisible.value = true;
        },
      });

      worldDialogCommand("Change Tags");
      expect(isSetWorldTagsDialogVisible.value).toBe(true);
    });

    test("Download Unity Package opens external link", () => {
      const worldDialog = createWorldDialog();
      const deps = createDeps();
      const { worldDialogCommand } = useWorldDialogCommands(worldDialog, deps);

      worldDialogCommand("Download Unity Package");
      expect(openExternalLink).toHaveBeenCalled();
    });

    test("Share copies world URL", () => {
      Object.defineProperty(navigator, "clipboard", {
        value: { writeText: mocks.writeText },
        writable: true,
        configurable: true,
      });
      const worldDialog = createWorldDialog();
      const deps = createDeps();
      const { worldDialogCommand } = useWorldDialogCommands(worldDialog, deps);

      worldDialogCommand("Share");
      expect(mocks.writeText).toHaveBeenCalledWith("https://vrchat.com/home/world/wrld_123");
    });

    test("Change Allowed Domains opens the allowed domains dialog", () => {
      const worldDialog = createWorldDialog();
      const deps = createDeps();
      const { worldDialogCommand, worldAllowedDomainsDialog, showWorldAllowedDomainsDialog, registerCallbacks } = useWorldDialogCommands(worldDialog, deps);

      registerCallbacks({
        showWorldAllowedDomainsDialog: () => {
          showWorldAllowedDomainsDialog();
        },
      });

      worldDialogCommand("Change Allowed Domains");
      expect(worldAllowedDomainsDialog.value.visible).toBe(true);
      expect(worldAllowedDomainsDialog.value.worldId).toBe("wrld_123");
    });
  });

  describe("confirmation commands", () => {
    test("Delete Favorite shows confirm then calls API", async () => {
      const worldDialog = createWorldDialog();
      const deps = createDeps();
      const { worldDialogCommand } = useWorldDialogCommands(worldDialog, deps);

      worldDialogCommand("Delete Favorite");
      await vi.waitFor(() => {
        expect(deps.modalStore.confirm).toHaveBeenCalled();
        expect(mocks.deleteFavorite).toHaveBeenCalledWith({
          objectId: "wrld_123",
        });
      });
    });

    test("Make Home calls saveCurrentUser with homeLocation", async () => {
      vi.mocked(mocks.saveCurrentUser).mockReturnValue(unsettled());
      const worldDialog = createWorldDialog();
      const deps = createDeps();
      const { worldDialogCommand } = useWorldDialogCommands(worldDialog, deps);

      worldDialogCommand("Make Home");
      await vi.waitFor(() => {
        expect(mocks.saveCurrentUser).toHaveBeenCalledWith({
          homeLocation: "wrld_123",
        });
      });
    });

    test("Reset Home calls saveCurrentUser with empty homeLocation", async () => {
      vi.mocked(mocks.saveCurrentUser).mockReturnValue(unsettled());
      const worldDialog = createWorldDialog();
      const deps = createDeps();
      const { worldDialogCommand } = useWorldDialogCommands(worldDialog, deps);

      worldDialogCommand("Reset Home");
      await vi.waitFor(() => {
        expect(mocks.saveCurrentUser).toHaveBeenCalledWith({
          homeLocation: "",
        });
      });
    });

    test("Publish calls publishWorld", async () => {
      vi.mocked(mocks.publishWorld).mockReturnValue(unsettled());
      const worldDialog = createWorldDialog();
      const deps = createDeps();
      const { worldDialogCommand } = useWorldDialogCommands(worldDialog, deps);

      worldDialogCommand("Publish");
      await vi.waitFor(() => {
        expect(mocks.publishWorld).toHaveBeenCalledWith({
          worldId: "wrld_123",
        });
      });
    });

    test("Unpublish calls unpublishWorld", async () => {
      vi.mocked(mocks.unpublishWorld).mockReturnValue(unsettled());
      const worldDialog = createWorldDialog();
      const deps = createDeps();
      const { worldDialogCommand } = useWorldDialogCommands(worldDialog, deps);

      worldDialogCommand("Unpublish");
      await vi.waitFor(() => {
        expect(mocks.unpublishWorld).toHaveBeenCalledWith({
          worldId: "wrld_123",
        });
      });
    });

    test("Delete Persistent Data calls deleteWorldPersistData", async () => {
      vi.mocked(mocks.deleteWorldPersistData).mockReturnValue(unsettled());
      const worldDialog = createWorldDialog();
      const deps = createDeps();
      const { worldDialogCommand } = useWorldDialogCommands(worldDialog, deps);

      worldDialogCommand("Delete Persistent Data");
      await vi.waitFor(() => {
        expect(mocks.deleteWorldPersistData).toHaveBeenCalledWith({ worldId: "wrld_123" });
      });
    });

    test("confirmation cancelled does not call API", async () => {
      const worldDialog = createWorldDialog();
      const deps = createDeps();
      deps.modalStore.confirm.mockResolvedValue({ ok: false });
      const { worldDialogCommand } = useWorldDialogCommands(worldDialog, deps);

      worldDialogCommand("Make Home");
      await vi.waitFor(() => {
        expect(deps.modalStore.confirm).toHaveBeenCalled();
      });
      expect(mocks.saveCurrentUser).not.toHaveBeenCalled();
    });
  });

  describe("prompt commands", () => {
    test("Rename calls prompt then saveWorld", async () => {
      vi.mocked(mocks.saveWorld).mockReturnValue(unsettled());
      const worldDialog = createWorldDialog();
      const deps = createDeps();
      deps.modalStore.prompt.mockResolvedValue({
        ok: true,
        value: "New Name",
      });
      const { worldDialogCommand } = useWorldDialogCommands(worldDialog, deps);

      worldDialogCommand("Rename");
      await vi.waitFor(() => {
        expect(mocks.saveWorld).toHaveBeenCalledWith({
          id: "wrld_123",
          name: "New Name",
        });
      });
    });

    test("Change Description calls prompt then saveWorld", async () => {
      vi.mocked(mocks.saveWorld).mockReturnValue(unsettled());
      const worldDialog = createWorldDialog();
      const deps = createDeps();
      deps.modalStore.prompt.mockResolvedValue({
        ok: true,
        value: "New Desc",
      });
      const { worldDialogCommand } = useWorldDialogCommands(worldDialog, deps);

      worldDialogCommand("Change Description");
      await vi.waitFor(() => {
        expect(mocks.saveWorld).toHaveBeenCalledWith({
          id: "wrld_123",
          description: "New Desc",
        });
      });
    });

    test("Change Capacity calls prompt then saveWorld with number", async () => {
      vi.mocked(mocks.saveWorld).mockReturnValue(unsettled());
      const worldDialog = createWorldDialog();
      const deps = createDeps();
      deps.modalStore.prompt.mockResolvedValue({ ok: true, value: "30" });
      const { worldDialogCommand } = useWorldDialogCommands(worldDialog, deps);

      worldDialogCommand("Change Capacity");
      await vi.waitFor(() => {
        expect(mocks.saveWorld).toHaveBeenCalledWith({
          id: "wrld_123",
          capacity: 30,
        });
      });
    });

    test("Change Recommended Capacity calls prompt then saveWorld", async () => {
      vi.mocked(mocks.saveWorld).mockReturnValue(unsettled());
      const worldDialog = createWorldDialog();
      const deps = createDeps();
      deps.modalStore.prompt.mockResolvedValue({ ok: true, value: "15" });
      const { worldDialogCommand } = useWorldDialogCommands(worldDialog, deps);

      worldDialogCommand("Change Recommended Capacity");
      await vi.waitFor(() => {
        expect(mocks.saveWorld).toHaveBeenCalledWith({
          id: "wrld_123",
          recommendedCapacity: 15,
        });
      });
    });

    test("prompt cancelled does not call saveWorld", async () => {
      const worldDialog = createWorldDialog();
      const deps = createDeps();
      deps.modalStore.prompt.mockResolvedValue({ ok: false });
      const { worldDialogCommand } = useWorldDialogCommands(worldDialog, deps);

      worldDialogCommand("Rename");
      await vi.waitFor(() => {
        expect(deps.modalStore.prompt).toHaveBeenCalled();
      });
      expect(mocks.saveWorld).not.toHaveBeenCalled();
    });
  });

  describe("promptChangeWorldYouTubePreview", () => {
    test("parses YouTube URL with v parameter", async () => {
      vi.mocked(mocks.saveWorld).mockReturnValue(unsettled());
      const worldDialog = createWorldDialog();
      const deps = createDeps();
      deps.modalStore.prompt.mockResolvedValue({
        ok: true,
        value: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      });
      const { worldDialogCommand } = useWorldDialogCommands(worldDialog, deps);

      worldDialogCommand("Change YouTube Preview");
      await vi.waitFor(() => {
        expect(mocks.saveWorld).toHaveBeenCalledWith({
          id: "wrld_123",
          previewYoutubeId: "dQw4w9WgXcQ",
        });
      });
    });

    test("uses short id directly", async () => {
      vi.mocked(mocks.saveWorld).mockReturnValue(unsettled());
      const worldDialog = createWorldDialog();
      const deps = createDeps();
      deps.modalStore.prompt.mockResolvedValue({
        ok: true,
        value: "dQw4w9WgXcQ",
      });
      const { worldDialogCommand } = useWorldDialogCommands(worldDialog, deps);

      worldDialogCommand("Change YouTube Preview");
      await vi.waitFor(() => {
        expect(mocks.saveWorld).toHaveBeenCalledWith({
          id: "wrld_123",
          previewYoutubeId: "dQw4w9WgXcQ",
        });
      });
    });
  });

  describe("clipboard operations", () => {
    beforeEach(() => {
      Object.defineProperty(navigator, "clipboard", {
        value: { writeText: mocks.writeText },
        writable: true,
        configurable: true,
      });
    });

    test("copyWorldUrl writes correct URL", async () => {
      const worldDialog = createWorldDialog();
      const deps = createDeps();
      const { copyWorldUrl } = useWorldDialogCommands(worldDialog, deps);

      copyWorldUrl();
      await vi.waitFor(() => {
        expect(mocks.writeText).toHaveBeenCalledWith("https://vrchat.com/home/world/wrld_123");
      });
    });

    test("copyWorldName writes world name", async () => {
      const worldDialog = createWorldDialog();
      const deps = createDeps();
      const { copyWorldName } = useWorldDialogCommands(worldDialog, deps);

      copyWorldName();
      await vi.waitFor(() => {
        expect(mocks.writeText).toHaveBeenCalledWith("Test World");
      });
    });
  });
});
