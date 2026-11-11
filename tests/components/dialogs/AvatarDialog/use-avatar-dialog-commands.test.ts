import { describe, it, expect, vi, beforeEach } from "vitest";
import { ref } from "vue";
import { useAvatarDialogCommands } from "../../../../src/components/dialogs/AvatarDialog/use-avatar-dialog-commands";

vi.mock("../../../../src/api/avatar-moderation", () => ({
  avatarModerationRequest: {
    sendAvatarModeration: vi.fn(),
    deleteAvatarModeration: vi.fn(),
  },
}));
vi.mock("../../../../src/api/avatar", () => ({
  avatarRequest: {
    saveAvatar: vi.fn(),
    deleteAvatar: vi.fn(),
    selectFallbackAvatar: vi.fn(),
    deleteImposter: vi.fn(),
    createImposter: vi.fn(),
    uploadAvatarImage: vi.fn(),
  },
}));
vi.mock("../../../../src/api/favorite", () => ({
  favoriteRequest: {
    deleteFavorite: vi.fn(),
  },
}));

vi.mock("../../../../src/shared/utils/app-actions", () => ({
  copyToClipboard: vi.fn(),
  openExternalLink: vi.fn(),
}));
vi.mock("../../../../src/shared/utils/url-utils", () => ({
  replaceVrcPackageUrl: vi.fn((url: string) => url),
}));

vi.mock("../../../../src/shared/utils/image-upload", () => ({
  handleImageUploadInput: vi.fn(),
  readFileAsBase64: vi.fn(),
  withUploadTimeout: vi.fn(),
}));

vi.mock("../../../../src/coordinators/image-upload-coordinator", () => ({
  resizeImageToFitLimits: vi.fn(),
  uploadImageLegacy: vi.fn(),
}));

vi.mock("../../../../src/coordinators/avatar-coordinator", () => ({
  removeAvatarFromCache: vi.fn(),
}));

const { copyToClipboard, openExternalLink } = await import("../../../../src/shared/utils/app-actions");
const { favoriteRequest } = await import("../../../../src/api/favorite");
const { avatarRequest } = await import("../../../../src/api/avatar");
const { avatarModerationRequest } = await import("../../../../src/api/avatar-moderation");

type Deps = Parameters<typeof useAvatarDialogCommands>[1];

const requestSpies = {
  deleteFavorite: vi.spyOn(favoriteRequest, "deleteFavorite"),
  selectFallbackAvatar: vi.spyOn(avatarRequest, "selectFallbackAvatar"),
  saveAvatar: vi.spyOn(avatarRequest, "saveAvatar"),
  deleteAvatar: vi.spyOn(avatarRequest, "deleteAvatar"),
  createImposter: vi.spyOn(avatarRequest, "createImposter"),
  deleteImposter: vi.spyOn(avatarRequest, "deleteImposter"),
  sendAvatarModeration: vi.spyOn(avatarModerationRequest, "sendAvatarModeration"),
  deleteAvatarModeration: vi.spyOn(avatarModerationRequest, "deleteAvatarModeration"),
};

function createMockAvatarDialog() {
  return ref({
    visible: true,
    loading: false,
    id: "avtr_test123",
    ref: {
      name: "TestAvatar",
      description: "Test desc",
      imageUrl: "https://example.com/img.png",
      thumbnailImageUrl: "https://example.com/thumb.png",
      authorId: "usr_author",
      authorName: "Author",
      releaseStatus: "private",
      tags: ["content_horror"],
      unityPackageUrl: "https://example.com/pkg.unitypackage",
      styles: { primary: "style1", secondary: "style2" },
    },
    isBlocked: false,
    hasImposter: false,
    timeSpent: 0,
    galleryLoading: false,
    galleryImages: [],
  });
}

function pendingRequest(): Promise<never> {
  return new Promise<never>(() => undefined);
}

function createMockDeps(overrides: Partial<Deps> = {}): Deps {
  return {
    t: vi.fn((key: string) => key),
    toast: {
      success: vi.fn<Deps["toast"]["success"]>(),
      error: vi.fn<Deps["toast"]["error"]>(),
    },
    modalStore: {
      confirm: vi.fn<Deps["modalStore"]["confirm"]>(() => Promise.resolve({ ok: true, reason: "ok", checked: false })),
      prompt: vi.fn<Deps["modalStore"]["prompt"]>(() => Promise.resolve({ ok: true, reason: "ok", value: "new_value" })),
    },
    userDialog: ref({ id: "usr_author" }),
    cachedAvatars: new Map(),
    cachedAvatarModerations: new Map(),
    showAvatarDialog: vi.fn<Deps["showAvatarDialog"]>(),
    showFavoriteDialog: vi.fn<Deps["showFavoriteDialog"]>(),
    applyAvatarModeration: vi.fn<Deps["applyAvatarModeration"]>(),
    applyAvatar: vi.fn<Deps["applyAvatar"]>(),
    sortUserDialogAvatars: vi.fn<Deps["sortUserDialogAvatars"]>(),
    uiStore: { jumpBackDialogCrumb: vi.fn<() => void>() },
    ...overrides,
  };
}

