import * as workerTimers from "worker-timers";
import { toast } from "vue-sonner";
import { i18n } from "../plugins/i18n";
import { z } from "zod";

import { groupRequest } from "../api/group";
import { configRepository } from "../services/config";
import { watchState } from "../services/watch-state";
import { convertFileUrlToImageUrl } from "../shared/utils/common";
import type { InstanceJsonInput } from "../shared/utils/instance-transforms";
import { createDefaultGroupRef } from "../shared/utils/group-transforms";
import { useGameStore } from "../stores/game";
import { useGroupStore } from "../stores/group";
import { useInstanceStore } from "../stores/instance";
import { useModalStore } from "../stores/modal";
import type { RepresentedGroupState } from "../stores/user-state";
import { useUserStore } from "../stores/user";
import type { VrcxGroup } from "../types/vrcx";
import {
  applyGroup,
  applyGroupMember,
  groupChange,
  handleGroupMember,
  logError,
  saveCurrentUserGroups,
  syncGroupSearch,
  type GroupRoleEntry,
} from "./group-coordinator";
import { getGroupDialogGroup, showGroupDialog } from "./group-dialog-coordinator";
import { clearGroupSearchIndex, removeGroupSearchIndex, syncGroupSearchIndex } from "./search-index-coordinator";
import type { GroupUserVisibility } from "vrchat";

type RepresentedGroupArgs = Awaited<ReturnType<typeof groupRequest.getRepresentedGroup>>;
type GroupListArgs = Awaited<ReturnType<typeof groupRequest.getGroups>>;
type GroupListItem = GroupListArgs["json"][number];
type GroupPermissionsArgs = Awaited<ReturnType<typeof groupRequest.getGroupPermissions>>;
type GroupMemberPropsArgs = Awaited<ReturnType<typeof groupRequest.setGroupMemberProps>>;
type GroupMemberPropsJson = GroupMemberPropsArgs["json"] & { $memberId?: string | undefined };
type GroupUserInstanceJson = InstanceJsonInput;

function groupPrivacyOf(value: string | null | undefined): "default" | "private" | undefined {
  if (value === "default" || value === "private") {
    return value;
  }
  return undefined;
}

const savedGroupSchema = z.object({
  id: z.string().optional(),
  name: z.string().optional(),
  iconUrl: z.string().optional(),
  ownerId: z.string().optional(),
  roles: z.array(z.custom<GroupRoleEntry>((value) => typeof value === "object" && value !== null)).optional(),
  roleIds: z.array(z.string()).optional(),
});

const savedGroupListSchema = z.array(z.unknown());

const groupOrderSchema = z.array(z.string());

export function applyPresenceGroups(ref: { presence?: { groups?: string[] | null } }) {
  const groupStore = useGroupStore();
  if (!groupStore.currentUserGroupsInit) {
    return;
  }
  const groups = ref.presence?.groups;
  if (!groups) {
    console.error("applyPresenceGroups: invalid groups", ref);
    return;
  }
  if (groups.length === 0) {
    return;
  }

  for (const groupId of groups) {
    if (!groupStore.currentUserGroups.has(groupId)) {
      onGroupJoined(groupId);
    }
  }
  for (const groupId of groupStore.currentUserGroups.keys()) {
    if (!groups.includes(groupId)) {
      onGroupLeft(groupId).catch(logError);
    }
  }
}

export function onGroupJoined(groupId: string) {
  const groupStore = useGroupStore();
  if (!groupStore.currentUserGroups.has(groupId)) {
    groupStore.currentUserGroups.set(
      groupId,
      createDefaultGroupRef({
        id: groupId,
        name: "",
        iconUrl: "",
      })
    );
    syncGroupSearchIndex({
      id: groupId,
      name: "",
      ownerId: "",
      iconUrl: "",
    });
    groupRequest
      .getGroup({ groupId, includeRoles: true })
      .then((args) => {
        applyGroup(args.json);
        saveCurrentUserGroups();
      })
      .catch(logError);
  }
}

