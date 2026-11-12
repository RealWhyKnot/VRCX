export const GROUP_LIMIT = 200;

export type GroupVisitStats = { visitCount: number; lastVisitAt: string; timeSpent: number };

export type GroupNotificationStats = { notificationCount: number; lastNotificationAt: string };

export type GroupOverviewSource = {
  id?: string | undefined;
  name?: string | undefined;
  iconUrl?: string | null | undefined;
  memberCount?: number | undefined;
  ownerId?: string | undefined;
};

export type GroupOverviewRow = {
  id: string;
  name: string;
  iconUrl: string;
  memberCount: number;
  canLeave: boolean;
  notificationCount: number;
  lastNotificationAt: string;
  visitCount: number;
  lastVisitAt: string;
  timeSpent: number;
};

export function buildGroupOverview(
  groups: Iterable<GroupOverviewSource>,
  visits: ReadonlyMap<string, GroupVisitStats>,
  notifications: ReadonlyMap<string, GroupNotificationStats>,
  currentUserId: string
): GroupOverviewRow[] {
  const rows: GroupOverviewRow[] = [];
  for (const group of groups) {
    const id = group.id ?? "";
    if (!id) {
      continue;
    }
    const visit = visits.get(id);
    const notification = notifications.get(id);
    rows.push({
      id,
      name: group.name ?? id,
      iconUrl: group.iconUrl ?? "",
      memberCount: group.memberCount ?? 0,
      canLeave: group.ownerId !== currentUserId,
      notificationCount: notification?.notificationCount ?? 0,
      lastNotificationAt: notification?.lastNotificationAt ?? "",
      visitCount: visit?.visitCount ?? 0,
      lastVisitAt: visit?.lastVisitAt ?? "",
      timeSpent: visit?.timeSpent ?? 0,
    });
  }
  return rows;
}

export function filterGroupOverview(rows: GroupOverviewRow[], search: string): GroupOverviewRow[] {
  const wanted = search.trim().toLowerCase();
  if (!wanted) {
    return rows;
  }
  return rows.filter((row) => row.name.toLowerCase().includes(wanted));
}
