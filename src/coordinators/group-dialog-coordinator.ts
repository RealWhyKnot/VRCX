import { nextTick } from "vue";
import { toast } from "vue-sonner";
import { i18n } from "../plugins/i18n";

import { groupRequest } from "../api/group";
import { instanceRequest } from "../api/instance";
import { queryRequest } from "../api/query-request";
import { database } from "../services/database";
import { FILTER_EVERYONE } from "../shared/constants/group";
import { sanitizeEntityJson } from "../shared/utils/entity-transforms";
import { hasGroupPermission } from "../shared/utils/group";
import { useGroupStore } from "../stores/group";
import { useInstanceStore } from "../stores/instance";
import { useUiStore } from "../stores/ui";
import type { Json, VrcxGroup, VrcxInstanceWorld } from "../types/vrcx";
import type { Instance } from "vrchat";
import { applyGroup, logError, type GroupRoleEntry } from "./group-coordinator";

type GroupDialogInstanceJson = Omit<Json<Instance>, "world"> & { world: VrcxInstanceWorld };

function crumbLabel(name: string | undefined, fallback: string) {
  if (name) {
    return name;
  }
  return fallback;
}

export function showGroupDialog(groupId: string, options: { forceRefresh?: boolean } = {}) {
  const t = i18n.global.t;
  const groupStore = useGroupStore();
  const uiStore = useUiStore();
  const instanceStore = useInstanceStore();
  if (!groupId) {
    return;
  }
  const isForceRefresh = Boolean(options.forceRefresh);
  const isMainDialogOpen = uiStore.openDialog({
    type: "group",
    id: groupId,
  });
  const D = groupStore.groupDialog;
  D.visible = true;
  if (isMainDialogOpen && D.id === groupId && !isForceRefresh) {
    uiStore.setDialogCrumbLabel("group", D.id, crumbLabel(D.ref.name, D.id));
    instanceStore.applyGroupDialogInstances();
    D.loading = false;
    return;
  }
  D.loading = true;
  D.id = groupId;
  D.inGroup = false;
  D.ownerDisplayName = "";
  D.announcement = {};
  D.posts = [];
  D.postsFiltered = [];
  D.instances = [];
  D.memberRoles = [];
  D.lastVisit = "";
  D.joinCount = 0;
  D.instancesSeen = 0;
  D.lastInstanceSeenAt = "";
  D.memberSearch = "";
  D.memberSearchResults = [];
  D.galleries = {};
  D.listings = [];
  D.members = [];
  D.memberFilter = FILTER_EVERYONE;
  D.calendar = [];
  const loadGroupRequest = groupRequest.getGroup({
    groupId,
    includeRoles: true,
  });

  loadGroupRequest
    .catch((err: unknown) => {
      D.loading = false;
      D.id = "";
      D.visible = false;
      uiStore.jumpBackDialogCrumb();
      toast.error(t("message.group.load_failed"));
      throw err;
    })
    .then((args) => {
      const ref = args.ref;
      if (groupId === ref.id) {
        D.ref = ref;
        uiStore.setDialogCrumbLabel("group", D.id, crumbLabel(D.ref.name, D.id));
        D.inGroup = ref.membershipStatus === "member";
        D.ownerDisplayName = ref.ownerId ?? "";
        D.visible = true;
        D.loading = false;
        queryRequest
          .fetch("user.dialog", {
            userId: ref.ownerId ?? "",
          })
          .then((ownerArgs) => {
            D.ownerDisplayName = ownerArgs.ref.displayName;
          })
          .catch(logError);
        database
          .getLastGroupVisit(D.id)
          .then((r) => {
            if (D.id === ref.id) {
              D.lastVisit = r.created_at;
            }
          })
          .catch(logError);
        database
          .getGroupJoinCount(D.id)
          .then((r) => {
            if (D.id === ref.id) {
              D.joinCount = r.joinCount;
            }
          })
          .catch(logError);
        database
          .getSightingSummary(D.id)
          .then((summary) => {
            if (D.id === ref.id) {
              D.instancesSeen = summary.hostedCount;
              D.lastInstanceSeenAt = summary.lastHostedAt;
            }
          })
          .catch(logError);
        instanceStore.applyGroupDialogInstances();
        getGroupDialogGroup(groupId, ref).catch(logError);
      }
    })
    .catch(logError);
}

