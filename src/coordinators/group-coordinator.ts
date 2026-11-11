import * as workerTimers from "worker-timers";

import { queryRequest } from "../api/query-request";
import { patchGroupFromEvent } from "../queries/entity-cache";
import { configRepository } from "../services/config";
import { sanitizeEntityJson } from "../shared/utils/entity-transforms";
import { createDefaultGroupRef, type GroupMemberInput, type GroupRefInput } from "../shared/utils/group-transforms";
import { useGroupStore } from "../stores/group";
import { useNotificationStore } from "../stores/notification";
import { useUserStore } from "../stores/user";
import type { VrcxGroup } from "../types/vrcx";
import { syncGroupSearchIndex } from "./search-index-coordinator";

export type GroupRoleEntry = NonNullable<VrcxGroup["roles"]>[number];
export type GroupRoles = VrcxGroup["roles"];
export type GroupJson = GroupRefInput & { roleIds?: string[] | undefined };

export type GroupMemberRecord = Omit<GroupMemberInput, "user"> & {
  $displayName?: string | undefined;
  $memberId?: string | undefined;
  user?: { id?: string | undefined; displayName?: string | undefined } | null | undefined;
};

export type SavedGroup = {
  id?: string | undefined;
  name?: string | undefined;
  iconUrl?: string | null | undefined;
  ownerId?: string | undefined;
  roles?: GroupRoles | undefined;
  roleIds?: string[] | undefined;
};

export function syncGroupSearch(ref: VrcxGroup) {
  syncGroupSearchIndex({
    id: ref.id ?? "",
    name: ref.name ?? "",
    ownerId: ref.ownerId ?? "",
    iconUrl: ref.iconUrl ?? "",
    bannerUrl: ref.bannerUrl ?? "",
  });
}

export function logError(error: unknown) {
  console.error(error);
}

function applyGroupLanguage(ref: VrcxGroup) {
  const userStore = useUserStore();
  ref.$languages = [];
  const { languages } = ref;
  if (!languages) {
    return;
  }
  for (const language of languages) {
    const value = userStore.subsetOfLanguages[language];
    if (typeof value === "undefined") {
      continue;
    }
    ref.$languages.push({
      key: language,
      value,
    });
  }
}

export function applyGroup(json: GroupJson): VrcxGroup {
  const groupStore = useGroupStore();
  let ref = groupStore.cachedGroups.get(json.id ?? "");
  sanitizeEntityJson(json, ["rules", "name", "description"]);
  if (Array.isArray(json.roles)) {
    for (const role of json.roles) {
      sanitizeEntityJson(role, ["name", "description"]);
    }
  }
  if (typeof ref === "undefined") {
    ref = createDefaultGroupRef(json);
    groupStore.cachedGroups.set(ref.id ?? "", ref);
  } else {
    if (groupStore.currentUserGroups.has(ref.id ?? "")) {
      if (ref.ownerId && json.ownerId && ref.ownerId !== json.ownerId) {
        groupOwnerChange(json, ref.ownerId, json.ownerId).catch(logError);
      }
      if (ref.name && json.name && ref.name !== json.name) {
        groupChange(json, `Name changed from ${ref.name} to ${json.name}`);
      }
      if (ref.myMember?.roleIds && json.myMember?.roleIds) {
        const oldRoleIds = ref.myMember.roleIds;
        const newRoleIds = json.myMember.roleIds;
        if (oldRoleIds.length !== newRoleIds.length || !oldRoleIds.every((value, index) => value === newRoleIds[index])) {
          groupRoleChange(json, ref.roles, json.roles, oldRoleIds, newRoleIds);
        }
      }
    }
    if (json.myMember) {
      if (typeof json.myMember.roleIds === "undefined") {
        json.myMember.roleIds = ref.myMember?.roleIds;
      }
      if (ref.myMember) {
        Object.assign(ref.myMember, json.myMember);
      }
    }
    Object.assign(ref, json);
  }

  if (ref.myMember) {
    if (typeof json.memberVisibility === "string") {
      ref.myMember.visibility = json.memberVisibility;
    }
    if (typeof json.isRepresenting === "boolean") {
      ref.myMember.isRepresenting = json.isRepresenting;
    }
    if (typeof json.membershipStatus === "string") {
      ref.myMember.membershipStatus = json.membershipStatus;
    }
    if (typeof json.roleIds !== "undefined") {
      ref.myMember.roleIds = json.roleIds;
    }
  }
  applyGroupLanguage(ref);

  const currentUserGroupRef = groupStore.currentUserGroups.get(ref.id ?? "");
  if (currentUserGroupRef) {
    groupStore.currentUserGroups.set(ref.id ?? "", ref);
  }

  const D = groupStore.groupDialog;
  if (D.visible && D.id === ref.id) {
    D.inGroup = ref.membershipStatus === "member";
    D.ref = ref;
  }
  patchGroupFromEvent(ref);
  if (groupStore.currentUserGroups.has(ref.id ?? "")) {
    syncGroupSearch(ref);
  }
  return ref;
}

