import { ref, type Ref } from "vue";
import { toast } from "vue-sonner";

import { debounce } from "../../../shared/utils/common";
import { mergeGroupMemberSearchResults } from "../../../shared/utils/group";
import { queryRequest } from "../../../api/query-request";
import type { GroupSearchSort } from "vrchat";
import type { GroupMemberRecord } from "../../../coordinators/group-coordinator";
import { hasUserId, toGroupSearchSort } from "./group-moderation-utils";
import type { GroupMemberModerationState } from "../../../stores/group-types";
import type {
  GroupFilterOption,
  GroupRequest,
  GroupSortOption,
  ModerationLogRow,
  ModerationRow,
  ModerationTables,
  SelectedRow,
} from "./group-moderation-types";

import * as workerTimers from "worker-timers";

export type GroupModerationDataDeps = {
  groupMemberModeration: Ref<Pick<GroupMemberModerationState, "id" | "visible">>;
  currentUser: Ref<{ id: string }>;
  applyGroupMember: (json: GroupMemberRecord) => GroupMemberRecord;
  handleGroupMember: (args: { json: GroupMemberRecord; params?: { groupId: string } }) => void;
  tables: ModerationTables;
  selection: {
    selectedUsers: Record<string, SelectedRow>;
    setSelectedUsers: (userId: string, user: SelectedRow | null | undefined) => void;
  };
  groupRequest: Pick<
    GroupRequest,
    "getGroupBans" | "getGroupLogs" | "getGroupInvites" | "getGroupJoinRequests" | "getGroupMember" | "getGroupMembers" | "getGroupMembersSearch"
  >;
};

type MemberSortOrder = GroupSortOption;
type MemberFilter = GroupFilterOption;
type MemberQueryParams = {
  n: number;
  offset: number;
  groupId: string;
  sort: GroupSearchSort;
  roleId?: string;
};
type GroupLogsParams = { groupId: string; n: number; offset: number; eventTypes?: string[] };

