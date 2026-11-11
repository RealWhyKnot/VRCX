import { describe, expect, test, vi, beforeEach, afterEach } from "vitest";
import { ref, type Ref } from "vue";

const mockGetGroupMembersSearch = vi.fn<(...args: unknown[]) => Promise<unknown>>();
const mockQueryFetch = vi.fn<(...args: unknown[]) => Promise<unknown>>();

vi.mock("../../../../src/api/group", () => ({
  groupRequest: {
    getGroupMembersSearch: (...args: unknown[]) => mockGetGroupMembersSearch(...args),
  },
}));
vi.mock("../../../../src/api/query-request", () => ({
  queryRequest: {
    fetch: (...args: unknown[]) => mockQueryFetch(...args),
  },
}));
vi.mock("../../../../src/api/user", () => ({
  userRequest: {},
}));
vi.mock("../../../../src/plugins/router", async () => {
  const vue = await import("vue");

  const { ref } = vue;
  return {
    router: {
      beforeEach: vi.fn(),
      push: vi.fn(),
      replace: vi.fn(),
      currentRoute: ref({ path: "/", name: "", meta: {} }),
      isReady: vi.fn().mockResolvedValue(true),
    },
    initRouter: vi.fn(),
  };
});
vi.mock("vue-router", async (importOriginal) => {
  const vue = await import("vue");

  const actual = await importOriginal<Record<string, unknown>>();
  const { ref } = vue;
  return {
    ...actual,
    useRouter: vi.fn(() => ({
      push: vi.fn(),
      replace: vi.fn(),
      currentRoute: ref({ path: "/", name: "", meta: {} }),
    })),
  };
});
vi.mock("../../../../src/plugins/interop-api", () => ({ initInteropApi: vi.fn() }));
vi.mock("../../../../src/services/database", () => ({
  database: new Proxy(
    {},
    {
      get: (_target, prop) => {
        if (prop === "__esModule") return false;
        return vi.fn().mockResolvedValue(null);
      },
    }
  ),
}));
vi.mock("../../../../src/services/config", () => ({
  configRepository: {
    init: vi.fn(),
    getString: vi.fn((_k: string, d?: string) => d ?? "{}"),
    setString: vi.fn(),
    getBool: vi.fn((_k: string, isDefault?: boolean) => isDefault ?? false),
    setBool: vi.fn(),
    getInt: vi.fn((_k: string, d?: number) => d ?? 0),
    setInt: vi.fn(),
    getFloat: vi.fn((_k: string, d?: number) => d ?? 0),
    setFloat: vi.fn(),
    getObject: vi.fn().mockReturnValue(null),
    setObject: vi.fn(),
    getArray: vi.fn().mockReturnValue([]),
    setArray: vi.fn(),
    remove: vi.fn(),
  },
}));
vi.mock("../../../../src/services/json-storage", () => ({ VrcxJsonStorage: vi.fn() }));
vi.mock("../../../../src/services/watch-state", () => ({
  watchState: { isLoggedIn: false },
}));
vi.mock("../../../../src/services/request", () => ({
  request: vi.fn().mockResolvedValue({ json: {} }),
  processBulk: vi.fn(),
  buildRequestInit: vi.fn(),
  parseResponse: vi.fn(),
  shouldIgnoreError: vi.fn(),
  $throw: vi.fn(),
  failedGetRequests: new Map(),
}));
vi.mock("vue-i18n", async () => {
  const vue = await import("vue");
  return {
    useI18n: () => ({
      t: (key: string) => key,
      locale: vue.ref("en"),
    }),
    createI18n: () => ({
      global: { t: (key: string) => key, locale: vue.ref("en") },
      install: vi.fn(),
    }),
  };
});
vi.mock("worker-timers", () => ({
  get setTimeout() {
    return globalThis.setTimeout;
  },
  get clearTimeout() {
    return globalThis.clearTimeout;
  },
}));

import { useGroupMembers, type GroupMembersSource } from "../../../../src/components/dialogs/GroupDialog/use-group-members";
import { FILTER_EVERYONE } from "../../../../src/shared/constants/group";

type MembersDeps = Parameters<typeof useGroupMembers>[1];

function createGroupDialog(overrides: Partial<GroupMembersSource> = {}): Ref<GroupMembersSource> {
  return ref<GroupMembersSource>({
    visible: true,
    loading: false,
    activeTab: "",
    lastActiveTab: "",
    isGetGroupDialogGroupLoading: false,
    id: "grp_1",
    inGroup: false,
    ownerDisplayName: "",
    ref: { roles: [], memberCount: 0 },
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
    memberSortOrder: { value: "" },
    memberFilter: { id: null, name: "Everyone" },
    postsSearch: "",
    galleries: {},
    listings: [],
    ...overrides,
  });
}