export function clearGroupMemberModerationDialog() {
  const groupStore = useGroupStore();
  const D = groupStore.groupMemberModeration;
  D.tables.members.data = [];
  D.tables.members.pageIndex = 0;
  D.tables.bans.data = [];
  D.tables.bans.pageIndex = 0;
  D.tables.invites.data = [];
  D.tables.invites.pageIndex = 0;
  D.tables.logs.data = [];
  D.tables.logs.pageIndex = 0;
}

export function showGroupMemberModerationDialog(groupId: string, userId = "") {
  const uiStore = useUiStore();
  const groupStore = useGroupStore();
  const isMainDialogOpen = uiStore.openDialog({
    type: "group-member-moderation",
    id: groupId,
  });
  const D = groupStore.groupMemberModeration;
  if (!isMainDialogOpen || groupId !== D.id) {
    clearGroupMemberModerationDialog();
  }
  D.id = groupId;
  D.openWithUserId = userId;

  D.groupRef = {};
  D.auditLogTypes = [];
  queryRequest
    .fetch("group.dialog", { groupId })
    .then((args) => {
      D.groupRef = args.ref;
      uiStore.setDialogCrumbLabel("group-member-moderation", D.id, crumbLabel(D.groupRef.name, D.id));
      if (hasGroupPermission(D.groupRef, "group-audit-view")) {
        groupRequest
          .getGroupAuditLogTypes({ groupId })
          .then((auditArgs) => {
            if (D.id !== auditArgs.params.groupId) {
              return;
            }
            D.auditLogTypes = auditArgs.json;
          })
          .catch(logError);
      }
    })
    .catch(logError);
  D.visible = true;
}

export async function loadGroupRolesDialogRoles(groupId: string) {
  const groupStore = useGroupStore();
  const D = groupStore.groupRolesDialog;
  D.loading = true;
  try {
    if (!canEditGroupRoles(D.groupRef)) {
      const args = await groupRequest.getGroup({ groupId, includeRoles: true });
      if (D.id !== args.params.groupId) {
        return;
      }
      D.groupRef = args.ref;
      setGroupRolesDialogRoles(args.ref.roles ?? []);
      await loadViewOnlyGroupPermissions(groupId);
      return;
    }
    const args = await groupRequest.getGroupRoles({ groupId });
    if (D.id !== args.params.groupId) {
      return;
    }
    setGroupRolesDialogRoles(args.json.map((role) => sanitizeEntityJson(role, ["name", "description"])));
  } finally {
    D.loading = false;
  }
}

function canEditGroupRoles(groupRef: Partial<VrcxGroup>) {
  return hasGroupPermission(groupRef, "group-roles-manage") || hasGroupPermission(groupRef, "group-default-role-manage");
}