export function applyGroupMember(json: GroupMemberRecord): GroupMemberRecord {
  const userStore = useUserStore();
  const groupStore = useGroupStore();
  if (json.user) {
    if (json.userId === userStore.currentUser.id) {
      json.user = userStore.currentUser;
      json.$displayName = userStore.currentUser.displayName;
    } else {
      const ref = userStore.cachedUsers.get(json.user.id ?? "");
      if (typeof ref !== "undefined") {
        json.user = ref;
        json.$displayName = ref.displayName;
      } else {
        json.$displayName = json.user.displayName;
      }
    }
  }

  if (json.userId === userStore.currentUser.id) {
    const groupRef = groupStore.cachedGroups.get(json.groupId ?? "");
    if (typeof groupRef !== "undefined") {
      const groupMember = {
        ...groupRef.myMember,
        id: json.id,
        isRepresenting: json.isRepresenting,
        isSubscribedToAnnouncements: json.isSubscribedToAnnouncements,
        isSubscribedToEventAnnouncements: json.isSubscribedToEventAnnouncements,
        joinedAt: json.joinedAt,
        lastPostReadAt: json.lastPostReadAt,
        mRoleIds: json.mRoleIds,
        membershipStatus: json.membershipStatus,
        roleIds: json.roleIds,
        userId: json.userId,
        visibility: json.visibility,
      };
      applyGroup({
        id: json.groupId,
        myMember: groupMember,
      });
    }
  }

  return json;
}

export function handleGroupMember(args: { json: GroupMemberRecord; ref?: GroupMemberRecord }) {
  args.ref = applyGroupMember(args.json);
}

export function groupChange(ref: GroupRefInput, message: string) {
  const groupStore = useGroupStore();
  const notificationStore = useNotificationStore();
  if (!groupStore.currentUserGroupsInit) {
    return;
  }

  const json = {
    id: Math.random().toString(36),
    type: "groupChange",
    senderUserId: ref.id,
    senderUsername: ref.name,
    imageUrl: ref.iconUrl,
    details: {
      imageUrl: ref.iconUrl,
    },
    message,
    created_at: new Date().toJSON(),
  };
  notificationStore.handleNotification({
    json,
    params: {
      notificationId: json.id,
    },
  });

  workerTimers.setTimeout(() => saveCurrentUserGroups(), 100);
}

async function groupOwnerChange(ref: GroupRefInput, oldUserId: string, newUserId: string) {
  const oldUser = await queryRequest.fetch("user.dialog", {
    userId: oldUserId,
  });
  const newUser = await queryRequest.fetch("user.dialog", {
    userId: newUserId,
  });
  const oldDisplayName = oldUser.ref.displayName;
  const newDisplayName = newUser.ref.displayName;

  groupChange(ref, `Owner changed from ${oldDisplayName} to ${newDisplayName}`);
}

function groupRoleChange(ref: GroupRefInput, oldRoles: GroupRoles, newRoles: GroupRoles, oldRoleIds: string[], newRoleIds: string[]) {
  for (const roleId of oldRoleIds) {
    if (!newRoleIds.includes(roleId)) {
      let roleName = "";
      const role = oldRoles?.find((fineRole) => fineRole.id === roleId);
      if (role) {
        roleName = String(role.name);
      }
      groupChange(ref, `Role ${roleName} removed`);
    }
  }
  if (typeof newRoles !== "undefined") {
    for (const roleId of newRoleIds) {
      if (!oldRoleIds.includes(roleId)) {
        let roleName = "";
        const role = newRoles?.find((fineRole) => fineRole.id === roleId);
        if (role) {
          roleName = String(role.name);
        }
        groupChange(ref, `Role ${roleName} added`);
      }
    }
  }
}

export function saveCurrentUserGroups() {
  const groupStore = useGroupStore();
  const userStore = useUserStore();
  if (!groupStore.currentUserGroupsInit) {
    return;
  }
  const groups: SavedGroup[] = [];
  for (const ref of groupStore.currentUserGroups.values()) {
    groups.push({
      id: ref.id,
      name: ref.name,
      ownerId: ref.ownerId,
      iconUrl: ref.iconUrl,
      roles: ref.roles,
      roleIds: ref.myMember?.roleIds,
    });
  }
  configRepository.setString(`VRCX_currentUserGroups_${userStore.currentUser.id}`, JSON.stringify(groups)).catch(logError);
}
