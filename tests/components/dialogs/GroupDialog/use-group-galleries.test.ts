import { describe, expect, test, vi, beforeEach } from "vitest";
import { ref, type Ref } from "vue";

const mockFetch = vi.fn<(...args: unknown[]) => Promise<unknown>>();

vi.mock("../../../../src/api/query-request", () => ({
  queryRequest: {
    fetch: (...args: unknown[]) => mockFetch(...args),
  },
}));

import { useGroupGalleries, type GalleryNameSource, type GroupGalleriesSource } from "../../../../src/components/dialogs/GroupDialog/use-group-galleries";

function isGalleryNameSource(value: unknown): value is GalleryNameSource {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const name: unknown = "name" in value ? value.name : undefined;
  return name === undefined || name === null || typeof name === "string";
}

function toGalleries(value: unknown): GalleryNameSource[] {
  if (!Array.isArray(value)) {
    throw new TypeError("expected a gallery list");
  }
  const galleries = value.filter(isGalleryNameSource);
  if (galleries.length !== value.length) {
    throw new TypeError("invalid gallery entry");
  }
  return galleries;
}

function createGroupDialog(overrides: Partial<GroupGalleriesSource> = {}): Ref<GroupGalleriesSource> {
  return ref<GroupGalleriesSource>({
    visible: false,
    loading: false,
    activeTab: "",
    lastActiveTab: "",
    isGetGroupDialogGroupLoading: false,
    id: "grp_1",
    inGroup: false,
    ownerDisplayName: "",
    ref: {
      galleries: [],
    },
    announcement: {},
    posts: [],
    postsFiltered: [],
    calendar: [],
    members: [],
    memberSearch: "",
    memberSearchResults: [],
    instances: [],
    memberRoles: [],
    lastVisit: "",
    joinCount: 0,
    instancesSeen: 0,
    lastInstanceSeenAt: "",
    memberFilter: { name: "", id: null },
    memberSortOrder: { name: "", value: "" },
    postsSearch: "",
    galleries: {},
    listings: [],
    ...overrides,
  });
}

function createDeps() {
  return {
    t: (key: string) => key,
    modalStore: {
      confirm: () => Promise.resolve({ ok: true }),
    },
    currentUser: ref({ id: "usr_me" }),
  };
}

