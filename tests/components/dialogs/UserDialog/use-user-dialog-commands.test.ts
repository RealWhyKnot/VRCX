import { describe, it, expect, vi, beforeEach } from "vitest";
import { ref } from "vue";
import type { Ref } from "vue";
import { useUserDialogCommands } from "../../../../src/components/dialogs/UserDialog/use-user-dialog-commands";
import { createCurrentUserState, createUserDialogState } from "../../../../src/stores/user-state";
import type { CurrentUserState, UserDialogState } from "../../../../src/stores/user-state";
import { createDefaultUserRef } from "../../../../src/shared/utils/user-transforms";

const mocks = vi.hoisted(() => ({
  deleteFavorite: vi.fn<(...args: unknown[]) => Promise<unknown>>(),
  sendFriendRequest: vi.fn<(...args: unknown[]) => Promise<unknown>>(),
  cancelFriendRequest: vi.fn<(...args: unknown[]) => Promise<unknown>>(),
  deleteFriend: vi.fn<(...args: unknown[]) => Promise<unknown>>(),
  sendPlayerModeration: vi.fn<(...args: unknown[]) => Promise<unknown>>(),
  deletePlayerModeration: vi.fn<(...args: unknown[]) => Promise<unknown>>(),
  addFriendLogHistory: vi.fn<(...args: unknown[]) => void>(),
}));

vi.mock("../../../../src/api/favorite", () => ({
  favoriteRequest: {
    deleteFavorite: mocks.deleteFavorite,
  },
}));
vi.mock("../../../../src/api/friend", () => ({
  friendRequest: {
    sendFriendRequest: mocks.sendFriendRequest,
    cancelFriendRequest: mocks.cancelFriendRequest,
    deleteFriend: mocks.deleteFriend,
  },
}));
vi.mock("../../../../src/api/notification", () => ({
  notificationRequest: {
    sendRequestInvite: vi.fn(() => Promise.resolve({})),
    sendInvite: vi.fn(() => Promise.resolve({})),
    acceptFriendRequestNotification: vi.fn(() => Promise.resolve({})),
    hideNotification: vi.fn(() => Promise.resolve({})),
  },
}));
vi.mock("../../../../src/api/player-moderation", () => ({
  playerModerationRequest: {
    sendPlayerModeration: mocks.sendPlayerModeration,
    deletePlayerModeration: mocks.deletePlayerModeration,
  },
}));
vi.mock("../../../../src/api/world", () => ({
  worldRequest: {},
}));

vi.mock("../../../../src/shared/utils/app-actions", () => ({
  copyToClipboard: vi.fn(),
}));
vi.mock("../../../../src/shared/utils/location-parser", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  parseLocation: vi.fn(() => ({ worldId: "wrld_test", tag: "wrld_test~123" })),
}));

vi.mock("../../../../src/services/database", () => ({
  database: {
    addFriendLogHistory: mocks.addFriendLogHistory,
  },
}));

vi.mock("../../../../src/composables/use-recent-actions", () => ({
  recordRecentAction: vi.fn(),
  useRecentActions: () => ({
    isRecentAction: vi.fn(() => false),
  }),
}));

type CommandDeps = Parameters<typeof useUserDialogCommands>[1];

function createMockUserDialog(): Ref<UserDialogState> {
  return ref<UserDialogState>({
    ...createUserDialogState(),
    visible: true,
    id: "usr_test123",
    ref: {
      displayName: "TestUser",
      currentAvatarImageUrl: "https://example.com/avatar.png",
      fallbackAvatar: "avtr_fallback",
      location: "wrld_test~123",
    },
    $avatarInfo: { ownerId: "usr_owner", avatarName: "", fileCreatedAt: "" },
    isFriend: true,
    isBlock: false,
    isMute: false,
    isInteractOff: false,
    isMuteChat: false,
    isShowAvatar: false,
    isHideAvatar: false,
    outgoingRequest: false,
    incomingRequest: false,
  });
}

