import { beforeEach, describe, expect, test, vi } from "vitest";

const mockRequest = vi.fn<(...args: unknown[]) => unknown>();
const mockInvalidateQueries = vi.fn<(...args: unknown[]) => Promise<void>>().mockResolvedValue(undefined);
const mockHandleFavoriteAdd = vi.fn<(...args: unknown[]) => unknown>();
const mockHandleFavoriteDelete = vi.fn<(...args: unknown[]) => unknown>();
const mockHandleFavoriteGroupClear = vi.fn<(...args: unknown[]) => unknown>();

vi.mock("../../src/services/request", () => ({
  request: (...args: unknown[]) => mockRequest(...args),
}));

vi.mock("../../src/stores/user", () => ({
  useUserStore: () => ({
    currentUser: { id: "usr_me" },
  }),
}));

vi.mock("../../src/coordinators/favorite-coordinator", () => ({
  handleFavoriteAdd: (...args: unknown[]) => mockHandleFavoriteAdd(...args),
  handleFavoriteDelete: (...args: unknown[]) => mockHandleFavoriteDelete(...args),
  handleFavoriteGroupClear: (...args: unknown[]) => mockHandleFavoriteGroupClear(...args),
}));

vi.mock("../../src/queries/client", () => ({
  queryClient: {
    invalidateQueries: (...args: unknown[]) => mockInvalidateQueries(...args),
  },
}));

import { favoriteRequest } from "../../src/api/favorite";

describe("favorite query sync", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("favorite mutations invalidate active favorite queries", async () => {
    mockRequest.mockResolvedValue({ ok: true });

    await favoriteRequest.addFavorite({
      type: "world",
      favoriteId: "wrld_1",
      tags: "worlds1",
    });
    await favoriteRequest.deleteFavorite({ objectId: "fav_1" });
    await favoriteRequest.saveFavoriteGroup({
      type: "world",
      group: "worlds1",
      displayName: "Worlds",
    });
    await favoriteRequest.clearFavoriteGroup({
      type: "world",
      group: "worlds1",
    });

    expect(mockInvalidateQueries).toHaveBeenCalledTimes(4);
    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: ["favorite"],
      refetchType: "active",
    });
  });
});