export async function onGroupLeft(groupId: string) {
  const groupStore = useGroupStore();
  const args = await groupRequest.getGroup({ groupId });
  const ref = applyGroup(args.json);
  if (ref.membershipStatus === "member") {
    console.error(`onGroupLeft: presence lied, still a member of ${groupId}`);
    return;
  }
  if (groupStore.groupDialog.visible && groupStore.groupDialog.id === groupId) {
    showGroupDialog(groupId);
  }
  if (groupStore.currentUserGroups.has(groupId)) {
    groupStore.currentUserGroups.delete(groupId);
    removeGroupSearchIndex(groupId);
    groupChange(ref, "Left group");

    workerTimers.setTimeout(() => saveCurrentUserGroups(), 100);
  }
}

export async function loadCurrentUserGroups(userId: string, groups: string[] | null | undefined) {
  const groupStore = useGroupStore();
  const rawSavedGroups: unknown = JSON.parse(await configRepository.getString(`VRCX_currentUserGroups_${userId}`, "[]"));
  const parsedSavedGroups = savedGroupListSchema.safeParse(rawSavedGroups);
  if (!parsedSavedGroups.success) {
    console.error("loadCurrentUserGroups: saved groups are invalid, starting from the server list", parsedSavedGroups.error);
  }
  const savedGroups = (parsedSavedGroups.success ? parsedSavedGroups.data : []).flatMap((entry) => {
    const parsedEntry = savedGroupSchema.safeParse(entry);
    return parsedEntry.success ? [parsedEntry.data] : [];
  });
  groupStore.cachedGroups.clear();
  groupStore.currentUserGroups.clear();
  clearGroupSearchIndex();
  for (const group of savedGroups) {
    const json = {
      id: group.id,
      name: group.name,
      iconUrl: group.iconUrl,
      ownerId: group.ownerId,
      roles: group.roles,
      myMember: {
        roleIds: group.roleIds,
      },
    };
    const ref = applyGroup(json);
    groupStore.currentUserGroups.set(ref.id ?? "", ref);
    syncGroupSearch(ref);
  }

  if (groups) {
    const promises = groups.map(async (groupId) => {
      const groupRef = groupStore.cachedGroups.get(groupId);

      if (typeof groupRef !== "undefined" && (groupRef.roles?.length ?? 0) > 0) {
        return;
      }

      try {
        console.log(`Fetching group with missing roles ${groupId}`);
        const args = await groupRequest.getGroup({
          groupId,
          includeRoles: true,
        });
        const ref = applyGroup(args.json);
        groupStore.currentUserGroups.set(groupId, ref);
        syncGroupSearch(ref);
      } catch (err) {
        console.error(err);
      }
    });

    await Promise.allSettled(promises);
  }

  groupStore.setCurrentUserGroupsInit(true);
  getCurrentUserGroups().catch(logError);
}

export async function getCurrentUserGroups() {
  const groupStore = useGroupStore();
  const userStore = useUserStore();
  const args = await groupRequest.getGroups({
    userId: userStore.currentUser.id,
  });
  handleGroupList(args);
  groupStore.currentUserGroups.clear();
  clearGroupSearchIndex();
  for (const group of args.json) {
    const ref = applyGroup({ ...group, privacy: groupPrivacyOf(group.privacy) });
    if (!groupStore.currentUserGroups.has(group.id ?? "")) {
      groupStore.currentUserGroups.set(group.id ?? "", ref);
      syncGroupSearch(ref);
    }
  }
  const permissionArgs = await groupRequest.getGroupPermissions({
    userId: userStore.currentUser.id,
  });
  handleGroupPermissions(permissionArgs);
  saveCurrentUserGroups();
}

export function getCurrentUserRepresentedGroup() {
  const userStore = useUserStore();
  return groupRequest
    .getRepresentedGroup({
      userId: userStore.currentUser.id,
    })
    .then((args) => {
      handleGroupRepresented(args);
      return args;
    });
}

export function initUserGroups() {
  const userStore = useUserStore();
  updateInGameGroupOrder().catch(logError);
  loadCurrentUserGroups(userStore.currentUser.id, userStore.currentUser.presence.groups).catch(logError);
}

export async function updateInGameGroupOrder() {
  const groupStore = useGroupStore();
  const gameStore = useGameStore();
  const userStore = useUserStore();
  groupStore.setInGameGroupOrder([]);
  try {
    const json = await gameStore.getVRChatRegistryKey(`VRC_GROUP_ORDER_${userStore.currentUser.id}`);
    if (!json) {
      return;
    }
    if (typeof json !== "string") {
      console.error("updateInGameGroupOrder: group order is not a string", json);
      return;
    }
    const parsedOrder = groupOrderSchema.safeParse(JSON.parse(json));
    if (!parsedOrder.success) {
      console.error("updateInGameGroupOrder: group order is invalid", parsedOrder.error);
      return;
    }
    groupStore.setInGameGroupOrder(parsedOrder.data);
  } catch (err) {
    console.error(err);
  }
}

