import { beforeEach, describe, expect, it, vi } from "vitest";
import { ref, type Ref } from "vue";

import { useGroupDialogCommands } from "../../../../src/components/dialogs/GroupDialog/use-group-dialog-commands";
import type { GroupDialogState } from "../../../../src/stores/group-types";

vi.mock("../../../../src/shared/utils/app-actions", () => ({
  copyToClipboard: vi.fn(),
}));

type CommandDialogState = Pick<GroupDialogState, "visible" | "id" | "ref">;
type CommandDeps = Parameters<typeof useGroupDialogCommands>[1];
type ConfirmResult = { ok: boolean };

function createGroupDialog(overrides: Partial<CommandDialogState> = {}): Ref<CommandDialogState> {
  return ref<CommandDialogState>({
    visible: true,
    id: "grp_123",
    ref: {},
    ...overrides,
  });
}

function createDeps(overrides: Partial<CommandDeps> = {}): CommandDeps {
  return {
    t: vi.fn<(key: string) => string>((key) => key),
    modalStore: {
      confirm: vi.fn<(options: Parameters<CommandDeps["modalStore"]["confirm"]>[0]) => Promise<ConfirmResult>>().mockResolvedValue({ ok: true }),
    },
    currentUser: ref({ id: "usr_current" }),
    showGroupDialog: vi.fn<CommandDeps["showGroupDialog"]>(),
    leaveGroupPrompt: vi.fn<CommandDeps["leaveGroupPrompt"]>(),
    setGroupVisibility: vi.fn<CommandDeps["setGroupVisibility"]>(() => Promise.resolve()),
    setGroupSubscription: vi.fn<CommandDeps["setGroupSubscription"]>(() => Promise.resolve()),
    setGroupEventAnnouncements: vi.fn<CommandDeps["setGroupEventAnnouncements"]>(() => Promise.resolve()),
    showPreviousInstancesListDialog: vi.fn<CommandDeps["showPreviousInstancesListDialog"]>(),
    showGroupMemberModerationDialog: vi.fn<CommandDeps["showGroupMemberModerationDialog"]>(),
    showGroupRolesDialog: vi.fn<CommandDeps["showGroupRolesDialog"]>(),
    showInviteGroupDialog: vi.fn<CommandDeps["showInviteGroupDialog"]>(),
    showGroupTransferDialog: vi.fn<CommandDeps["showGroupTransferDialog"]>(),
    showGroupPostEditDialog: vi.fn<CommandDeps["showGroupPostEditDialog"]>(),
    groupRequest: {
      blockGroup: vi.fn<CommandDeps["groupRequest"]["blockGroup"]>().mockResolvedValue({
        params: { groupId: "grp_123" },
      }),
      unblockGroup: vi.fn<CommandDeps["groupRequest"]["unblockGroup"]>().mockResolvedValue({
        params: { groupId: "grp_123" },
      }),
    },
    ...overrides,
  };
}

describe("useGroupDialogCommands", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns early when dialog is not visible", () => {
    const groupDialog = createGroupDialog({ visible: false });
    const deps = createDeps();
    const { groupDialogCommand } = useGroupDialogCommands(groupDialog, deps);

    groupDialogCommand("Refresh");
    expect(deps.showGroupDialog).not.toHaveBeenCalled();
  });

  it("Invite To Group dispatches invite callback", () => {
    const groupDialog = createGroupDialog();
    const deps = createDeps();
    const { groupDialogCommand } = useGroupDialogCommands(groupDialog, deps);

    groupDialogCommand("Invite To Group");
    expect(deps.showInviteGroupDialog).toHaveBeenCalledWith("grp_123", "");
  });

  it("Refresh calls showGroupDialog with forceRefresh", () => {
    const groupDialog = createGroupDialog();
    const deps = createDeps();
    const { groupDialogCommand } = useGroupDialogCommands(groupDialog, deps);

    groupDialogCommand("Refresh");
    expect(deps.showGroupDialog).toHaveBeenCalledWith("grp_123", {
      forceRefresh: true,
    });
  });

  it("Block Group confirms and calls blockGroup", async () => {
    const groupDialog = createGroupDialog();
    const deps = createDeps();
    const { groupDialogCommand } = useGroupDialogCommands(groupDialog, deps);

    groupDialogCommand("Block Group");
    await vi.waitFor(() => {
      expect(deps.modalStore.confirm).toHaveBeenCalled();
      expect(deps.groupRequest.blockGroup).toHaveBeenCalledWith({
        groupId: "grp_123",
      });
      expect(deps.showGroupDialog).toHaveBeenCalledWith("grp_123");
    });
  });

  it("Unblock Group confirms and calls unblockGroup", async () => {
    const groupDialog = createGroupDialog();
    const deps = createDeps();
    const { groupDialogCommand } = useGroupDialogCommands(groupDialog, deps);

    groupDialogCommand("Unblock Group");
    await vi.waitFor(() => {
      expect(deps.modalStore.confirm).toHaveBeenCalled();
      expect(deps.groupRequest.unblockGroup).toHaveBeenCalledWith({
        groupId: "grp_123",
        userId: "usr_current",
      });
      expect(deps.showGroupDialog).toHaveBeenCalledWith("grp_123");
    });
  });

  it("does not run confirmed action when confirmation is cancelled", async () => {
    const groupDialog = createGroupDialog();
    const deps = createDeps({
      modalStore: {
        confirm: vi.fn<CommandDeps["modalStore"]["confirm"]>().mockResolvedValue({ ok: false }),
      },
    });
    const { groupDialogCommand } = useGroupDialogCommands(groupDialog, deps);

    groupDialogCommand("Block Group");
    await vi.waitFor(() => {
      expect(deps.modalStore.confirm).toHaveBeenCalled();
    });
    expect(deps.groupRequest.blockGroup).not.toHaveBeenCalled();
  });
});
