import { beforeEach, describe, expect, test, vi } from "vitest";

const mockRequest = vi.fn<(...args: unknown[]) => unknown>();
const mockInvalidateQueries = vi.fn<(...args: unknown[]) => Promise<void>>().mockResolvedValue(undefined);
const mockApplyGroup = vi.fn<(...args: unknown[]) => unknown>((json) => json);

vi.mock("../../src/services/request", () => ({
  request: (...args: unknown[]) => mockRequest(...args),
}));

vi.mock("../../src/stores/group", () => ({
  useGroupStore: () => ({
    applyGroup: (...args: unknown[]) => mockApplyGroup(...args),
  }),
}));
vi.mock("../../src/stores/user", () => ({
  useUserStore: () => ({
    currentUser: { id: "usr_me" },
  }),
}));

vi.mock("../../src/queries/client", () => ({
  queryClient: {
    invalidateQueries: (...args: unknown[]) => mockInvalidateQueries(...args),
  },
}));
vi.mock("../../src/queries/policies", () => ({
  entityQueryPolicies: {
    user: {},
    avatar: {},
    world: {},
    worldCollection: {},
  },
}));

import { groupRequest } from "../../src/api/group";

describe("group query sync", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("group mutations invalidate scoped active group queries", async () => {
    mockRequest.mockResolvedValue({ ok: true });

    await groupRequest.setGroupRepresentation("grp_1", {
      isRepresenting: true,
    });
    await groupRequest.deleteGroupPost({
      groupId: "grp_1",
      postId: "post_1",
    });
    await groupRequest.setGroupMemberProps("usr_me", "grp_1", {
      visibility: "visible",
    });

    expect(mockInvalidateQueries).toHaveBeenCalledTimes(3);
    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: ["group", "grp_1"],
      refetchType: "active",
    });
  });
});