describe("useGroupGalleries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("groupGalleryTabs", () => {
    test("returns empty array when no galleries", () => {
      const groupDialog = createGroupDialog();
      const { groupGalleryTabs } = useGroupGalleries(groupDialog, createDeps());
      expect(groupGalleryTabs.value).toEqual([]);
    });

    test("maps galleries to tabs with index values", () => {
      const groupDialog = createGroupDialog({
        ref: {
          galleries: [
            { id: "g1", name: "Photos" },
            { id: "g2", name: "Screenshots" },
          ],
        },
      });
      const { groupGalleryTabs } = useGroupGalleries(groupDialog, createDeps());
      expect(groupGalleryTabs.value).toEqual([
        { value: "0", label: "Photos" },
        { value: "1", label: "Screenshots" },
      ]);
    });

    test("handles galleries with null name", () => {
      const groupDialog = createGroupDialog({
        ref: {
          galleries: toGalleries([{ id: "g1", name: null }]),
        },
      });
      const { groupGalleryTabs } = useGroupGalleries(groupDialog, createDeps());
      expect(groupGalleryTabs.value).toEqual([{ value: "0", label: "" }]);
    });

    test("is reactive to gallery changes", () => {
      const groupDialog = createGroupDialog();
      const { groupGalleryTabs } = useGroupGalleries(groupDialog, createDeps());
      expect(groupGalleryTabs.value).toHaveLength(0);

      groupDialog.value.ref.galleries = [{ id: "g1", name: "New Gallery" }];
      expect(groupGalleryTabs.value).toHaveLength(1);
    });
  });

  describe("groupGalleryStatus", () => {
    test("returns blue for non-members-only gallery", () => {
      const groupDialog = createGroupDialog();
      const { groupGalleryStatus } = useGroupGalleries(groupDialog, createDeps());
      expect(groupGalleryStatus({ membersOnly: false })).toEqual({
        blue: true,
      });
    });

    test("returns green for members-only without role restriction", () => {
      const groupDialog = createGroupDialog();
      const { groupGalleryStatus } = useGroupGalleries(groupDialog, createDeps());
      expect(groupGalleryStatus({ membersOnly: true, roleIdsToView: null })).toEqual({ green: true });
    });

    test("returns red for role-restricted gallery", () => {
      const groupDialog = createGroupDialog();
      const { groupGalleryStatus } = useGroupGalleries(groupDialog, createDeps());
      expect(
        groupGalleryStatus({
          membersOnly: true,
          roleIdsToView: ["role1"],
        })
      ).toEqual({ red: true });
    });
  });

  describe("getGroupGalleries", () => {
    test("resets galleries and tab before loading", async () => {
      const groupDialog = createGroupDialog({
        galleries: { old: [{ id: "img_old" }] },
      });
      const { getGroupGalleries, groupDialogGalleryCurrentName } = useGroupGalleries(groupDialog, createDeps());
      groupDialogGalleryCurrentName.value = "2";

      await getGroupGalleries();

      expect(groupDialogGalleryCurrentName.value).toBe("0");
    });

    test("sets loading state correctly during fetch", async () => {
      const groupDialog = createGroupDialog({
        ref: {
          galleries: [{ id: "g1", name: "Gallery" }],
        },
      });
      mockFetch.mockResolvedValue({
        json: [],
        params: { groupId: "grp_1" },
      });

      const { getGroupGalleries, isGroupGalleryLoading } = useGroupGalleries(groupDialog, createDeps());
      expect(isGroupGalleryLoading.value).toBe(false);

      const promise = getGroupGalleries();
      expect(isGroupGalleryLoading.value).toBe(true);

      await promise;
      expect(isGroupGalleryLoading.value).toBe(false);
    });

    test("calls getCachedGroupGallery for each gallery", async () => {
      const groupDialog = createGroupDialog({
        ref: {
          galleries: [
            { id: "g1", name: "A" },
            { id: "g2", name: "B" },
          ],
        },
      });
      mockFetch.mockResolvedValue({
        json: [],
        params: { groupId: "grp_1" },
      });

      const { getGroupGalleries } = useGroupGalleries(groupDialog, createDeps());
      await getGroupGalleries();

      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });

  describe("getGroupGallery", () => {
    test("populates gallery images from API response", async () => {
      const groupDialog = createGroupDialog();
      const { getGroupGallery } = useGroupGalleries(groupDialog, createDeps());

      mockFetch.mockResolvedValueOnce({
        json: [
          {
            groupId: "grp_1",
            galleryId: "g1",
            id: "img1",
            imageUrl: "url1",
          },
          {
            groupId: "grp_1",
            galleryId: "g1",
            id: "img2",
            imageUrl: "url2",
          },
        ],
        params: { groupId: "grp_1" },
      });

      await getGroupGallery("grp_1", "g1");

      expect(groupDialog.value.galleries["g1"]).toHaveLength(2);
      expect(groupDialog.value.galleries["g1"]?.[0]?.id).toBe("img1");
    });

    test("ignores images from different groups", async () => {
      const groupDialog = createGroupDialog();
      const { getGroupGallery } = useGroupGalleries(groupDialog, createDeps());

      mockFetch.mockResolvedValueOnce({
        json: [
          {
            groupId: "grp_other",
            galleryId: "g1",
            id: "img1",
            imageUrl: "url1",
          },
        ],
        params: { groupId: "grp_other" },
      });

      await getGroupGallery("grp_1", "g1");

      expect(groupDialog.value.galleries["g1"]).toBeUndefined();
    });

    test("stops pagination when fewer than 100 results returned", async () => {
      const groupDialog = createGroupDialog();
      const { getGroupGallery } = useGroupGalleries(groupDialog, createDeps());

      mockFetch.mockResolvedValueOnce({
        json: Array.from({ length: 50 }, (_, i) => ({
          groupId: "grp_1",
          galleryId: "g1",
          id: `img${i}`,
          imageUrl: `url${i}`,
        })),
        params: { groupId: "grp_1" },
      });

      await getGroupGallery("grp_1", "g1");

      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    test("handles API errors gracefully", async () => {
      const groupDialog = createGroupDialog();
      const { getGroupGallery } = useGroupGalleries(groupDialog, createDeps());
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

      mockFetch.mockRejectedValueOnce(new Error("API Error"));

      await expect(getGroupGallery("grp_1", "g1")).resolves.toBeUndefined();
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });
});
