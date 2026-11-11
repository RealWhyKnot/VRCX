import { computed, ref, type Ref } from "vue";

import { groupDialogFilterOptions, groupDialogSortingOptions, FILTER_EVERYONE, FILTER_NO_ROLE } from "../../../shared/constants/group";
import { groupRequest } from "../../../api/group";
import { queryRequest } from "../../../api/query-request";
import { debounce } from "../../../shared/utils/common";
import { mergeGroupMemberSearchResults } from "../../../shared/utils/group";
import type { GroupSearchSort } from "vrchat";
import type { GroupMemberRecord } from "../../../coordinators/group-coordinator";
import type { GroupDialogState } from "../../../stores/group-types";
import { hasUserId, toGroupSearchSort } from "./group-moderation-utils";

import * as workerTimers from "worker-timers";

type MemberQueryParams = {
  n: number;
  offset: number;
  groupId: string;
  sort: GroupSearchSort;
  roleId?: string;
};

export type GroupMembersSource = Omit<GroupDialogState, "memberFilter" | "memberSortOrder"> & {
  memberSortOrder: Partial<GroupDialogState["memberSortOrder"]>;
  memberFilter?: GroupDialogState["memberFilter"] | null | undefined;
};

type GroupMembersDeps = {
  currentUser: Ref<{ id: string }>;
  applyGroupMember: (json: GroupMemberRecord) => GroupMemberRecord;
  handleGroupMember: (args: { json: GroupMemberRecord; params: { groupId: string } }) => void;
  t: (key: string) => string;
};

