export function getAuditLogTypeName(auditLogType) {
  if (!auditLogType) return "";
  return auditLogType
    .replace("group.", "")
    .replace(/\./g, " ")
    .replace(/\b\w/g, (l) => l.toUpperCase());
}

export function resolveRoleNames(roleIds, roles) {
  const ids = Array.isArray(roleIds) ? roleIds : [];
  const roleList = Array.isArray(roles) ? roles : [];
  const names = [];
  for (const id of ids) {
    const role = roleList.find((r) => r?.id === id);
    if (role?.name) {
      names.push(role.name);
    }
  }
  return names.join(", ");
}
