import { beforeEach, describe, expect, test, vi } from "vitest";

const mockRequest = vi.fn();
const mockPatchAndRefetchActiveQuery = vi.fn(() => Promise.resolve());

const mockApplyCurrentUser = vi.fn((json) => ({
  id: json.id || "usr_me",
  ...json,
}));
const mockApplyUser = vi.fn((json) => ({ ...json }));
const mockApplyWorld = vi.fn((json) => ({ ...json }));

vi.mock("../../src/services/request", () => ({
  request: (...args) => mockRequest(...args),
}));

vi.mock("../../src/stores/user", () => ({
  useUserStore: () => ({
    currentUser: { id: "usr_me" },
    applyCurrentUser: mockApplyCurrentUser,
    applyUser: mockApplyUser,
  }),
}));
vi.mock("../../src/stores/world", () => ({
  useWorldStore: () => ({
    applyWorld: mockApplyWorld,
  }),
}));

vi.mock("../../src/coordinators/user-coordinator", () => ({
  applyCurrentUser: (...args) => mockApplyCurrentUser(...args),
  applyUser: (...args) => mockApplyUser(...args),
}));

vi.mock("../../src/coordinators/world-coordinator", () => ({
  applyWorld: (...args) => mockApplyWorld(...args),
}));

vi.mock("../../src/queries/entity-cache", () => ({
  patchAndRefetchActiveQuery: (...args) => mockPatchAndRefetchActiveQuery(...args),
}));
vi.mock("../../src/queries/keys", () => ({
  queryKeys: {
    user: (userId) => ["user", userId],
    avatar: (avatarId) => ["avatar", avatarId],
    world: (worldId) => ["world", worldId],
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

import { avatarRequest } from "../../src/api/avatar";
import { userRequest } from "../../src/api/user";
import { worldRequest } from "../../src/api/world";

describe("entity mutation query sync", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("saveCurrentUser patches and refetches active user query", async () => {
    mockRequest.mockResolvedValue({ id: "usr_me", status: "active" });

    await userRequest.saveCurrentUser({ status: "active" });

    expect(mockPatchAndRefetchActiveQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: ["user", "usr_me"],
      })
    );
  });

  test("saveAvatar patches and refetches active avatar query", async () => {
    mockRequest.mockResolvedValue({ id: "avtr_1", name: "Avatar" });

    await avatarRequest.saveAvatar({ id: "avtr_1", name: "Avatar" });

    expect(mockPatchAndRefetchActiveQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: ["avatar", "avtr_1"],
      })
    );
  });

  test("saveWorld patches and refetches active world query", async () => {
    mockRequest.mockResolvedValue({ id: "wrld_1", name: "World" });

    await worldRequest.saveWorld({ id: "wrld_1", name: "World" });

    expect(mockPatchAndRefetchActiveQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: ["world", "wrld_1"],
      })
    );
  });
});
