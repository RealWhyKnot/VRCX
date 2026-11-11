import { parseLocation } from "./location-parser";
import { queryRequest } from "../../api/query-request";

type GroupPermissionHolder = {
  myMember?: { permissions?: readonly string[] | null } | null;
};

type GroupMemberLike = {
  userId: string;
  user?: { displayName?: string | null } | null;
};

function hasGroupPermission(ref: GroupPermissionHolder | null | undefined, permission: string) {
  const permissions = ref?.myMember?.permissions;
  if (permissions && (permissions.includes("*") || permissions.includes(permission))) {
    return true;
  }
  return false;
}

function hasGroupModerationPermission(group: GroupPermissionHolder | null | undefined) {
  return (
    hasGroupPermission(group, "group-invites-manage") ||
    hasGroupPermission(group, "group-moderates-manage") ||
    hasGroupPermission(group, "group-audit-view") ||
    hasGroupPermission(group, "group-bans-manage") ||
    hasGroupPermission(group, "group-data-manage") ||
    hasGroupPermission(group, "group-members-manage") ||
    hasGroupPermission(group, "group-members-remove") ||
    hasGroupPermission(group, "group-roles-assign") ||
    hasGroupPermission(group, "group-roles-manage") ||
    hasGroupPermission(group, "group-default-role-manage") ||
    hasGroupPermission(group, "group-announcement-manage") ||
    hasGroupPermission(group, "group-calendar-manage")
  );
}

async function getGroupName(data: string | null | undefined) {
  if (!data) {
    return "";
  }
  let groupName = "";
  const groupId = data.startsWith("grp_") ? data : parseLocation(data).groupId;
  if (!groupId) {
    return "";
  }
  try {
    const args = await queryRequest.fetch("group.dialog", {
      groupId,
    });
    groupName = args.ref.name ?? "";
  } catch (err) {
    console.error(err);
  }
  return groupName;
}

function mergeGroupMemberSearchResults<T extends GroupMemberLike>(results: readonly T[], members: readonly T[], search: string) {
  const merged = [...results];
  const seenUserIds = new Set(merged.map((member) => member.userId));
  const query = search.toLowerCase();
  for (const member of members) {
    if (!seenUserIds.has(member.userId)) {
      const displayName = (member.user?.displayName ?? "").toLowerCase();
      if (displayName.includes(query)) {
        merged.push(member);
        seenUserIds.add(member.userId);
      }
    }
  }
  return merged;
}

export { hasGroupPermission, hasGroupModerationPermission, getGroupName, mergeGroupMemberSearchResults };
