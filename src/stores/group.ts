import { reactive, ref, watch } from "vue";
import { defineStore } from "pinia";
import type { CalendarEvent } from "vrchat";

import { replaceBioSymbols } from "../shared/utils/base/string";
import { groupRequest } from "../api/group";
import { initUserGroups } from "../coordinators/group-membership-coordinator";
import type { Json, VrcxGroup } from "../types/vrcx";
import type {
  GroupDialogState,
  GroupEditDialogState,
  GroupEventEditDialogState,
  GroupInstanceEntry,
  GroupEditSource,
  GroupInviteDialogState,
  GroupMemberModerationState,
  GroupModerateDialogState,
  GroupPostEntry,
  GroupRolesDialogState,
} from "./group-types";
import { watchState } from "../services/watch-state";

export const useGroupStore = defineStore("Group", () => {
  const cachedGroups = new Map<string, VrcxGroup>();

  const groupDialog = ref<GroupDialogState>({
    visible: false,
    loading: false,
    activeTab: "Info",
    lastActiveTab: "Info",
    isGetGroupDialogGroupLoading: false,
    id: "",
    inGroup: false,
    ownerDisplayName: "",
    ref: {},
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
    memberFilter: {
      name: "dialog.group.members.filters.everyone",
      id: null,
    },
    memberSortOrder: {
      name: "dialog.group.members.sorting.joined_at_desc",
      value: "joinedAt:desc",
    },
    postsSearch: "",
    galleries: {},
    listings: [],
  });

  const groupEditDialog = ref<GroupEditDialogState>({
    visible: false,
    loading: false,
    roleTemplatesLoading: false,
    mode: "create",
    groupId: "",
    name: "",
    shortCode: "",
    description: "",
    joinState: "open",
    privacy: "default",
    roleTemplate: "default",
    roleTemplates: [],
    languages: [],
    rules: "",
    links: [],
    bannerId: "",
    bannerUrl: "",
    iconId: "",
    iconUrl: "",
    allowGroupJoinPrompt: false,
  });

  const groupEventEditDialog = ref<GroupEventEditDialogState>({
    visible: false,
    loading: false,
    mode: "create",
    groupId: "",
    eventId: "",
    groupRef: {},
    startsAt: "",
    endsAt: "",
    title: "",
    accessType: "group",
    description: "",
    category: "other",
    tags: [],
    imageId: "",
    imageUrl: "",
    roleIds: [],
    parentId: null,
    platforms: [],
    languages: [],
    sendCreationNotification: false,
    hostEarlyJoinMinutes: 60,
    guestEarlyJoinMinutes: 5,
    closeInstanceAfterEndMinutes: 5,
    seriesId: null,
    recurrence: null,
  });
  const groupEventRevision = ref(0);

  const currentUserGroups = reactive(new Map<string, VrcxGroup>());

  const inviteGroupDialog = ref<GroupInviteDialogState>({
    visible: false,
    loading: false,
    groupId: "",
    groupName: "",
    userId: "",
    userIds: [],
    userObject: {
      id: "",
      displayName: "",
      $userColour: "",
    },
  });

  const moderateGroupDialog = ref<GroupModerateDialogState>({
    visible: false,
    groupId: "",
    groupName: "",
    userId: "",
    userObject: {},
  });

  const groupMemberModeration = ref<GroupMemberModerationState>({
    visible: false,
    loading: false,
    id: "",
    groupRef: {},
    auditLogTypes: [],
    openWithUserId: "",
    activeTab: "",
    activeInviteTab: "",
    selectedUsers: {},
    selectedUsersArray: [],
    tables: {
      members: {
        data: [],
        pageSize: 15,
        pageIndex: 0,
      },
      bans: {
        data: [],
        pageSize: 15,
        pageIndex: 0,
        filters: [{ prop: ["$displayName"], value: "" }],
      },
      invites: {
        data: [],
        pageSize: 15,
        pageIndex: 0,
      },
      joinRequests: {
        data: [],
        pageSize: 15,
        pageIndex: 0,
      },
      blocked: {
        data: [],
        pageSize: 15,
        pageIndex: 0,
      },
      logs: {
        data: [],
        pageSize: 15,
        pageIndex: 0,
        filters: [{ prop: ["description"], value: "" }],
      },
    },
  });

  const groupRolesDialog = ref<GroupRolesDialogState>({
    visible: false,
    loading: false,
    id: "",
    groupRef: {},
    roles: [],
    permissions: [],
    selectedRoleId: "",
  });

  const inGameGroupOrder = ref<string[]>([]);

  const groupInstances = ref<GroupInstanceEntry[]>([]);

  const currentUserGroupsInit = ref(false);

  watch(
    () => watchState.isLoggedIn,
    (isLoggedIn) => {
      groupDialog.value.visible = false;
      groupEditDialog.value.visible = false;
      groupEventEditDialog.value.visible = false;
      inviteGroupDialog.value.visible = false;
      moderateGroupDialog.value.visible = false;
      groupMemberModeration.value.visible = false;
      groupRolesDialog.value.visible = false;
      currentUserGroupsInit.value = false;
      cachedGroups.clear();
      currentUserGroups.clear();
      if (isLoggedIn) {
        initUserGroups();
      }
    },
    { flush: "sync" }
  );

  async function getAllGroupPosts(params: { groupId: string }) {
    const n = 100;
    const posts: GroupPostEntry[] = [];
    let offset = 0;
    let total: number;
    let pages = 0;
    do {
      const args = await groupRequest.getGroupPosts({
        groupId: params.groupId,
        n,
        offset,
      });
      const pagePosts = args.json.posts ?? [];
      total = args.json.total ?? pagePosts.length;
      posts.push(...pagePosts);
      offset += n;
      pages += 1;
      if (pagePosts.length === 0) {
        break;
      }
    } while (offset < total && pages < 50);
    const returnArgs = {
      posts,
      params,
    };
    const D = groupDialog.value;
    if (D.id === params.groupId) {
      for (const post of posts) {
        post.title = replaceBioSymbols(post.title);
        post.text = replaceBioSymbols(post.text);
      }
      D.announcement = posts[0] ?? {};
      D.posts = posts;
      updateGroupPostSearch();
    }

    return returnArgs;
  }

  function applyGroupEvent(event: Json<CalendarEvent>) {
    return {
      userInterest: {
        createdAt: null,
        isFollowing: false,
        updatedAt: null,
      },
      ...event,
      title: replaceBioSymbols(event.title),
      description: replaceBioSymbols(event.description),
    };
  }

  function sortGroupInstancesByInGame(a: GroupInstanceEntry, b: GroupInstanceEntry) {
    const aIndex = inGameGroupOrder.value.indexOf(a.group.id ?? "");
    const bIndex = inGameGroupOrder.value.indexOf(b.group.id ?? "");
    if (aIndex === -1 && bIndex === -1) {
      return 0;
    }
    if (aIndex === -1) {
      return 1;
    }
    if (bIndex === -1) {
      return -1;
    }
    return aIndex - bIndex;
  }

  function updateGroupPostSearch() {
    const D = groupDialog.value;
    const search = D.postsSearch.toLowerCase();
    D.postsFiltered = D.posts.filter((post) => {
      if (search === "") {
        return true;
      }
      if ((post.title ?? "").toLowerCase().includes(search)) {
        return true;
      }
      if ((post.text ?? "").toLowerCase().includes(search)) {
        return true;
      }
      return false;
    });
  }

  function handleGroupPost(args: { params: { groupId: string }; json: GroupPostEntry }) {
    const D = groupDialog.value;
    if (D.id !== args.params.groupId) {
      return;
    }

    const newPost = args.json;
    newPost.title = replaceBioSymbols(newPost.title);
    newPost.text = replaceBioSymbols(newPost.text);
    let hasPost = false;

    for (const post of D.posts) {
      if (post.id === newPost.id) {
        Object.assign(post, newPost);
        hasPost = true;
        break;
      }
    }

    if (newPost.id === D.announcement.id || !D.announcement.id) {
      D.announcement = newPost;
    }

    if (!hasPost) {
      D.posts.unshift(newPost);
    }
    updateGroupPostSearch();
  }

  function clearGroupInstances() {
    groupInstances.value = [];
  }

  function setGroupDialogVisible(isVisible: boolean) {
    groupDialog.value.visible = isVisible;
  }

  function showModerateGroupDialog(userId: string) {
    const D = moderateGroupDialog.value;
    D.userId = userId;
    D.userObject = {};
    D.visible = true;
  }

  function setGroupMemberModerationVisible(isVisible: boolean) {
    groupMemberModeration.value.visible = isVisible;
  }

  function setGroupRolesDialogVisible(isVisible: boolean) {
    groupRolesDialog.value.visible = isVisible;
  }

  function setCurrentUserGroupsInit(isInitialized: boolean) {
    currentUserGroupsInit.value = isInitialized;
  }

  function setInGameGroupOrder(order: string[]) {
    inGameGroupOrder.value = order;
  }

  function setGroupInstances(instances: GroupInstanceEntry[]) {
    groupInstances.value = instances;
  }

  function resetGroupEditDialog() {
    groupEditDialog.value = {
      visible: false,
      loading: false,
      roleTemplatesLoading: false,
      mode: "create",
      groupId: "",
      name: "",
      shortCode: "",
      description: "",
      joinState: "open",
      privacy: "default",
      roleTemplate: "default",
      roleTemplates: [],
      languages: [],
      rules: "",
      links: [],
      bannerId: "",
      bannerUrl: "",
      iconId: "",
      iconUrl: "",
      allowGroupJoinPrompt: false,
    };
  }

  async function showCreateGroupDialog() {
    resetGroupEditDialog();
    const D = groupEditDialog.value;
    D.visible = true;
    D.roleTemplatesLoading = true;
    try {
      const args = await groupRequest.getRoleTemplates();
      D.roleTemplates = Array.isArray(args.json)
        ? args.json
        : Object.entries(args.json).map(([value, template]) => ({
            value,
            ...template,
          }));
    } finally {
      D.roleTemplatesLoading = false;
    }
  }

  function showEditGroupDialog(group: Partial<GroupEditSource>) {
    resetGroupEditDialog();
    groupEditDialog.value = {
      visible: true,
      loading: false,
      roleTemplatesLoading: false,
      mode: "edit",
      groupId: group.id ?? "",
      name: group.name,
      shortCode: group.shortCode,
      description: group.description,
      joinState: group.joinState ?? "open",
      privacy: group.privacy ?? "default",
      roleTemplate: group.roleTemplate ?? "default",
      roleTemplates: Array.isArray(group.roleTemplates) ? [...group.roleTemplates] : [],
      languages: Array.isArray(group.languages) ? [...group.languages] : [],
      rules: group.rules,
      links: Array.isArray(group.links) ? [...group.links] : [],
      bannerId: group.bannerId,
      bannerUrl: group.bannerUrl,
      iconId: group.iconId,
      iconUrl: group.iconUrl,
      allowGroupJoinPrompt: !!group.allowGroupJoinPrompt,
    };
  }

  function resetGroupEventEditDialog() {
    const startsAt = new Date();
    startsAt.setMinutes(0, 0, 0);
    startsAt.setHours(startsAt.getHours() + 1);
    const endsAt = new Date(startsAt);
    endsAt.setHours(endsAt.getHours() + 2);
    groupEventEditDialog.value = {
      visible: false,
      loading: false,
      mode: "create",
      groupId: "",
      eventId: "",
      groupRef: {},
      startsAt: startsAt.toISOString(),
      endsAt: endsAt.toISOString(),
      title: "",
      accessType: "group",
      description: "",
      category: "other",
      tags: [],
      imageId: "",
      imageUrl: "",
      roleIds: [],
      parentId: null,
      platforms: [],
      languages: [],
      sendCreationNotification: false,
      hostEarlyJoinMinutes: 60,
      guestEarlyJoinMinutes: 5,
      closeInstanceAfterEndMinutes: 5,
      seriesId: null,
      recurrence: null,
    };
  }

  function showCreateGroupEventDialog(group: Partial<VrcxGroup>) {
    resetGroupEventEditDialog();
    groupEventEditDialog.value = {
      ...groupEventEditDialog.value,
      visible: true,
      groupId: group.id ?? "",
      groupRef: group,
    };
  }

  function showEditGroupEventDialog(event: Json<CalendarEvent>, group: Partial<VrcxGroup>) {
    resetGroupEventEditDialog();
    groupEventEditDialog.value = {
      visible: true,
      loading: false,
      mode: "edit",
      groupId: event.ownerId ?? "",
      eventId: event.id,
      groupRef: group,
      startsAt: event.startsAt,
      endsAt: event.endsAt,
      title: event.title,
      accessType: event.accessType,
      description: event.description,
      category: event.category,
      tags: Array.isArray(event.tags) ? [...event.tags] : [],
      imageId: event.imageId ?? "",
      imageUrl: event.imageUrl ?? "",
      roleIds: Array.isArray(event.roleIds) ? [...event.roleIds] : [],
      parentId: null,
      platforms: Array.isArray(event.platforms) ? [...event.platforms] : [],
      languages: Array.isArray(event.languages) ? [...event.languages] : [],
      sendCreationNotification: false,
      hostEarlyJoinMinutes: event.hostEarlyJoinMinutes ?? 60,
      guestEarlyJoinMinutes: event.guestEarlyJoinMinutes ?? 5,
      closeInstanceAfterEndMinutes: event.closeInstanceAfterEndMinutes ?? 5,
      seriesId: event.seriesId,
      recurrence: event.recurrence,
    };
  }

  function markGroupEventMutation() {
    groupEventRevision.value++;
  }

  return {
    groupDialog,
    groupEditDialog,
    groupEventEditDialog,
    groupEventRevision,
    currentUserGroups,
    inviteGroupDialog,
    moderateGroupDialog,
    groupMemberModeration,
    groupRolesDialog,
    cachedGroups,
    inGameGroupOrder,
    groupInstances,
    currentUserGroupsInit,
    getAllGroupPosts,
    applyGroupEvent,
    sortGroupInstancesByInGame,
    updateGroupPostSearch,
    handleGroupPost,
    clearGroupInstances,
    setGroupDialogVisible,
    showModerateGroupDialog,
    setGroupMemberModerationVisible,
    setGroupRolesDialogVisible,
    setCurrentUserGroupsInit,
    setInGameGroupOrder,
    setGroupInstances,
    showCreateGroupDialog,
    showEditGroupDialog,
    showCreateGroupEventDialog,
    showEditGroupEventDialog,
    markGroupEventMutation,
  };
});