function createMockDeps(overrides: Partial<CommandDeps> = {}): CommandDeps {
  const currentUserState: CurrentUserState = {
    ...createCurrentUserState(),
    id: "usr_current",
    isBoopingEnabled: true,
  };
  return {
    t: vi.fn((key: string) => key),
    toast: Object.assign(
      vi.fn((message: string) => message),
      {
        success: vi.fn((message: string) => message),
        error: vi.fn((message: string) => message),
      }
    ),
    modalStore: {
      confirm: vi.fn(() => Promise.resolve({ ok: true })),
    },
    currentUser: ref(currentUserState),
    cachedUsers: new Map([["usr_test123", createDefaultUserRef({ id: "usr_test123", displayName: "TestUser" })]]),
    friendLogTable: ref({ data: [] }),
    lastLocation: ref({
      date: null,
      location: "wrld_test~123",
      name: "",
      playerList: new Map(),
      friendList: new Map(),
    }),
    lastLocationDestination: ref("wrld_dest~456"),
    inviteGroupDialog: ref({
      visible: false,
      loading: false,
      groupId: "",
      groupName: "",
      userId: "",
      userIds: [],
      userObject: {},
    }),
    showUserDialog: vi.fn(),
    showFavoriteDialog: vi.fn(),
    showAvatarDialog: vi.fn(),
    showAvatarAuthorDialog: vi.fn(() => Promise.resolve()),
    showModerateGroupDialog: vi.fn(),
    showSendBoopDialog: vi.fn(),
    showModerationReportDialog: vi.fn(),
    showGalleryPage: vi.fn(),
    getFriendRequest: vi.fn(() => ""),
    handleFriendDelete: vi.fn(),
    applyPlayerModeration: vi.fn((json: { targetUserId: string; sourceUserId: string; type: string }) => json),
    handlePlayerModerationDelete: vi.fn(),
    refreshInviteMessageTableData: vi.fn(),
    clearInviteImageUpload: vi.fn(),
    instanceStore: {
      showPreviousInstancesListDialog: vi.fn(() => Promise.resolve()),
    },
    useNotificationStore: vi.fn(() => ({
      handleNotificationAccept: vi.fn(),
      handleNotificationHide: vi.fn(),
    })),
    showEditProfileDialog: vi.fn(),
    ...overrides,
  };
}

