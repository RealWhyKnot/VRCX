import { beforeEach, describe, expect, test, vi } from "vitest";
import type { SearchWorlds } from "vrchat";

type FetchPolicyOptions = {
  queryKey: readonly unknown[];
  policy: Record<string, unknown>;
  queryFn: () => Promise<unknown>;
  label: string;
};

type FetchPolicyResult = {
  data: unknown;
  cache: boolean;
};

type Params = Record<string, unknown>;

const mockFetchWithEntityPolicy = vi.fn<(options: FetchPolicyOptions) => Promise<FetchPolicyResult>>();
const mockGetUser = vi.fn<(params: { userId: string }) => Promise<unknown>>();
const mockGetWorlds = vi.fn<(params: Params, option?: string) => Promise<unknown>>();
const mockGetGroupCalendar = vi.fn<(groupId: string) => Promise<unknown>>();

vi.mock("../../src/queries/client", () => ({
  queryClient: {
    invalidateQueries: vi.fn().mockResolvedValue(undefined),
  },
}));
vi.mock("../../src/queries/policies", () => ({
  entityQueryPolicies: {
    user: {
      staleTime: 20000,
      gcTime: 90000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
    worldCollection: {
      staleTime: 60000,
      gcTime: 300000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
    groupCollection: {
      staleTime: 60000,
      gcTime: 300000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
    groupCalendarCollection: {
      staleTime: 120000,
      gcTime: 600000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
    groupFollowingCalendarCollection: {
      staleTime: 60000,
      gcTime: 300000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
    groupFeaturedCalendarCollection: {
      staleTime: 300000,
      gcTime: 900000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
    groupCalendarEvent: {
      staleTime: 120000,
      gcTime: 600000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
    avatar: {
      staleTime: 60000,
      gcTime: 300000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
    avatarCollection: {
      staleTime: 60000,
      gcTime: 300000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
    avatarGallery: {
      staleTime: 30000,
      gcTime: 120000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
    world: {
      staleTime: 60000,
      gcTime: 300000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
    group: {
      staleTime: 60000,
      gcTime: 300000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
    friendList: {
      staleTime: 20000,
      gcTime: 90000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
    favoriteCollection: {
      staleTime: 60000,
      gcTime: 300000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
    galleryCollection: {
      staleTime: 60000,
      gcTime: 300000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
    inventoryCollection: {
      staleTime: 20000,
      gcTime: 120000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
    inventoryObject: {
      staleTime: 60000,
      gcTime: 300000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
    fileAnalysis: {
      staleTime: 120000,
      gcTime: 600000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
    worldPersistData: {
      staleTime: 120000,
      gcTime: 600000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
    mutualCounts: {
      staleTime: 120000,
      gcTime: 600000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
    visits: {
      staleTime: 300000,
      gcTime: 900000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
    fileObject: {
      staleTime: 60000,
      gcTime: 300000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
}));
vi.mock("../../src/queries/entity-cache", () => ({
  fetchWithEntityPolicy: (options: FetchPolicyOptions) => mockFetchWithEntityPolicy(options),
}));
vi.mock("../../src/queries/keys", () => ({
  queryKeys: {
    user: (userId: string) => ["user", userId],
    avatars: (params: Params) => ["avatar", "list", params],
    worldsByUser: (params: Params) => ["worlds", "user", params["userId"], params],
    groupCalendar: (groupId: string) => ["group", groupId, "calendar"],
    groupCalendars: (params: Params) => ["group", "calendar", params],
    followingGroupCalendars: (params: Params) => ["group", "calendar", "following", params],
    featuredGroupCalendars: (params: Params) => ["group", "calendar", "featured", params],
    avatar: (avatarId: string) => ["avatar", avatarId],
    world: (worldId: string) => ["world", worldId],
    group: (groupId: string, includeRoles: unknown) => ["group", groupId, Boolean(includeRoles)],
    groupPosts: (params: Params) => ["group", params["groupId"], "posts", params],
    groupMember: (params: Params) => ["group", params["groupId"], "member", params["userId"]],
    groupMembers: (params: Params) => ["group", params["groupId"], "members", params],
    groupGallery: (params: Params) => ["group", params["groupId"], "gallery", params["galleryId"], params],
    groupCalendarEvent: (params: Params) => ["group", params["groupId"], "calendarEvent", params["eventId"]],
    avatarGallery: (avatarId: string) => ["avatar", avatarId, "gallery"],
    friends: (params: Params) => ["friends", params],
    favoriteLimits: () => ["favorite", "limits"],
    favorites: (params: Params) => ["favorite", "items", params],
    favoriteGroups: (params: Params) => ["favorite", "groups", params],
    favoriteWorlds: (params: Params) => ["favorite", "worlds", params],
    favoriteAvatars: (params: Params) => ["favorite", "avatars", params],
    galleryFiles: (params: Params) => ["gallery", "files", params],
    prints: (params: Params) => ["gallery", "prints", params],
    print: (printId: string) => ["gallery", "print", printId],
    inventoryItem: (inventoryId: string) => ["inventory", "item", inventoryId],
    userInventoryItem: (params: Params) => ["inventory", "item", params["userId"], params["inventoryId"]],
    inventoryItems: (params: Params) => ["inventory", "items", params],
    inventoryTemplate: (inventoryTemplateId: string) => ["inventory", "template", inventoryTemplateId],
    fileAnalysis: (params: Params) => ["analysis", params["fileId"], Number(params["version"]), typeof params["variant"] === "string" ? params["variant"] : ""],
    worldPersistData: (worldId: string) => ["world", worldId, "persistData"],
    mutualCounts: (userId: string) => ["user", userId, "mutualCounts"],
    visits: () => ["visits"],
    file: (fileId: string) => ["file", fileId],
  },
}));

vi.mock("../../src/api/user", () => ({
  userRequest: {
    getUser: (params: { userId: string }) => mockGetUser(params),
    getMutualCounts: vi.fn(),
  },
}));

vi.mock("../../src/api/world", () => ({
  worldRequest: {
    getWorlds: (...args: [Params, string?]) => mockGetWorlds(...args),
    getWorld: vi.fn(),
  },
}));

vi.mock("../../src/api/group", () => ({
  groupRequest: {
    getGroupCalendar: (groupId: string) => mockGetGroupCalendar(groupId),
    getGroup: vi.fn(),
    getGroupPosts: vi.fn(),
    getGroupMember: vi.fn(),
    getGroupMembers: vi.fn(),
    getGroupGallery: vi.fn(),
    getGroupCalendarEvent: vi.fn(),
    getGroupCalendars: vi.fn(),
    getFollowingGroupCalendars: vi.fn(),
    getFeaturedGroupCalendars: vi.fn(),
  },
}));

vi.mock("../../src/api/avatar", () => ({
  avatarRequest: {
    getAvatar: vi.fn(),
    getAvatarGallery: vi.fn(),
    getAvatars: vi.fn(),
  },
}));
vi.mock("../../src/api/friend", () => ({ friendRequest: { getFriends: vi.fn() } }));
vi.mock("../../src/api/favorite", () => ({
  favoriteRequest: {
    getFavoriteLimits: vi.fn(),
    getFavorites: vi.fn(),
    getFavoriteGroups: vi.fn(),
    getFavoriteWorlds: vi.fn(),
    getFavoriteAvatars: vi.fn(),
  },
}));
vi.mock("../../src/api/vrc-plus-icon", () => ({ vrcPlusIconRequest: { getFileList: vi.fn() } }));
vi.mock("../../src/api/vrc-plus-image", () => ({
  vrcPlusImageRequest: { getPrints: vi.fn(), getPrint: vi.fn() },
}));
vi.mock("../../src/api/inventory", () => ({
  inventoryRequest: {
    getUserInventoryItem: vi.fn(),
    getInventoryItem: vi.fn(),
    getInventoryItems: vi.fn(),
    getInventoryTemplate: vi.fn(),
  },
}));
vi.mock("../../src/api/misc", () => ({
  miscRequest: {
    getFile: vi.fn(),
    getFileAnalysis: vi.fn(),
    getVisits: vi.fn(),
    hasWorldPersistData: vi.fn(),
  },
}));

import { queryRequest } from "../../src/api/query-request";

describe("queryRequest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("routes user fetch through policy wrapper and returns cache marker", async () => {
    const data = { json: { id: "usr_1" }, params: { userId: "usr_1" } };
    mockGetUser.mockResolvedValue(data);
    mockFetchWithEntityPolicy.mockImplementation(async ({ queryFn }) => ({
      data: await queryFn(),
      cache: true,
    }));

    const args = await queryRequest.fetch("user", { userId: "usr_1" });

    expect(mockFetchWithEntityPolicy).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: ["user", "usr_1"],
      })
    );
    expect(args.cache).toBe(true);
    expect(args.json.id).toBe("usr_1");
  });

  test("uses same queryKey for user and user.dialog callers", async () => {
    const data = { json: { id: "usr_1" }, params: { userId: "usr_1" } };
    mockGetUser.mockResolvedValue(data);
    mockFetchWithEntityPolicy.mockImplementation(async ({ queryFn }) => ({
      data: await queryFn(),
      cache: false,
    }));

    await queryRequest.fetch("user", { userId: "usr_1" });
    await queryRequest.fetch("user.dialog", { userId: "usr_1" });

    const baseCall = mockFetchWithEntityPolicy.mock.calls[0]?.[0];
    const dialogCall = mockFetchWithEntityPolicy.mock.calls[1]?.[0];
    expect(baseCall?.queryKey).toEqual(["user", "usr_1"]);
    expect(dialogCall?.queryKey).toEqual(baseCall?.queryKey);
  });

  test("applies staleTime zero for user.force", async () => {
    const data = { json: { id: "usr_2" }, params: { userId: "usr_2" } };
    mockGetUser.mockResolvedValue(data);
    mockFetchWithEntityPolicy.mockImplementation(async ({ queryFn }) => ({
      data: await queryFn(),
      cache: false,
    }));

    await queryRequest.fetch("user.force", { userId: "usr_2" });

    expect(mockFetchWithEntityPolicy.mock.calls[0]?.[0]).toMatchObject({
      policy: { staleTime: 0 },
      label: "user.force",
    });
  });

  test("applies staleTime 60000 for user.dialog", async () => {
    const data = { json: { id: "usr_3" }, params: { userId: "usr_3" } };
    mockGetUser.mockResolvedValue(data);
    mockFetchWithEntityPolicy.mockImplementation(async ({ queryFn }) => ({
      data: await queryFn(),
      cache: false,
    }));

    await queryRequest.fetch("user.dialog", { userId: "usr_3" });

    expect(mockFetchWithEntityPolicy.mock.calls[0]?.[0]).toMatchObject({
      policy: { staleTime: 60_000 },
      label: "user.dialog",
    });
  });

  test("supports worldsByUser option routing", async () => {
    const params: SearchWorlds["query"] & { userId: string; option: string } = {
      userId: "usr_me",
      n: 50,
      offset: 0,
      sort: "updated",
      order: "descending",
      user: "me",
      releaseStatus: "all",
      option: "featured",
    };
    mockGetWorlds.mockResolvedValue({ json: [], params });
    mockFetchWithEntityPolicy.mockImplementation(async ({ queryFn }) => ({
      data: await queryFn(),
      cache: false,
    }));

    await queryRequest.fetch("worldsByUser", params);

    expect(mockGetWorlds).toHaveBeenCalledWith(params, "featured");
    expect(mockFetchWithEntityPolicy).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: ["worlds", "user", "usr_me", params],
      })
    );
  });

  test("supports groupCalendar resource shape", async () => {
    mockGetGroupCalendar.mockResolvedValue({
      json: { results: [] },
      params: { groupId: "grp_1" },
    });
    mockFetchWithEntityPolicy.mockImplementation(async ({ queryFn }) => ({
      data: await queryFn(),
      cache: false,
    }));

    await queryRequest.fetch("groupCalendar", { groupId: "grp_1" });

    expect(mockGetGroupCalendar).toHaveBeenCalledWith("grp_1");
    expect(mockFetchWithEntityPolicy).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: ["group", "grp_1", "calendar"],
      })
    );
  });

  test("throws on unknown resource", async () => {
    const pending: unknown = Reflect.apply(queryRequest.fetch.bind(queryRequest), undefined, ["missing_resource", {}]);
    await expect(pending).rejects.toThrow("Unknown query resource");
  });

  test("throws on unknown caller variant", async () => {
    const pending: unknown = Reflect.apply(queryRequest.fetch.bind(queryRequest), undefined, ["user.unknown", { userId: "usr_1" }]);
    await expect(pending).rejects.toThrow("Unknown query resource: user.unknown");
  });
});