export function useGroupMembers(groupDialog: Ref<GroupMembersSource>, { currentUser, applyGroupMember, handleGroupMember, t }: GroupMembersDeps) {
  const isGroupMembersDone = ref(false);
  const isGroupMembersLoading = ref(false);

  const loadMoreGroupMembersParams = ref<MemberQueryParams>({
    n: 100,
    offset: 0,
    groupId: "",
    sort: "joinedAt:desc",
    roleId: "",
  });

  const groupDialogMemberSortValue = computed({
    get() {
      return groupDialog.value.memberSortOrder.value ?? "";
    },
    set(value: string) {
      const option = groupDialogSortingOptions.find((item) => item.value === value);
      if (option) {
        setGroupMemberSortOrder(option).catch(console.error);
      }
    },
  });

  const groupDialogMemberFilterKey = computed<string | null>({
    get() {
      const filter = groupDialog.value.memberFilter;
      if (!filter) return null;

      if (filter.id === null) return "everyone";
      if (filter.id === "") return "usersWithNoRole";
      return `role:${filter.id}`;
    },
    set(key: string | null) {
      if (!key) return;

      if (key === "everyone") {
        setGroupMemberFilter(FILTER_EVERYONE).catch(console.error);
        return;
      }
      if (key === "usersWithNoRole") {
        setGroupMemberFilter(FILTER_NO_ROLE).catch(console.error);
        return;
      }

      if (key.startsWith("role:")) {
        const roleId = key.slice("role:".length);
        const role = groupDialog.value.ref.roles?.find((r) => r.id === roleId);
        if (role?.id !== undefined && role.name !== undefined) {
          setGroupMemberFilter({ id: role.id, name: role.name }).catch(console.error);
        }
      }
    },
  });

  const groupDialogMemberFilterGroups = computed(() => {
    const filterItems = groupDialogFilterOptions.map((item) => ({
      value: item.id === null ? "everyone" : item.id === "" ? "usersWithNoRole" : `role:${item.id}`,
      label: t(item.name),
      search: t(item.name),
    }));

    const roleItems = (groupDialog.value.ref.roles ?? [])
      .filter((role) => !role.defaultRole)
      .map((role) => ({
        value: `role:${role.id}`,
        label: role.name ?? "",
        search: role.name ?? "",
      }));

    return [
      {
        key: "filters",
        label: t("dialog.group.members.filter"),
        items: filterItems,
      },
      {
        key: "roles",
        label: "Roles",
        items: roleItems,
      },
    ].filter((group) => group.items.length);
  });

  let memberSearchRequestId = 0;
  const groupMembersSearchDebounced = debounce(() => {
    groupMembersSearchRequest().catch(console.error);
  }, 200);
  const groupMembersSearchMaxPages = 10;

  function groupMembersSearch() {
    memberSearchRequestId += 1;
    if (groupDialog.value.memberSearch.length < 3) {
      groupDialog.value.memberSearchResults = [];
      isGroupMembersLoading.value = false;
      return;
    }
    groupMembersSearchDebounced();
  }

  async function groupMembersSearchRequest() {
    const D = groupDialog.value;
    const search = D.memberSearch;
    const requestId = memberSearchRequestId;
    D.memberSearchResults = [];
    if (!search || search.length < 3) {
      isGroupMembersLoading.value = false;
      return;
    }
    isGroupMembersLoading.value = true;
    try {
      const args = await groupRequest.getGroupMembersSearch({
        groupId: D.id,
        query: search,
        n: 100,
        offset: 0,
      });
      const searchResults = args.json.results ?? [];
      for (const json of searchResults) {
        handleGroupMember({
          json,
          params: {
            groupId: args.params.groupId,
          },
        });
      }
      if (requestId !== memberSearchRequestId || D.id !== args.params.groupId || search !== D.memberSearch) {
        return;
      }
      D.memberSearchResults = mergeGroupMemberSearchResults(searchResults.filter(hasUserId), D.members.filter(hasUserId), search);
      await groupMembersSearchLoadRemaining(requestId, search);
    } catch (error) {
      console.error(error);
    } finally {
      if (requestId === memberSearchRequestId) {
        isGroupMembersLoading.value = false;
      }
    }
  }

  async function groupMembersSearchLoadRemaining(requestId: number, search: string) {
    const D = groupDialog.value;
    const isSearchCurrent = () => D.visible && requestId === memberSearchRequestId && search === D.memberSearch && !isGroupMembersDone.value;
    for (let page = 0; page < groupMembersSearchMaxPages; ++page) {
      if (
        D.memberSearchResults.length ||
        !D.visible ||
        loadMoreGroupMembersParams.value.groupId !== D.id ||
        requestId !== memberSearchRequestId ||
        search !== D.memberSearch ||
        isGroupMembersDone.value
      ) {
        return;
      }
      isGroupMembersLoading.value = true;
      await new Promise<void>((resolve) => {
        workerTimers.setTimeout(resolve, 1000);
      });
      isGroupMembersLoading.value = false;
      if (!isSearchCurrent()) {
        return;
      }
      try {
        await loadMoreGroupMembers({ preserveSearch: true });
      } catch {
        return;
      }
      if (requestId !== memberSearchRequestId || search !== D.memberSearch) {
        return;
      }
      D.memberSearchResults = mergeGroupMemberSearchResults(D.memberSearchResults.filter(hasUserId), D.members.filter(hasUserId), search);
    }
  }

  async function getGroupDialogGroupMembers() {
    const D = groupDialog.value;
    D.members = [];
    isGroupMembersDone.value = false;
    loadMoreGroupMembersParams.value = {
      sort: "joinedAt:desc",
      roleId: "",
      n: 100,
      offset: 0,
      groupId: D.id,
    };
    if (D.memberSortOrder.value) {
      loadMoreGroupMembersParams.value.sort = toGroupSearchSort(D.memberSortOrder.value);
    }
    const memberFilter = D.memberFilter;
    if (memberFilter && memberFilter.id !== null) {
      loadMoreGroupMembersParams.value.roleId = memberFilter.id;
    }
    if (D.inGroup) {
      await queryRequest
        .fetch("groupMember", {
          groupId: D.id,
          userId: currentUser.value.id,
        })
        .then((args) => {
          if (!args.json) {
            throw new TypeError("Group member response has no body");
          }
          args.ref = applyGroupMember(args.json);
          args.json.user = currentUser.value;
          if (memberFilter?.id === null) {
            D.members.push(args.json);
          }
          return args;
        });
    }
    await loadMoreGroupMembers();
  }

  async function loadMoreGroupMembers(options: { preserveSearch?: boolean } = {}) {
    if (isGroupMembersDone.value || isGroupMembersLoading.value) {
      return;
    }
    const D = groupDialog.value;
    const params = loadMoreGroupMembersParams.value;
    if (params.roleId === "") {
      delete params.roleId;
    }
    if (!options.preserveSearch) {
      D.memberSearch = "";
    }
    isGroupMembersLoading.value = true;
    await queryRequest
      .fetch("groupMembers", params)
      .finally(() => {
        isGroupMembersLoading.value = false;
      })
      .then((args) => {
        for (const json of args.json) {
          handleGroupMember({
            json,
            params: {
              groupId: args.params.groupId,
            },
          });
        }
        for (const member of args.json) {
          if (member.userId === currentUser.value.id) {
            if (D.members.length > 0 && D.members[0]?.userId === currentUser.value.id) {
              D.members.splice(0, 1);
            }
            break;
          }
        }
        if (args.json.length < params.n) {
          isGroupMembersDone.value = true;
        }
        D.members = [...D.members, ...args.json];
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
    await getGroupDialogGroupMembers();
    while (groupDialog.value.visible && !isGroupMembersDone.value) {
      isGroupMembersLoading.value = true;
      await new Promise<void>((resolve) => {
        workerTimers.setTimeout(resolve, 1000);
      });
      isGroupMembersLoading.value = false;
      await loadMoreGroupMembers();
    }
  }

  async function setGroupMemberSortOrder(sortOrder: { name: string; value: string }) {
    const D = groupDialog.value;
    if (D.memberSortOrder.value === sortOrder.value) {
      return;
    }
    D.memberSortOrder = sortOrder;
    await getGroupDialogGroupMembers();
  }

  async function setGroupMemberFilter(filter: { name: string; id: string | null }) {
    const D = groupDialog.value;
    if (D.memberFilter?.id === filter.id) {
      return;
    }
    D.memberFilter = filter;
    await getGroupDialogGroupMembers();
  }

  return {
    isGroupMembersDone,
    isGroupMembersLoading,
    loadMoreGroupMembersParams,
    groupDialogMemberSortValue,
    groupDialogMemberFilterKey,
    groupDialogMemberFilterGroups,
    groupMembersSearch,
    getGroupDialogGroupMembers,
    loadMoreGroupMembers,
    loadAllGroupMembers,
    setGroupMemberSortOrder,
    setGroupMemberFilter,
  };
}