describe("useAvatarDialogCommands", () => {
  let avatarDialog: ReturnType<typeof createMockAvatarDialog>;
  let deps: Deps;

  beforeEach(() => {
    vi.clearAllMocks();
    avatarDialog = createMockAvatarDialog();
    deps = createMockDeps();
  });

  describe("direct commands", () => {
    it("Refresh: should call showAvatarDialog with forceRefresh", () => {
      const { avatarDialogCommand } = useAvatarDialogCommands(avatarDialog, deps);
      avatarDialogCommand("Refresh");
      expect(deps.showAvatarDialog).toHaveBeenCalledWith("avtr_test123", {
        forceRefresh: true,
      });
    });

    it("Share: should copy avatar URL", () => {
      const { avatarDialogCommand } = useAvatarDialogCommands(avatarDialog, deps);
      avatarDialogCommand("Share");
      expect(copyToClipboard).toHaveBeenCalledWith("https://vrchat.com/home/avatar/avtr_test123");
    });

    it("Add Favorite: should call showFavoriteDialog", () => {
      const { avatarDialogCommand } = useAvatarDialogCommands(avatarDialog, deps);
      avatarDialogCommand("Add Favorite");
      expect(deps.showFavoriteDialog).toHaveBeenCalledWith("avatar", "avtr_test123");
    });

    it("Download Unity Package: should open external link", () => {
      const { avatarDialogCommand } = useAvatarDialogCommands(avatarDialog, deps);
      avatarDialogCommand("Download Unity Package");
      expect(openExternalLink).toHaveBeenCalled();
    });

    it("Rename: should show prompt dialog", () => {
      const { avatarDialogCommand } = useAvatarDialogCommands(avatarDialog, deps);
      avatarDialogCommand("Rename");
      expect(deps.modalStore.prompt).toHaveBeenCalled();
    });

    it("Change Description: should show prompt dialog", () => {
      const { avatarDialogCommand } = useAvatarDialogCommands(avatarDialog, deps);
      avatarDialogCommand("Change Description");
      expect(deps.modalStore.prompt).toHaveBeenCalled();
    });

    it("Change Image: triggers file input", () => {
      const button = document.createElement("button");
      button.id = "AvatarImageUploadButton";
      document.body.appendChild(button);
      const clickSpy = vi.spyOn(button, "click").mockImplementation(() => undefined);
      const { avatarDialogCommand } = useAvatarDialogCommands(avatarDialog, deps);
      avatarDialogCommand("Change Image");
      expect(clickSpy).toHaveBeenCalled();
      button.remove();
    });
  });

  describe("string callback commands", () => {
    it("should delegate to registered callbacks", () => {
      const showSetAvatarTagsDialog = vi.fn<() => void>();
      const { avatarDialogCommand, registerCallbacks } = useAvatarDialogCommands(avatarDialog, deps);
      registerCallbacks({ showSetAvatarTagsDialog });
      avatarDialogCommand("Change Content Tags");
      expect(showSetAvatarTagsDialog).toHaveBeenCalled();
    });

    it("should not throw when callback is not registered", () => {
      const { avatarDialogCommand } = useAvatarDialogCommands(avatarDialog, deps);
      expect(() => avatarDialogCommand("Change Content Tags")).not.toThrow();
    });
  });

  describe("confirmed commands", () => {
    it("Delete Favorite: should confirm then delete", async () => {
      requestSpies.deleteFavorite.mockImplementation(pendingRequest);
      const { avatarDialogCommand } = useAvatarDialogCommands(avatarDialog, deps);
      avatarDialogCommand("Delete Favorite");
      await vi.waitFor(() => {
        expect(deps.modalStore.confirm).toHaveBeenCalled();
      });
      await vi.waitFor(() => {
        expect(requestSpies.deleteFavorite).toHaveBeenCalledWith({
          objectId: "avtr_test123",
        });
      });
    });

    it("confirmed command should not execute when cancelled", async () => {
      deps.modalStore.confirm = vi.fn<Deps["modalStore"]["confirm"]>(() => Promise.resolve({ ok: false, reason: "cancel", checked: false }));
      const { avatarDialogCommand } = useAvatarDialogCommands(avatarDialog, deps);
      avatarDialogCommand("Delete Favorite");
      await vi.waitFor(() => {
        expect(deps.modalStore.confirm).toHaveBeenCalled();
      });
      expect(requestSpies.deleteFavorite).not.toHaveBeenCalled();
    });

    it("Select Fallback Avatar: should confirm then select", async () => {
      requestSpies.selectFallbackAvatar.mockImplementation(pendingRequest);
      const { avatarDialogCommand } = useAvatarDialogCommands(avatarDialog, deps);
      avatarDialogCommand("Select Fallback Avatar");
      await vi.waitFor(() => {
        expect(requestSpies.selectFallbackAvatar).toHaveBeenCalledWith({ avatarId: "avtr_test123" });
      });
    });

    it("Block Avatar: should confirm then send moderation", async () => {
      requestSpies.sendAvatarModeration.mockImplementation(pendingRequest);
      const { avatarDialogCommand } = useAvatarDialogCommands(avatarDialog, deps);
      avatarDialogCommand("Block Avatar");
      await vi.waitFor(() => {
        expect(requestSpies.sendAvatarModeration).toHaveBeenCalledWith({
          avatarModerationType: "block",
          targetAvatarId: "avtr_test123",
        });
      });
    });

    it("Unblock Avatar: should confirm then delete moderation", async () => {
      requestSpies.deleteAvatarModeration.mockImplementation(pendingRequest);
      const { avatarDialogCommand } = useAvatarDialogCommands(avatarDialog, deps);
      avatarDialogCommand("Unblock Avatar");
      await vi.waitFor(() => {
        expect(requestSpies.deleteAvatarModeration).toHaveBeenCalledWith({
          avatarModerationType: "block",
          targetAvatarId: "avtr_test123",
        });
      });
    });

    it("Make Public: should save avatar with public status", async () => {
      requestSpies.saveAvatar.mockImplementation(pendingRequest);
      const { avatarDialogCommand } = useAvatarDialogCommands(avatarDialog, deps);
      avatarDialogCommand("Make Public");
      await vi.waitFor(() => {
        expect(requestSpies.saveAvatar).toHaveBeenCalledWith({
          id: "avtr_test123",
          releaseStatus: "public",
        });
      });
    });

    it("Make Private: should save avatar with private status", async () => {
      requestSpies.saveAvatar.mockImplementation(pendingRequest);
      const { avatarDialogCommand } = useAvatarDialogCommands(avatarDialog, deps);
      avatarDialogCommand("Make Private");
      await vi.waitFor(() => {
        expect(requestSpies.saveAvatar).toHaveBeenCalledWith({
          id: "avtr_test123",
          releaseStatus: "private",
        });
      });
    });

    it("Delete: should delete avatar and update cache", async () => {
      requestSpies.deleteAvatar.mockImplementation(pendingRequest);
      const { avatarDialogCommand } = useAvatarDialogCommands(avatarDialog, deps);
      avatarDialogCommand("Delete");
      await vi.waitFor(() => {
        expect(requestSpies.deleteAvatar).toHaveBeenCalledWith({
          avatarId: "avtr_test123",
        });
      });
    });

    it("Create Imposter: should create imposter", async () => {
      requestSpies.createImposter.mockImplementation(pendingRequest);
      const { avatarDialogCommand } = useAvatarDialogCommands(avatarDialog, deps);
      avatarDialogCommand("Create Imposter");
      await vi.waitFor(() => {
        expect(requestSpies.createImposter).toHaveBeenCalledWith({
          avatarId: "avtr_test123",
        });
      });
    });

    it("Delete Imposter: should delete imposter and refresh", async () => {
      requestSpies.deleteImposter.mockImplementation(pendingRequest);
      const { avatarDialogCommand } = useAvatarDialogCommands(avatarDialog, deps);
      avatarDialogCommand("Delete Imposter");
      await vi.waitFor(() => {
        expect(requestSpies.deleteImposter).toHaveBeenCalledWith({
          avatarId: "avtr_test123",
        });
      });
    });
  });

  describe("unknown command", () => {
    it("should do nothing for unknown commands", () => {
      const { avatarDialogCommand } = useAvatarDialogCommands(avatarDialog, deps);
      expect(() => avatarDialogCommand("NonExistent")).not.toThrow();
      expect(deps.modalStore.confirm).not.toHaveBeenCalled();
    });
  });

  describe("image upload state", () => {
    it("should expose crop dialog state refs", () => {
      const { cropDialogOpen, cropDialogFile, changeAvatarImageLoading } = useAvatarDialogCommands(avatarDialog, deps);
      expect(cropDialogOpen.value).toBe(false);
      expect(cropDialogFile.value).toBeNull();
      expect(changeAvatarImageLoading.value).toBe(false);
    });
  });
});
