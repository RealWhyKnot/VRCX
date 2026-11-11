import { beforeEach, describe, expect, test, vi } from "vitest";

const mockRequest = vi.fn();
const mockInvalidateQueries = vi.fn().mockResolvedValue();
const mockRemoveQueries = vi.fn();

vi.mock("../../src/services/request", () => ({
  request: (...args) => mockRequest(...args),
}));

vi.mock("../../src/stores/user", () => ({
  useUserStore: () => ({
    currentUser: { id: "usr_me" },
  }),
}));

vi.mock("../../src/queries/client", () => ({
  queryClient: {
    invalidateQueries: (...args) => mockInvalidateQueries(...args),
    removeQueries: (...args) => mockRemoveQueries(...args),
  },
}));
vi.mock("../../src/queries/keys", () => ({
  queryKeys: {
    galleryFiles: (params) => ["gallery", "files", params],
    prints: (params) => ["gallery", "prints", params],
    print: (printId) => ["gallery", "print", printId],
    inventoryItems: (params) => ["inventory", "items", params],
    userInventoryItem: (params) => ["inventory", "item", params.userId, params.inventoryId],
    file: (fileId) => ["file", fileId],
  },
}));

import { miscRequest } from "../../src/api/misc";
import { vrcPlusIconRequest } from "../../src/api/vrc-plus-icon";
import { vrcPlusImageRequest } from "../../src/api/vrc-plus-image";

describe("media and inventory query sync", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("media mutations invalidate gallery queries and file delete removes file query", async () => {
    mockRequest.mockResolvedValue({ ok: true });

    await vrcPlusIconRequest.deleteFile("file_icon_1");
    await vrcPlusImageRequest.deletePrint("print_1");
    await vrcPlusImageRequest.uploadEmoji("img", { tag: "emoji" });
    await miscRequest.deleteFile("file_misc_1");

    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: ["gallery"],
      refetchType: "active",
    });
    expect(mockRemoveQueries).toHaveBeenCalledWith({
      queryKey: ["file", "file_misc_1"],
      exact: true,
    });
  });
});
