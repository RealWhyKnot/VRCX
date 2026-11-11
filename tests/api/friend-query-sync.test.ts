import { beforeEach, describe, expect, test, vi } from "vitest";

const mockRequest = vi.fn<(...args: unknown[]) => Promise<unknown>>();
const mockInvalidateQueries = vi.fn<(...args: unknown[]) => Promise<void>>().mockResolvedValue(undefined);
const mockApplyUser = vi.fn((json: unknown) => json);

vi.mock("../../src/services/request", () => ({
  request: (...args: unknown[]) => mockRequest(...args),
}));

vi.mock("../../src/stores/user", () => ({
  useUserStore: () => ({
    applyUser: (json: unknown) => mockApplyUser(json),
  }),
}));

vi.mock("../../src/coordinators/user-coordinator", () => ({
  applyUser: (json: unknown) => mockApplyUser(json),
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

import { friendRequest } from "../../src/api/friend";

describe("friend query sync", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("friend mutations invalidate active friends queries", async () => {
    mockRequest.mockResolvedValue({ ok: true });

    await friendRequest.sendFriendRequest({ userId: "usr_1" });
    await friendRequest.cancelFriendRequest({ userId: "usr_1" });
    await friendRequest.deleteFriend({ userId: "usr_1" });

    expect(mockInvalidateQueries).toHaveBeenCalledTimes(3);
    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: ["friends"],
      refetchType: "active",
    });
  });
});