type MemberEntry = GroupMembersSource["members"][number];

function createMember(overrides: Partial<MemberEntry> & Pick<MemberEntry, "userId">): MemberEntry {
  return {
    groupId: "grp_1",
    id: "gm_1",
    isRepresenting: false,
    mRoleIds: [],
    roleIds: [],
    ...overrides,
  };
}

function createDeps(overrides: Partial<MembersDeps> = {}): MembersDeps {
  return {
    currentUser: ref({ id: "usr_me" }),
    applyGroupMember: vi.fn<MembersDeps["applyGroupMember"]>((json) => json),
    handleGroupMember: vi.fn<MembersDeps["handleGroupMember"]>(),
    t: (key: string) => key,
    ...overrides,
  };
}

describe("useGroupMembers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockQueryFetch.mockReset();
  });

  describe("groupDialogMemberSortValue", () => {
    test("returns current sort order value", () => {
      const groupDialog = createGroupDialog({
        memberSortOrder: { value: "joinedAt:desc", name: "sort.joined" },
      });
      const { groupDialogMemberSortValue } = useGroupMembers(groupDialog, createDeps());
      expect(groupDialogMemberSortValue.value).toBe("joinedAt:desc");
    });

    test("returns empty string when no sort order", () => {
      const groupDialog = createGroupDialog({
        memberSortOrder: {},
      });
      const { groupDialogMemberSortValue } = useGroupMembers(groupDialog, createDeps());
      expect(groupDialogMemberSortValue.value).toBe("");
    });
  });

  describe("groupDialogMemberFilterKey", () => {
    test("returns everyone when filter id is null", () => {
      const groupDialog = createGroupDialog({
        memberFilter: { id: null, name: "Everyone" },
      });
      const { groupDialogMemberFilterKey } = useGroupMembers(groupDialog, createDeps());
      expect(groupDialogMemberFilterKey.value).toBe("everyone");
    });

    test("returns usersWithNoRole when filter id is empty string", () => {
      const groupDialog = createGroupDialog({ memberFilter: { id: "", name: "No role" } });
      const { groupDialogMemberFilterKey } = useGroupMembers(groupDialog, createDeps());
      expect(groupDialogMemberFilterKey.value).toBe("usersWithNoRole");
    });

    test("returns role:id for role-based filters", () => {
      const groupDialog = createGroupDialog({
        memberFilter: { id: "role_123", name: "Admin" },
      });
      const { groupDialogMemberFilterKey } = useGroupMembers(groupDialog, createDeps());
      expect(groupDialogMemberFilterKey.value).toBe("role:role_123");
    });

    test("returns null when no filter", () => {
      const groupDialog = createGroupDialog({ memberFilter: null });
      const { groupDialogMemberFilterKey } = useGroupMembers(groupDialog, createDeps());
      expect(groupDialogMemberFilterKey.value).toBeNull();
    });
  });

  describe("groupDialogMemberFilterGroups", () => {
    test("includes filter options and role groups", () => {
      const groupDialog = createGroupDialog({
        ref: {
          roles: [
            { id: "role_1", name: "Admin", defaultRole: false },
            { id: "role_2", name: "Member", defaultRole: true },
          ],
          memberCount: 10,
        },
      });
      const { groupDialogMemberFilterGroups } = useGroupMembers(groupDialog, createDeps());
      const groups = groupDialogMemberFilterGroups.value;

      expect(groups.length).toBeGreaterThanOrEqual(1);

      const filtersGroup = groups.find((g) => g.key === "filters");
      expect(filtersGroup).toBeDefined();
      expect(filtersGroup?.items.length).toBeGreaterThan(0);
    });

    test("excludes default roles from role items", () => {
      const groupDialog = createGroupDialog({
        ref: {
          roles: [
            { id: "role_1", name: "Admin", defaultRole: false },
            { id: "role_2", name: "Default", defaultRole: true },
          ],
          memberCount: 10,
        },
      });
      const { groupDialogMemberFilterGroups } = useGroupMembers(groupDialog, createDeps());
      const rolesGroup = groupDialogMemberFilterGroups.value.find((g) => g.key === "roles");

      if (rolesGroup) {
        expect(rolesGroup.items).toHaveLength(1);
        expect(rolesGroup.items[0]?.label).toBe("Admin");
      }
    });

    test("omits roles group when no non-default roles exist", () => {
      const groupDialog = createGroupDialog({
        ref: {
          roles: [{ id: "role_1", name: "Default", defaultRole: true }],
          memberCount: 10,
        },
      });
      const { groupDialogMemberFilterGroups } = useGroupMembers(groupDialog, createDeps());
      const rolesGroup = groupDialogMemberFilterGroups.value.find((g) => g.key === "roles");
      expect(rolesGroup).toBeUndefined();
    });
  });

  describe("groupMembersSearch", () => {
    afterEach(() => {
      vi.useRealTimers();
    });

    test("clears results when search is less than 3 characters", () => {
      const groupDialog = createGroupDialog({ memberSearch: "ab" });
      const { groupMembersSearch, isGroupMembersLoading } = useGroupMembers(groupDialog, createDeps());

      groupMembersSearch();

      expect(groupDialog.value.memberSearchResults).toEqual([]);
      expect(isGroupMembersLoading.value).toBe(false);
    });

    test("calls API when search is 3 or more characters", async () => {
      const groupDialog = createGroupDialog({ memberSearch: "abc" });
      mockGetGroupMembersSearch.mockResolvedValue({
        json: { results: [{ userId: "usr_1" }] },
        params: { groupId: "grp_1" },
      });

      const deps = createDeps();
      const { groupMembersSearch } = useGroupMembers(groupDialog, deps);
      groupMembersSearch();

      await vi.waitFor(() => {
        expect(mockGetGroupMembersSearch).toHaveBeenCalledWith({
          groupId: "grp_1",
          query: "abc",
          n: 100,
          offset: 0,
        });
      });
    });

    test("collapses rapid input into a single API call with the latest query", async () => {
      vi.useFakeTimers();
      const groupDialog = createGroupDialog({ memberSearch: "joh" });
      mockGetGroupMembersSearch.mockResolvedValue({
        json: { results: [] },
        params: { groupId: "grp_1" },
      });

      const { groupMembersSearch } = useGroupMembers(groupDialog, createDeps());
      groupMembersSearch();
      groupDialog.value.memberSearch = "john";
      groupMembersSearch();
      groupDialog.value.memberSearch = "johnny";
      groupMembersSearch();

      expect(mockGetGroupMembersSearch).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(200);

      expect(mockGetGroupMembersSearch).toHaveBeenCalledTimes(1);
      expect(mockGetGroupMembersSearch).toHaveBeenCalledWith({
        groupId: "grp_1",
        query: "johnny",
        n: 100,
        offset: 0,
      });
    });

    test("ignores stale responses after the query changed", async () => {
      vi.useFakeTimers();
      const groupDialog = createGroupDialog({ memberSearch: "john" });
      let resolveFirst: ((value: unknown) => void) | undefined;
      mockGetGroupMembersSearch
        .mockImplementationOnce(
          () =>
            new Promise((resolve) => {
              resolveFirst = resolve;
            })
        )
        .mockResolvedValueOnce({
          json: { results: [{ userId: "usr_new" }] },
          params: { groupId: "grp_1" },
        });

      const { groupMembersSearch } = useGroupMembers(groupDialog, createDeps());
      groupMembersSearch();
      await vi.advanceTimersByTimeAsync(200);

      groupDialog.value.memberSearch = "johnny";
      groupMembersSearch();
      await vi.advanceTimersByTimeAsync(200);

      expect(groupDialog.value.memberSearchResults).toEqual([{ userId: "usr_new" }]);

      expect(resolveFirst).toBeDefined();
      resolveFirst?.({
        json: { results: [{ userId: "usr_stale" }] },
        params: { groupId: "grp_1" },
      });
      await vi.advanceTimersByTimeAsync(0);

      expect(groupDialog.value.memberSearchResults).toEqual([{ userId: "usr_new" }]);
    });

    test("loads remaining member pages when search finds no matches", async () => {
      vi.useFakeTimers();
      const groupDialog = createGroupDialog({
        memberSearch: "jam",
        members: [createMember({ userId: "usr_2", user: { displayName: "Other User" } })],
      });
      mockGetGroupMembersSearch.mockResolvedValue({
        json: { results: [] },
        params: { groupId: "grp_1" },
      });
      mockQueryFetch.mockResolvedValue({
        json: [{ userId: "usr_1", user: { displayName: "Jamie Doe" } }],
        params: { groupId: "grp_1", n: 100, offset: 0 },
      });

      const { groupMembersSearch, loadMoreGroupMembersParams, isGroupMembersDone } = useGroupMembers(groupDialog, createDeps());
      loadMoreGroupMembersParams.value = {
        n: 100,
        offset: 100,
        groupId: "grp_1",
        sort: "joinedAt:desc",
      };
      isGroupMembersDone.value = false;

      groupMembersSearch();
      await vi.advanceTimersByTimeAsync(200);
      await vi.advanceTimersByTimeAsync(1000);

      expect(groupDialog.value.memberSearchResults).toEqual([{ userId: "usr_1", user: { displayName: "Jamie Doe" } }]);
      expect(groupDialog.value.memberSearch).toBe("jam");
      expect(mockQueryFetch).toHaveBeenCalledTimes(1);
    });
  });

  describe("loadMoreGroupMembers", () => {
    test("does not load when already done", async () => {
      const groupDialog = createGroupDialog();
      const { loadMoreGroupMembers, isGroupMembersDone } = useGroupMembers(groupDialog, createDeps());
      isGroupMembersDone.value = true;

      await loadMoreGroupMembers();

      expect(mockQueryFetch).not.toHaveBeenCalled();
    });

    test("does not load when already loading", async () => {
      const groupDialog = createGroupDialog();
      const { loadMoreGroupMembers, isGroupMembersLoading } = useGroupMembers(groupDialog, createDeps());
      isGroupMembersLoading.value = true;

      await loadMoreGroupMembers();

      expect(mockQueryFetch).not.toHaveBeenCalled();
    });

    test("marks done when fewer than n results returned", async () => {
      const groupDialog = createGroupDialog();
      mockQueryFetch.mockResolvedValue({
        json: [{ userId: "usr_1" }],
        params: { groupId: "grp_1", n: 100, offset: 0 },
      });

      const { loadMoreGroupMembers, isGroupMembersDone, loadMoreGroupMembersParams } = useGroupMembers(groupDialog, createDeps());

      loadMoreGroupMembersParams.value = {
        n: 100,
        offset: 0,
        groupId: "grp_1",
        sort: "joinedAt:desc",
      };

      await loadMoreGroupMembers();

      expect(isGroupMembersDone.value).toBe(true);
    });

    test("appends members to groupDialog.members", async () => {
      const groupDialog = createGroupDialog({
        members: [createMember({ userId: "existing" })],
      });
      mockQueryFetch.mockResolvedValue({
        json: [{ userId: "usr_new" }],
        params: { groupId: "grp_1", n: 100, offset: 0 },
      });

      const { loadMoreGroupMembers, loadMoreGroupMembersParams } = useGroupMembers(groupDialog, createDeps());

      loadMoreGroupMembersParams.value = {
        n: 100,
        offset: 0,
        groupId: "grp_1",
        sort: "joinedAt:desc",
      };

      await loadMoreGroupMembers();

      expect(groupDialog.value.members).toHaveLength(2);
    });

    test("removes duplicate current user from first position", async () => {
      const deps = createDeps();
      const groupDialog = createGroupDialog({
        members: [createMember({ userId: "usr_me" })],
      });
      mockQueryFetch.mockResolvedValue({
        json: [{ userId: "usr_me" }, { userId: "usr_2" }],
        params: { groupId: "grp_1", n: 100, offset: 0 },
      });

      const { loadMoreGroupMembers, loadMoreGroupMembersParams } = useGroupMembers(groupDialog, deps);

      loadMoreGroupMembersParams.value = {
        n: 100,
        offset: 0,
        groupId: "grp_1",
        sort: "joinedAt:desc",
      };

      await loadMoreGroupMembers();

      const userIds = groupDialog.value.members.map((m) => m.userId);
      expect(userIds).toEqual(["usr_me", "usr_2"]);
    });

    test("marks done on error", async () => {
      const groupDialog = createGroupDialog();
      mockQueryFetch.mockRejectedValue(new Error("fail"));

      const { loadMoreGroupMembers, isGroupMembersDone, loadMoreGroupMembersParams } = useGroupMembers(groupDialog, createDeps());

      loadMoreGroupMembersParams.value = {
        n: 100,
        offset: 0,
        groupId: "grp_1",
        sort: "joinedAt:desc",
      };

      await expect(loadMoreGroupMembers()).rejects.toThrow("fail");
      expect(isGroupMembersDone.value).toBe(true);
    });
  });

  describe("setGroupMemberSortOrder", () => {
    test("does not reload when sort order unchanged", async () => {
      const groupDialog = createGroupDialog({
        memberSortOrder: { value: "joinedAt:desc" },
      });
      const { setGroupMemberSortOrder } = useGroupMembers(groupDialog, createDeps());

      await setGroupMemberSortOrder({ name: "sort.joined", value: "joinedAt:desc" });

      expect(mockQueryFetch).not.toHaveBeenCalled();
    });
  });

  describe("setGroupMemberFilter", () => {
    test("does not reload when filter unchanged", async () => {
      const { markRaw } = await import("vue");
      const filter = markRaw(FILTER_EVERYONE);
      const groupDialog = createGroupDialog();

      groupDialog.value.memberFilter = filter;
      const { setGroupMemberFilter } = useGroupMembers(groupDialog, createDeps());

      await setGroupMemberFilter(filter);

      expect(mockQueryFetch).not.toHaveBeenCalled();
    });
  });
});