export function isSoleGroupOwner(group: Partial<VrcxGroup> | undefined, userId: string) {
  return group?.ownerId === userId && typeof group.memberCount === "number" && group.memberCount <= 1;
}

export function leaveGroup(groupId: string) {
  const groupStore = useGroupStore();
  const userStore = useUserStore();
  const group = groupStore.cachedGroups.get(groupId) ?? groupStore.currentUserGroups.get(groupId);
  const isDeleteOwnedGroup = isSoleGroupOwner(group, userStore.currentUser.id);
  const request = isDeleteOwnedGroup
    ? groupRequest.deleteGroup({
        groupId,
        hardDelete: false,
      })
    : groupRequest.leaveGroup({
        groupId,
      });
  return request.then((args) => {
    const groupId = args.params.groupId;
    if (groupStore.groupDialog.visible && groupStore.groupDialog.id === groupId) {
      if (isDeleteOwnedGroup) {
        groupStore.groupDialog.visible = false;
      } else {
        groupStore.groupDialog.inGroup = false;
        getGroupDialogGroup(groupId).catch(logError);
      }
    }
    if (isDeleteOwnedGroup) {
      groupStore.currentUserGroups.delete(groupId);
      groupStore.cachedGroups.delete(groupId);
      removeGroupSearchIndex(groupId);
      saveCurrentUserGroups();
    }
    if (userStore.userDialog.visible && userStore.userDialog.id === userStore.currentUser.id && userStore.userDialog.representedGroup.id === groupId) {
      getCurrentUserRepresentedGroup().catch(logError);
    }
  });
}

export function leaveGroupPrompt(groupId: string) {
  const t = i18n.global.t;
  const modalStore = useModalStore();
  const groupStore = useGroupStore();
  const userStore = useUserStore();
  const group = groupStore.currentUserGroups.get(groupId) ?? groupStore.cachedGroups.get(groupId);
  const isDeleteOwnedGroup = isSoleGroupOwner(group, userStore.currentUser.id);
  modalStore
    .confirm({
      description: isDeleteOwnedGroup ? t("confirm.delete_group", { name: group?.name }) : t("confirm.leave_group"),
      title: t("confirm.title"),
      destructive: true,
    })
    .then(({ ok }) => {
      if (!ok) {
        return;
      }
      leaveGroup(groupId).catch(logError);
    })
    .catch(logError);
}

export function setGroupVisibility(groupId: string, visibility: GroupUserVisibility) {
  const t = i18n.global.t;
  const userStore = useUserStore();
  return groupRequest
    .setGroupMemberProps(userStore.currentUser.id, groupId, {
      visibility,
    })
    .then((args) => {
      handleGroupMemberProps(args);
      toast.success(t("message.group.visibility_updated"));
      return args;
    });
}

export function setGroupSubscription(groupId: string, isSubscribed: boolean) {
  const t = i18n.global.t;
  const userStore = useUserStore();
  return groupRequest
    .setGroupMemberProps(userStore.currentUser.id, groupId, {
      isSubscribedToAnnouncements: isSubscribed,
    })
    .then((args) => {
      handleGroupMemberProps(args);
      toast.success(t("message.group.subscription_updated"));
      return args;
    });
}

export function setGroupEventAnnouncements(groupId: string, isSubscribed: boolean) {
  const t = i18n.global.t;
  const userStore = useUserStore();
  return groupRequest
    .setGroupMemberProps(userStore.currentUser.id, groupId, {
      isSubscribedToEventAnnouncements: isSubscribed,
    })
    .then((args) => {
      handleGroupMemberProps(args);
      toast.success(t("message.group.event_announcement_updated"));
      return args;
    });
}