function setGroupRolesDialogRoles(roles: GroupRoleEntry[]) {
  const groupStore = useGroupStore();
  const D = groupStore.groupRolesDialog;
  D.roles = [...roles].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

async function loadViewOnlyGroupPermissions(groupId: string) {
  const groupStore = useGroupStore();
  const D = groupStore.groupRolesDialog;
  const managedGroup = Array.from(groupStore.currentUserGroups.values()).find((group) => hasGroupPermission(group, "group-roles-manage"));
  if (managedGroup?.id) {
    try {
      const args = await groupRequest.getGroupPermissionList({ groupId: managedGroup.id });
      if (D.id !== groupId) {
        return;
      }
      D.permissions = args.json.map((permission) => ({ ...permission, allowedToAdd: false }));
      return;
    } catch (error) {
      console.error("Failed to load group permission list:", error);
    }
  }
  if (D.id !== groupId) {
    return;
  }
  const permissionNames = new Set<string>();
  for (const role of D.roles) {
    for (const permission of role.permissions ?? []) {
      permissionNames.add(permission);
    }
  }
  D.permissions = Array.from(permissionNames)
    .sort()
    .map((name) => ({ name, allowedToAdd: false }));
}

export function showGroupRolesDialog(groupId: string) {
  const uiStore = useUiStore();
  const groupStore = useGroupStore();
  uiStore.openDialog({
    type: "group-roles",
    id: groupId,
  });
  const D = groupStore.groupRolesDialog;
  if (D.id !== groupId) {
    D.roles = [];
    D.permissions = [];
    D.selectedRoleId = "";
  }
  D.id = groupId;
  D.groupRef = {};
  D.loading = true;
  queryRequest
    .fetch("group.dialog", { groupId, includeRoles: true })
    .then((args) => {
      if (D.id !== groupId) {
        return;
      }
      D.groupRef = args.ref;
      uiStore.setDialogCrumbLabel("group-roles", D.id, crumbLabel(D.groupRef.name, D.id));
      if (!canEditGroupRoles(D.groupRef)) {
        setGroupRolesDialogRoles(D.groupRef.roles ?? []);
        loadViewOnlyGroupPermissions(groupId)
          .finally(() => {
            D.loading = false;
          })
          .catch(logError);
        return;
      }
      loadGroupRolesDialogRoles(groupId).catch(logError);
      groupRequest
        .getGroupPermissionList({ groupId })
        .then((permissionArgs) => {
          if (D.id !== permissionArgs.params.groupId) {
            return;
          }
          D.permissions = permissionArgs.json;
        })
        .catch(logError);
    })
    .catch((error: unknown) => {
      D.loading = false;
      throw error;
    })
    .catch(logError);
  D.visible = true;
}

export function getGroupDialogCalendar(groupId: string) {
  const groupStore = useGroupStore();
  const D = groupStore.groupDialog;
  queryRequest
    .fetch("groupCalendar", { groupId })
    .then((args) => {
      if (D.id === args.params.groupId) {
        D.calendar = args.json.results ?? [];
        for (const event of D.calendar) {
          Object.assign(event, groupStore.applyGroupEvent(event));

          queryRequest
            .fetch("groupCalendarEvent", {
              groupId,
              eventId: event.id,
            })
            .then((eventArgs) => {
              Object.assign(event, groupStore.applyGroupEvent(eventArgs.json));
            })
            .catch(logError);
        }
      }
    })
    .catch(logError);
}

export function getGroupDialogGroup(groupId: string, existingRef?: VrcxGroup) {
  const groupStore = useGroupStore();
  const instanceStore = useInstanceStore();
  const D = groupStore.groupDialog;
  D.isGetGroupDialogGroupLoading = false;

  const refPromise = existingRef
    ? Promise.resolve({ ref: existingRef, args: undefined })
    : queryRequest.fetch("group.dialog", { groupId, includeRoles: true }).then((args) => ({ ref: applyGroup(args.json), args }));

  return refPromise.then((result) => {
    const ref = result.ref;
    if (D.id === ref.id) {
      D.loading = false;
      D.ref = ref;
      D.inGroup = ref.membershipStatus === "member";
      D.memberRoles = [];
      for (const role of ref.roles ?? []) {
        if (D.ref.myMember && Array.isArray(D.ref.myMember.roleIds) && D.ref.myMember.roleIds.includes(role.id ?? "")) {
          D.memberRoles.push(role);
        }
      }
      void groupStore.getAllGroupPosts({ groupId }).catch(logError);
      D.isGetGroupDialogGroupLoading = true;
      groupRequest
        .getGroupInstances({
          groupId,
        })
        .then((instancesArgs) => {
          const instances: GroupDialogInstanceJson[] = instancesArgs.json.instances ?? [];
          if (groupStore.groupDialog.id === instancesArgs.params.groupId) {
            instanceStore.applyGroupDialogInstances(instances);
          }
          for (const json of instances) {
            instanceStore.applyInstance(json);
            queryRequest
              .fetch("world.dialog", {
                worldId: json.worldId,
              })
              .then((worldArgs) => {
                json.world = worldArgs.ref;
              })
              .catch(logError);

            instanceRequest
              .getInstance({
                worldId: json.worldId,
                instanceId: json.instanceId,
              })
              .catch(logError);
          }
        })
        .catch(logError);
      getGroupDialogCalendar(groupId);
    }
    nextTick(() => (D.isGetGroupDialogGroupLoading = false)).catch(logError);
    return result.args ?? result;
  });
}
