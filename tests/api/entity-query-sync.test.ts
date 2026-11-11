import { beforeEach, describe, expect, test, vi } from "vitest";

const mockRequest = vi.fn<(endpoint: string, options: unknown) => Promise<unknown>>();
const mockPatchAndRefetchActiveQuery = vi.fn<(options: { queryKey: unknown[] }) => Promise<void>>(() => Promise.resolve());

function fallbackUserId(id: string | undefined) {
  if (id) {
    return id;
  }
  return "usr_me";
}

const mockApplyCurrentUser = vi.fn<(json: { id?: string }) => Record<string, unknown>>((json) => ({
  id: fallbackUserId(json.id),
  ...json,
}));
const mockApplyUser = vi.fn<(json: Record<string, unknown>) => Record<string, unknown>>((json) => ({ ...json }));
const mockApplyWorld = vi.fn<(json: Record<string, unknown>) => Record<string, unknown>>((json) => ({ ...json }));

vi.mock("../../src/services/request", () => ({
  request: (endpoint: string, options: unknown) => mockRequest(endpoint, options),
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
  applyCurrentUser: (json: { id?: string }) => mockApplyCurrentUser(json),
  applyUser: (json: Record<string, unknown>) => mockApplyUser(json),
}));

vi.mock("../../src/coordinators/world-coordinator", () => ({
  applyWorld: (json: Record<string, unknown>) => mockApplyWorld(json),
}));

vi.mock("../../src/queries/entity-cache", () => ({
  patchAndRefetchActiveQuery: (options: { queryKey: unknown[] }) => mockPatchAndRefetchActiveQuery(options),
}));
vi.mock("../../src/queries/keys", () => ({
  queryKeys: {
    user: (userId: string) => ["user", userId],
    avatar: (avatarId: string) => ["avatar", avatarId],
    world: (worldId: string) => ["world", worldId],
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