function toRepresentedGroupState(json: RepresentedGroupArgs["json"]): RepresentedGroupState {
  return {
    bannerId: json.bannerId ?? "",
    bannerUrl: json.bannerUrl ?? "",
    description: json.description ?? "",
    discriminator: json.discriminator ?? "",
    groupId: json.groupId ?? "",
    iconUrl: json.iconUrl ?? "",
    id: "",
    isRepresenting: json.isRepresenting ?? false,
    memberCount: json.memberCount ?? 0,
    memberVisibility: json.memberVisibility ?? "",
    name: json.name ?? "",
    ownerId: json.ownerId ?? "",
    privacy: json.privacy ?? "",
    shortCode: json.shortCode ?? "",
    $thumbnailUrl: convertFileUrlToImageUrl(json.iconUrl),
    $memberId: "",
  };
}

export function handleGroupRepresented(args: RepresentedGroupArgs) {
  const userStore = useUserStore();
  const D = userStore.userDialog;
  const json = args.json;
  D.representedGroup = toRepresentedGroupState(json);
  if (!json.isRepresenting) {
    D.isRepresentedGroupLoading = false;
  }
  if (!json.groupId) {
    return;
  }
  if (args.params.userId !== userStore.currentUser.id) {
    return;
  }
  D.representedGroup.id = json.groupId;
  applyGroup({ ...json, id: json.groupId, $memberId: undefined, privacy: groupPrivacyOf(json.privacy) });
}

export function handleGroupList(args: GroupListArgs) {
  for (const json of args.json) {
    const item: GroupListItem & { $memberId?: string | undefined } = json;
    item.$memberId = item.id;
    item.id = item.groupId ?? "";
    applyGroup({ ...item, privacy: groupPrivacyOf(item.privacy) });
  }
}

export function handleGroupMemberProps(args: GroupMemberPropsArgs) {
  const groupStore = useGroupStore();
  const userStore = useUserStore();
  if (args.userId === userStore.currentUser.id) {
    const json: GroupMemberPropsJson = args.json;
    json.$memberId = json.id;
    json.id = json.groupId;
    const dialog = groupStore.groupDialog;
    const dialogMember = dialog.ref.myMember;
    if (dialog.visible && dialog.id === json.groupId && dialogMember) {
      if (json.visibility !== undefined) {
        dialogMember.visibility = json.visibility;
      }
      if (json.isSubscribedToAnnouncements !== undefined) {
        dialogMember.isSubscribedToAnnouncements = json.isSubscribedToAnnouncements;
      }
      if (json.isSubscribedToEventAnnouncements !== undefined) {
        dialogMember.isSubscribedToEventAnnouncements = json.isSubscribedToEventAnnouncements;
      }
    }
    if (userStore.userDialog.visible && userStore.userDialog.id === userStore.currentUser.id) {
      getCurrentUserRepresentedGroup().catch(logError);
    }
    handleGroupMember({
      json,
    });
  }
  if (groupStore.groupDialog.id === args.json.groupId) {
    for (const member of groupStore.groupDialog.members) {
      if (member.userId === args.json.userId) {
        Object.assign(member, applyGroupMember(args.json));
        break;
      }
    }
    for (const member of groupStore.groupDialog.memberSearchResults) {
      if (member.userId === args.json.userId) {
        Object.assign(member, applyGroupMember(args.json));
        break;
      }
    }
  }
}

export function handleGroupPermissions(args: GroupPermissionsArgs) {
  const groupStore = useGroupStore();
  const userStore = useUserStore();
  if (args.params.userId !== userStore.currentUser.id) {
    return;
  }
  for (const [groupId, permissions] of Object.entries(args.json)) {
    const group = groupStore.cachedGroups.get(groupId);
    if (group?.myMember) {
      group.myMember.permissions = permissions;
    }
  }
}

export async function handleGroupUserInstances(args: { json: { instances: GroupUserInstanceJson[]; fetchedAt?: string | undefined } }) {
  const groupStore = useGroupStore();
  const instanceStore = useInstanceStore();
  groupStore.setGroupInstances([]);
  for (const json of args.json.instances) {
    if (args.json.fetchedAt) {
      json.$fetchedAt = args.json.fetchedAt;
    }
    const instanceRef = instanceStore.applyInstance(json);
    const groupRef = groupStore.cachedGroups.get(json.ownerId ?? "");
    if (typeof groupRef === "undefined") {
      if (watchState.isFriendsLoaded) {
        const groupArgs = await groupRequest.getGroup({
          groupId: json.ownerId ?? "",
        });
        applyGroup(groupArgs.json);
      }
      return;
    }
    if (instanceRef === null) {
      continue;
    }
    groupStore.groupInstances.push({
      group: groupRef,
      instance: instanceRef,
    });
  }
}