describe("useUserDialogCommands", () => {
  let userDialog: Ref<UserDialogState>;
  let deps: CommandDeps;

  beforeEach(() => {
    vi.clearAllMocks();
    userDialog = createMockUserDialog();
    deps = createMockDeps();
  });

  describe("userDialogCommand — direct commands", () => {
    it("should not execute when dialog is not visible", () => {
      userDialog.value.visible = false;
      const { userDialogCommand } = useUserDialogCommands(userDialog, deps);
      userDialogCommand("Refresh");
      expect(deps.showUserDialog).not.toHaveBeenCalled();
    });

    it("Refresh: should reset id and reopen dialog", () => {
      const { userDialogCommand } = useUserDialogCommands(userDialog, deps);
      userDialogCommand("Refresh");
      expect(userDialog.value.id).toBe("");
      expect(deps.showUserDialog).toHaveBeenCalledWith("usr_test123");
    });

    it("Add Favorite: should call showFavoriteDialog", () => {
      const { userDialogCommand } = useUserDialogCommands(userDialog, deps);
      userDialogCommand("Add Favorite");
      expect(deps.showFavoriteDialog).toHaveBeenCalledWith("friend", "usr_test123");
    });

    it("Show Avatar Author: should call showAvatarAuthorDialog", () => {
      const { userDialogCommand } = useUserDialogCommands(userDialog, deps);
      userDialogCommand("Show Avatar Author");
      expect(deps.showAvatarAuthorDialog).toHaveBeenCalledWith("usr_test123", "usr_owner", "https://example.com/avatar.png");
    });

    it("Show Fallback Avatar Details: should call showAvatarDialog with fallback", () => {
      const { userDialogCommand } = useUserDialogCommands(userDialog, deps);
      userDialogCommand("Show Fallback Avatar Details");
      expect(deps.showAvatarDialog).toHaveBeenCalledWith("avtr_fallback");
    });

    it("Show Fallback Avatar Details: should toast error when no fallback", () => {
      userDialog.value.ref.fallbackAvatar = "";
      const { userDialogCommand } = useUserDialogCommands(userDialog, deps);
      userDialogCommand("Show Fallback Avatar Details");
      expect(deps.toast.error).toHaveBeenCalledWith("message.user.no_fallback_avatar");
    });

    it("Send Boop: should call showSendBoopDialog", () => {
      const { userDialogCommand } = useUserDialogCommands(userDialog, deps);
      userDialogCommand("Send Boop");
      expect(deps.showSendBoopDialog).toHaveBeenCalledWith("usr_test123");
    });

    it("Group Moderation: should call showModerateGroupDialog", () => {
      const { userDialogCommand } = useUserDialogCommands(userDialog, deps);
      userDialogCommand("Group Moderation");
      expect(deps.showModerateGroupDialog).toHaveBeenCalledWith("usr_test123");
    });

    it("Manage Gallery: should hide dialog and show gallery", () => {
      const { userDialogCommand } = useUserDialogCommands(userDialog, deps);
      userDialogCommand("Manage Gallery");
      expect(userDialog.value.visible).toBe(false);
      expect(deps.showGalleryPage).toHaveBeenCalled();
    });

    it("Previous Instances: should call instanceStore", () => {
      const { userDialogCommand } = useUserDialogCommands(userDialog, deps);
      userDialogCommand("Previous Instances");
      expect(deps.instanceStore.showPreviousInstancesListDialog).toHaveBeenCalledWith("user", userDialog.value.ref);
    });

    it("Invite To Group: should set invite group dialog state", () => {
      const { userDialogCommand } = useUserDialogCommands(userDialog, deps);
      userDialogCommand("Invite To Group");
      expect(deps.inviteGroupDialog.value.groupId).toBe("");
      expect(deps.inviteGroupDialog.value.userId).toBe("usr_test123");
      expect(deps.inviteGroupDialog.value.visible).toBe(true);
    });
  });

  describe("userDialogCommand — string callback commands", () => {
    it("should not throw when callback is not registered", () => {
      const { userDialogCommand } = useUserDialogCommands(userDialog, deps);
      expect(() => userDialogCommand("Edit Bio")).not.toThrow();
    });
  });

  describe("userDialogCommand — confirmed commands", () => {
    it("Delete Favorite: should confirm then delete", async () => {
      const { userDialogCommand } = useUserDialogCommands(userDialog, deps);
      userDialogCommand("Delete Favorite");
      await vi.waitFor(() => {
        expect(deps.modalStore.confirm).toHaveBeenCalled();
      });
      await vi.waitFor(() => {
        expect(mocks.deleteFavorite).toHaveBeenCalledWith({
          objectId: "usr_test123",
        });
      });
    });

    it("confirmed command should not execute when user cancels", async () => {
      deps.modalStore.confirm = vi.fn(() => Promise.resolve({ ok: false }));
      const { userDialogCommand } = useUserDialogCommands(userDialog, deps);
      userDialogCommand("Delete Favorite");
      await vi.waitFor(() => {
        expect(deps.modalStore.confirm).toHaveBeenCalled();
      });
      expect(mocks.deleteFavorite).not.toHaveBeenCalled();
    });

    it("Send Friend Request: should confirm then send", async () => {
      mocks.sendFriendRequest.mockResolvedValue({
        params: { userId: "usr_test123" },
        json: { success: true },
      });
      const { userDialogCommand } = useUserDialogCommands(userDialog, deps);
      userDialogCommand("Send Friend Request");
      await vi.waitFor(() => {
        expect(mocks.sendFriendRequest).toHaveBeenCalledWith({
          userId: "usr_test123",
        });
      });
    });

    it("Cancel Friend Request: should confirm then cancel", async () => {
      mocks.cancelFriendRequest.mockResolvedValue({
        params: { userId: "usr_test123" },
        json: {},
      });
      const { userDialogCommand } = useUserDialogCommands(userDialog, deps);
      userDialogCommand("Cancel Friend Request");
      await vi.waitFor(() => {
        expect(mocks.cancelFriendRequest).toHaveBeenCalledWith({
          userId: "usr_test123",
        });
      });
    });

    it("Moderation Block: should confirm then send moderation", async () => {
      mocks.sendPlayerModeration.mockResolvedValue({
        json: {
          targetUserId: "usr_test123",
          sourceUserId: "usr_current",
          type: "block",
        },
      });
      const { userDialogCommand } = useUserDialogCommands(userDialog, deps);
      userDialogCommand("Moderation Block");
      await vi.waitFor(() => {
        expect(mocks.sendPlayerModeration).toHaveBeenCalledWith({
          moderated: "usr_test123",
          type: "block",
        });
      });
    });

    it("Moderation Unblock: should confirm then delete moderation", async () => {
      mocks.deletePlayerModeration.mockResolvedValue({});
      const { userDialogCommand } = useUserDialogCommands(userDialog, deps);
      userDialogCommand("Moderation Unblock");
      await vi.waitFor(() => {
        expect(mocks.deletePlayerModeration).toHaveBeenCalledWith({
          moderated: "usr_test123",
          type: "block",
        });
      });
    });

    it("Report User: opens the moderation report dialog", () => {
      const showReport = vi.fn();
      const { userDialogCommand } = useUserDialogCommands(userDialog, { ...deps, showModerationReportDialog: showReport });
      userDialogCommand("Report User");
      expect(showReport).toHaveBeenCalledExactlyOnceWith({
        type: "user",
        contentId: "usr_test123",
        contentName: "TestUser",
      });
    });

    it("Unfriend: should confirm then delete friend", async () => {
      mocks.deleteFriend.mockResolvedValue({});
      const { userDialogCommand } = useUserDialogCommands(userDialog, deps);
      userDialogCommand("Unfriend");
      await vi.waitFor(() => {
        expect(mocks.deleteFriend).toHaveBeenCalledWith({ userId: "usr_test123" }, "dialog.user.actions.unfriend_success_msg");
      });
    });
  });

  describe("invite dialog state", () => {
    it("Request Invite Message: should open send invite request dialog", () => {
      const { userDialogCommand, sendInviteRequestDialogVisible, sendInviteDialog } = useUserDialogCommands(userDialog, deps);
      userDialogCommand("Request Invite Message");
      expect(sendInviteRequestDialogVisible.value).toBe(true);
      expect(sendInviteDialog.value.userId).toBe("usr_test123");
      expect(deps.refreshInviteMessageTableData).toHaveBeenCalledWith("request");
      expect(deps.clearInviteImageUpload).toHaveBeenCalled();
    });
  });

  describe("handleSendFriendRequest (internal)", () => {
    it("should add friend log and update dialog state on success", async () => {
      mocks.sendFriendRequest.mockResolvedValue({
        params: { userId: "usr_test123" },
        json: { success: true },
      });
      const { userDialogCommand } = useUserDialogCommands(userDialog, deps);
      userDialogCommand("Send Friend Request");
      await vi.waitFor(() => {
        expect(mocks.addFriendLogHistory).toHaveBeenCalled();
      });
      expect(userDialog.value.isFriend).toBe(true);
    });

    it("should set outgoingRequest when not success", async () => {
      mocks.sendFriendRequest.mockResolvedValue({
        params: { userId: "usr_test123" },
        json: { success: false },
      });
      const { userDialogCommand } = useUserDialogCommands(userDialog, deps);
      userDialogCommand("Send Friend Request");
      await vi.waitFor(() => {
        expect(mocks.addFriendLogHistory).toHaveBeenCalled();
      });
      expect(userDialog.value.outgoingRequest).toBe(true);
    });
  });

  describe("handleSendPlayerModeration (internal)", () => {
    it("should update isBlock when moderation type is block", async () => {
      deps.applyPlayerModeration = vi.fn(() => ({
        targetUserId: "usr_test123",
        sourceUserId: "usr_current",
        type: "block",
      }));
      mocks.sendPlayerModeration.mockResolvedValue({
        json: {
          targetUserId: "usr_test123",
          sourceUserId: "usr_current",
          type: "block",
        },
      });
      const { userDialogCommand } = useUserDialogCommands(userDialog, deps);
      userDialogCommand("Moderation Block");
      await vi.waitFor(() => {
        expect(userDialog.value.isBlock).toBe(true);
      });
    });

    it("should update isMute when moderation type is mute", async () => {
      deps.applyPlayerModeration = vi.fn(() => ({
        targetUserId: "usr_test123",
        sourceUserId: "usr_current",
        type: "mute",
      }));
      mocks.sendPlayerModeration.mockResolvedValue({
        json: {
          targetUserId: "usr_test123",
          sourceUserId: "usr_current",
          type: "mute",
        },
      });
      const { userDialogCommand } = useUserDialogCommands(userDialog, deps);
      userDialogCommand("Moderation Mute");
      await vi.waitFor(() => {
        expect(userDialog.value.isMute).toBe(true);
      });
    });
  });

  describe("unknown command", () => {
    it("should do nothing for unknown commands", () => {
      const { userDialogCommand } = useUserDialogCommands(userDialog, deps);
      expect(() => userDialogCommand("NonExistentCommand")).not.toThrow();
      expect(deps.modalStore.confirm).not.toHaveBeenCalled();
    });
  });
});
