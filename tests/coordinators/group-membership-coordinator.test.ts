import { beforeAll, beforeEach, describe, expect, test, vi } from "vitest";

type GroupJson = { id: string; name: string; iconUrl: string; membershipStatus: string };

const mocks = vi.hoisted(() => ({
  getGroup: vi.fn<(params: { groupId: string; includeRoles?: boolean }) => Promise<{ json: GroupJson }>>(),
  applyGroup: vi.fn((json: GroupJson) => json),
  groupChange: vi.fn<(ref: GroupJson, message: string) => void>(),
  saveCurrentUserGroups: vi.fn(),
  currentUserGroups: new Map<string, unknown>(),
}));

vi.mock("../../src/api/group", () => ({ groupRequest: { getGroup: mocks.getGroup } }));
vi.mock("../../src/coordinators/group-coordinator", () => ({
  applyGroup: mocks.applyGroup,
  applyGroupMember: vi.fn(),
  groupChange: mocks.groupChange,
  handleGroupMember: vi.fn(),
  logError: vi.fn(),
  saveCurrentUserGroups: mocks.saveCurrentUserGroups,
  syncGroupSearch: vi.fn(),
}));
vi.mock("../../src/coordinators/group-dialog-coordinator", () => ({ getGroupDialogGroup: vi.fn(), showGroupDialog: vi.fn() }));
vi.mock("../../src/coordinators/search-index-coordinator", () => ({
  clearGroupSearchIndex: vi.fn(),
  removeGroupSearchIndex: vi.fn(),
  syncGroupSearchIndex: vi.fn(),
}));
vi.mock("../../src/stores/group", () => ({
  useGroupStore: () => ({ currentUserGroups: mocks.currentUserGroups, currentUserGroupsInit: true, groupDialog: { visible: false, id: "" } }),
}));
vi.mock("../../src/services/config", () => ({ configRepository: { getString: vi.fn(() => Promise.resolve("[]")) } }));
vi.mock("@/plugins/i18n", () => ({ i18n: { global: { t: (key: string) => key } } }));
vi.mock("../../src/plugins/i18n", () => ({ i18n: { global: { t: (key: string) => key } } }));

function group(membershipStatus: string): { json: GroupJson } {
  return { json: { id: "grp_a", name: "Night Owls", iconUrl: "", membershipStatus } };
}

let onGroupJoined: (groupId: string) => void;

describe("group membership history", () => {
  beforeAll(async () => {
    ({ onGroupJoined } = await import("../../src/coordinators/group-membership-coordinator"));
  }, 30000);

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.currentUserGroups.clear();
  });

  test("records joining a group once VRChat confirms the membership", async () => {
    mocks.getGroup.mockResolvedValue(group("member"));

    onGroupJoined("grp_a");

    await vi.waitFor(() => {
      expect(mocks.groupChange).toHaveBeenCalledWith(expect.objectContaining({ id: "grp_a", name: "Night Owls" }), "Joined group");
    });
    expect(mocks.groupChange).toHaveBeenCalledTimes(1);
  });

  test("records nothing when VRChat says the user is not a member", async () => {
    mocks.getGroup.mockResolvedValue(group("requested"));

    onGroupJoined("grp_a");

    await vi.waitFor(() => {
      expect(mocks.saveCurrentUserGroups).toHaveBeenCalled();
    });
    expect(mocks.groupChange).not.toHaveBeenCalled();
  });

  test("records a join only once when presence and the websocket both report it", async () => {
    mocks.getGroup.mockResolvedValue(group("member"));

    onGroupJoined("grp_a");
    onGroupJoined("grp_a");

    await vi.waitFor(() => {
      expect(mocks.groupChange).toHaveBeenCalled();
    });
    expect(mocks.getGroup).toHaveBeenCalledTimes(1);
    expect(mocks.groupChange).toHaveBeenCalledTimes(1);
  });
});
