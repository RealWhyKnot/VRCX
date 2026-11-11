import type { GroupSearchSort } from "vrchat";

type RoleLike = { id?: string | undefined; name?: string | undefined };

export function toGroupSearchSort(value: string): GroupSearchSort {
  return value === "joinedAt:asc" ? "joinedAt:asc" : "joinedAt:desc";
}

export function hasUserId<T extends { userId?: string | null | undefined }>(row: T): row is T & { userId: string } {
  return typeof row.userId === "string";
}

export function getAuditLogTypeName(auditLogType: string | null | undefined): string {
  if (!auditLogType) return "";
  return auditLogType
    .replace("group.", "")
    .replace(/\./g, " ")
    .replace(/\b\w/g, (l) => l.toUpperCase());
}

export function resolveRoleNames(roleIds: string[] | null | undefined, roles: readonly RoleLike[] | null | undefined): string {
  const ids = roleIds ?? [];
  const roleList = roles ?? [];
  const names: string[] = [];
  for (const id of ids) {
    const role = roleList.find((r) => r.id === id);
    if (role?.name) {
      names.push(role.name);
    }
  }
  return names.join(", ");
}