export function useGroupModerationData(deps: GroupModerationDataDeps) {
  const { groupMemberModeration, currentUser, applyGroupMember, handleGroupMember, tables, selection, groupRequest } = deps;

  const isGroupMembersLoading = ref(false);
  const isGroupMembersDone = ref(false);
  const memberFilter = ref<MemberFilter>({
    id: null,
    name: "dialog.group.members.filters.everyone",
  });
  const memberSortOrder = ref<MemberSortOrder>({
    name: "dialog.group.members.sorting.joined_at_desc",
    value: "joinedAt:desc",
  });
  const memberSearch = ref("");
  const members = ref<ModerationRow[]>([]);
  const loadMoreGroupMembersParams = ref<MemberQueryParams>({
    n: 100,
    offset: 0,
    groupId: "",
    sort: "joinedAt:desc",
    roleId: "",
  });

  async function getGroupMembers() {
    members.value = [];
    isGroupMembersDone.value = false;
    loadMoreGroupMembersParams.value = {
      sort: "joinedAt:desc",
      roleId: "",
      n: 100,
      offset: 0,
      groupId: groupMemberModeration.value.id,
    };
    if (memberSortOrder.value.value) {
      loadMoreGroupMembersParams.value.sort = toGroupSearchSort(memberSortOrder.value.value);
    }
    if (memberFilter.value.id !== null) {
      loadMoreGroupMembersParams.value.roleId = memberFilter.value.id;
    }
    await groupRequest
      .getGroupMember({
        groupId: groupMemberModeration.value.id,
        userId: currentUser.value.id,
      })
      .then((args) => {
        if (!args.json) {
          throw new TypeError("Group member response has no body");
        }
        args.ref = applyGroupMember(args.json);
        args.json.user = currentUser.value;
        if (memberFilter.value.id === null) {
          members.value.push(args.json);
        }
        return args;
      });
    await loadMoreGroupMembers();
  }

  async function loadMoreGroupMembers(options: { preserveSearch?: boolean } = {}) {
    if (isGroupMembersDone.value || isGroupMembersLoading.value) {
      return;
    }
    const params = loadMoreGroupMembersParams.value;
    if (params.roleId === "") {
      delete params.roleId;
    }
    if (!options.preserveSearch) {
      memberSearch.value = "";
    }
    isGroupMembersLoading.value = true;
    await groupRequest
      .getGroupMembers(params)
      .finally(() => {
        isGroupMembersLoading.value = false;
      })
      .then((args) => {
        for (const json of args.json) {
          handleGroupMember({
            json,
            params: { groupId: args.params.groupId },
          });
        }
        for (const member of args.json) {
          if (member.userId === currentUser.value.id) {
            if (members.value.length > 0 && members.value[0]?.userId === currentUser.value.id) {
              members.value.splice(0, 1);
            }
            break;
          }
        }
        if (args.json.length < params.n) {
          isGroupMembersDone.value = true;
        }
        members.value = [...members.value, ...args.json];
        if (!options.preserveSearch) {
          tables.members.data = members.value.map((member) => ({
            ...member,
            $selected: typeof member.userId === "string" && Boolean(selection.selectedUsers[member.userId]),
          }));
        }
        params.offset += params.n;
        return args;
      })
      .catch((err: unknown) => {
        isGroupMembersDone.value = true;
        throw err;
      });
  }

  async function loadAllGroupMembers() {
    if (isGroupMembersLoading.value) {
      return;
    }
    await getGroupMembers();
    while (groupMemberModeration.value.visible && !isGroupMembersDone.value) {
      isGroupMembersLoading.value = true;
      await new Promise<void>((resolve) => {
        workerTimers.setTimeout(resolve, 1000);
      });
      isGroupMembersLoading.value = false;
      await loadMoreGroupMembers();
    }
  }

  async function setGroupMemberSortOrder(sortOrder: MemberSortOrder) {
    if (memberSortOrder.value === sortOrder) {
      return;
    }
    memberSortOrder.value = sortOrder;
    await getGroupMembers();
  }

  async function setGroupMemberFilter(filter: MemberFilter) {
    if (memberFilter.value === filter) {
      return;
    }
    memberFilter.value = filter;
    await getGroupMembers();
  }

  let memberSearchRequestId = 0;
  const groupMembersSearchDebounced = debounce(() => {
    groupMembersSearchRequest().catch(console.error);
  }, 200);
  const groupMembersSearchMaxPages = 10;

  function groupMembersSearch() {
    memberSearchRequestId += 1;
    if (memberSearch.value.length < 3) {
      tables.members.data = [];
      isGroupMembersLoading.value = false;
      return;
    }
    groupMembersSearchDebounced();
  }

  async function groupMembersSearchRequest() {
    const groupId = groupMemberModeration.value.id;
    const search = memberSearch.value;
    const requestId = memberSearchRequestId;
    tables.members.data = [];
    if (!search || search.length < 3) {
      isGroupMembersLoading.value = false;
      return;
    }
    isGroupMembersLoading.value = true;
    try {
      const args = await groupRequest.getGroupMembersSearch({
        groupId,
        query: search,
        n: 100,
        offset: 0,
      });
      const searchResults = args.json.results ?? [];
      for (const json of searchResults) {
        handleGroupMember({
          json,
          params: { groupId: args.params.groupId },
        });
      }
      if (requestId !== memberSearchRequestId || groupId !== args.params.groupId || search !== memberSearch.value) {
        return;
      }
      const results = mergeGroupMemberSearchResults<ModerationRow & { userId: string }>(
        searchResults.filter(hasUserId),
        members.value.filter(hasUserId),
        search
      );
      tables.members.data = results.map((member) => ({
        ...member,
        $selected: Boolean(selection.selectedUsers[member.userId]),
      }));
      await groupMembersSearchLoadRemaining(requestId, search);
    } catch (error: unknown) {
      console.debug(error);
    } finally {
      if (requestId === memberSearchRequestId) {
        isGroupMembersLoading.value = false;
      }
    }
  }

  function isGroupMembersSearchStale(requestId: number, search: string) {
    return !groupMemberModeration.value.visible || requestId !== memberSearchRequestId || search !== memberSearch.value || isGroupMembersDone.value;
  }

  async function groupMembersSearchLoadRemaining(requestId: number, search: string) {
    const groupId = groupMemberModeration.value.id;
    for (let page = 0; page < groupMembersSearchMaxPages; ++page) {
      if (tables.members.data.length || loadMoreGroupMembersParams.value.groupId !== groupId || isGroupMembersSearchStale(requestId, search)) {
        return;
      }
      isGroupMembersLoading.value = true;
      await new Promise<void>((resolve) => {
        workerTimers.setTimeout(resolve, 1000);
      });
      isGroupMembersLoading.value = false;
      if (isGroupMembersSearchStale(requestId, search)) {
        return;
      }
      try {
        await loadMoreGroupMembers({ preserveSearch: true });
      } catch {
        return;
      }
      if (requestId !== memberSearchRequestId || search !== memberSearch.value) {
        return;
      }
      const results = mergeGroupMemberSearchResults<ModerationRow & { userId: string }>(
        tables.members.data.filter(hasUserId),
        members.value.filter(hasUserId),
        search
      );
      tables.members.data = results.map((member) => ({
        ...member,
        $selected: Boolean(selection.selectedUsers[member.userId]),
      }));
    }
  }

  async function getAllGroupBans(groupId: string) {
    tables.bans.data = [];
    const params = { groupId, n: 100, offset: 0 };
    const count = 50;
    isGroupMembersLoading.value = true;
    const fetchedBans: ModerationRow[] = [];
    try {
      for (let i = 0; i < count; i++) {
        const args = await groupRequest.getGroupBans(params);
        if (groupMemberModeration.value.id !== args.params.groupId) {
          continue;
        }
        args.json.forEach((json) => {
          const ref = applyGroupMember(json);
          fetchedBans.push(ref);
        });
        if (args.json.length < params.n) {
          break;
        }
        params.offset += params.n;
        if (!groupMemberModeration.value.visible) {
          break;
        }
      }
      tables.bans.data = fetchedBans;
    } catch {
      toast.error("Failed to get group bans");
    } finally {
      isGroupMembersLoading.value = false;
    }
  }

  async function getAllGroupInvites(groupId: string) {
    tables.invites.data = [];
    const params = { groupId, n: 100, offset: 0 };
    const count = 50;
    isGroupMembersLoading.value = true;
    const newData: ModerationRow[] = [];
    try {
      for (let i = 0; i < count; i++) {
        const args = await groupRequest.getGroupInvites(params);
        if (groupMemberModeration.value.id !== args.params.groupId) {
          return;
        }
        for (const json of args.json) {
          const ref = applyGroupMember(json);
          newData.push(ref);
        }
        params.offset += params.n;
        if (args.json.length < params.n) {
          break;
        }
        if (!groupMemberModeration.value.visible) {
          break;
        }
      }
      tables.invites.data = newData;
    } catch {
      toast.error("Failed to get group invites");
    } finally {
      isGroupMembersLoading.value = false;
    }
  }

  async function getAllGroupJoinRequests(groupId: string) {
    tables.joinRequests.data = [];
    const params = { groupId, n: 100, offset: 0, blocked: false };
    const count = 50;
    isGroupMembersLoading.value = true;
    const newData: ModerationRow[] = [];
    try {
      for (let i = 0; i < count; i++) {
        const args = await groupRequest.getGroupJoinRequests(params);
        if (groupMemberModeration.value.id !== args.params.groupId) {
          return;
        }
        for (const json of args.json) {
          const ref = applyGroupMember(json);
          newData.push(ref);
        }
        params.offset += params.n;
        if (args.json.length < params.n) {
          break;
        }
        if (!groupMemberModeration.value.visible) {
          break;
        }
      }
      tables.joinRequests.data = newData;
    } catch {
      toast.error("Failed to get group join requests");
    } finally {
      isGroupMembersLoading.value = false;
    }
  }

  async function getAllGroupBlockedRequests(groupId: string) {
    tables.blocked.data = [];
    const params = { groupId, n: 100, offset: 0, blocked: true };
    const count = 50;
    isGroupMembersLoading.value = true;
    const newData: ModerationRow[] = [];
    try {
      for (let i = 0; i < count; i++) {
        const args = await groupRequest.getGroupJoinRequests(params);
        if (groupMemberModeration.value.id !== args.params.groupId) {
          return;
        }
        for (const json of args.json) {
          const ref = applyGroupMember(json);
          newData.push(ref);
        }
        params.offset += params.n;
        if (args.json.length < params.n) {
          break;
        }
        if (!groupMemberModeration.value.visible) {
          break;
        }
      }
      tables.blocked.data = newData;
    } catch {
      toast.error("Failed to get group join requests");
    } finally {
      isGroupMembersLoading.value = false;
    }
  }

  async function getAllGroupInvitesAndJoinRequests(groupId: string) {
    try {
      await Promise.all([getAllGroupInvites(groupId), getAllGroupJoinRequests(groupId), getAllGroupBlockedRequests(groupId)]);
    } catch (error) {
      console.error("Error fetching group invites/requests:", error);
    }
  }

  async function getAllGroupLogs(groupId: string, eventTypes: string[] = []) {
    tables.logs.data = [];
    const params: GroupLogsParams = { groupId, n: 100, offset: 0 };
    if (eventTypes.length) {
      params.eventTypes = eventTypes;
    }
    const count = 50;
    isGroupMembersLoading.value = true;
    const newData: ModerationLogRow[] = [];
    try {
      for (let i = 0; i < count; i++) {
        const args = await groupRequest.getGroupLogs(params);
        if (groupMemberModeration.value.id !== args.params.groupId) {
          continue;
        }
        for (const json of args.json.results ?? []) {
          const isInData = newData.some((dataItem) => dataItem.id === json.id);
          if (!isInData) {
            newData.push(json);
          }
        }
        params.offset += params.n;
        if (!args.json.hasNext) {
          break;
        }
        if (!groupMemberModeration.value.visible) {
          break;
        }
      }
      tables.logs.data = newData;
    } catch {
      toast.error("Failed to get group logs");
    } finally {
      isGroupMembersLoading.value = false;
    }
  }

  async function addGroupMemberToSelection(userId: string) {
    const D = groupMemberModeration.value;
    let member: SelectedRow = {};
    const memberArgs = await groupRequest.getGroupMember({
      groupId: D.id,
      userId,
    });
    if (memberArgs.json) {
      member = applyGroupMember(memberArgs.json);
    }
    if (member.user) {
      selection.setSelectedUsers(member.userId ?? userId, member);
      return;
    }
    const userArgs = await queryRequest.fetch("user.dialog", { userId });
    member.userId = userArgs.json.id;
    member.user = userArgs.json;
    member.displayName = userArgs.json.displayName;
    selection.setSelectedUsers(userArgs.json.id, member);
  }

  async function selectGroupMemberUserId(userIdInput: string) {
    if (!userIdInput) return;
    const regexUserId = /usr_[0-9A-Fa-f]{8}-([0-9A-Fa-f]{4}-){3}[0-9A-Fa-f]{12}/g;
    let match: RegExpExecArray | null;
    const userIdList = new Set<string>();
    while ((match = regexUserId.exec(userIdInput)) !== null) {
      userIdList.add(match[0]);
    }
    if (userIdList.size === 0) {
      userIdList.add(userIdInput);
    }
    const promises: Promise<void>[] = [];
    userIdList.forEach((userId) => {
      promises.push(addGroupMemberToSelection(userId));
    });
    await Promise.allSettled(promises);
  }

  function resetData() {
    tables.members.data = [];
    tables.bans.data = [];
    tables.invites.data = [];
    tables.joinRequests.data = [];
    tables.blocked.data = [];
    tables.logs.data = [];
    memberSearch.value = "";
    members.value = [];
    isGroupMembersDone.value = false;
  }

  return {
    isGroupMembersLoading,
    isGroupMembersDone,
    memberFilter,
    memberSortOrder,
    memberSearch,
    members,
    loadAllGroupMembers,
    getGroupMembers,
    setGroupMemberSortOrder,
    setGroupMemberFilter,
    groupMembersSearch,
    selectGroupMemberUserId,
    addGroupMemberToSelection,
    getAllGroupBans,
    getAllGroupLogs,
    getAllGroupInvites,
    getAllGroupJoinRequests,
    getAllGroupBlockedRequests,
    getAllGroupInvitesAndJoinRequests,
    resetData,
  };
}
