import type { Dataset, Row } from "./fixtures.ts";

type Handler = (...args: unknown[]) => unknown;

const LIMIT_MAX = 1000;

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function count(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function texts(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function rows(list: Row[]): string {
  return JSON.stringify(list);
}

function contains(value: unknown, search: string): boolean {
  return typeof value === "string" && value.toLowerCase().includes(search.toLowerCase());
}

function friendLogMatches(row: Row, types: string[], search: string, shouldHideUnfriends: boolean): boolean {
  const type = text(row[2]);
  if (types.length > 0 && !types.some((wanted) => wanted.toLowerCase() === type.toLowerCase())) {
    return false;
  }
  if (shouldHideUnfriends && type === "Unfriend") {
    return false;
  }
  return search === "" || contains(row[4], search);
}

function friendLogOrder(isAscending: boolean) {
  return (left: Row, right: Row): number => {
    const byDate = text(left[1]).localeCompare(text(right[1]));
    if (byDate !== 0) {
      return isAscending ? byDate : -byDate;
    }
    return count(right[0], 0) - count(left[0], 0);
  };
}

function typeFilter(filters: string[], typeIndex: number) {
  return (row: Row): boolean => filters.length === 0 || filters.includes(text(row[typeIndex]));
}

function createDatabaseHandlers(data: Dataset): Map<string, Handler> {
  const filteredFriendLog = (types: unknown, search: unknown, shouldHideUnfriends: unknown, isAscending: unknown): Row[] =>
    data.friendLog.filter((row) => friendLogMatches(row, texts(types), text(search), shouldHideUnfriends === true)).sort(friendLogOrder(isAscending === true));
  let nextRowId = 1000000;
  const handlers: [string, Handler][] = [
    ["GetConfigValue", (key) => (data.config.has(text(key)) ? rows([[data.config.get(text(key)) ?? ""]]) : rows([]))],
    [
      "SetConfigValue",
      (key, value) => {
        data.config.set(text(key), text(value));
      },
    ],
    [
      "RemoveConfigValue",
      (key) => {
        data.config.delete(text(key));
      },
    ],
    ["GetFriendLogCurrent", () => rows(data.friendLogCurrent)],
    ["GetFriendLogHistory", () => rows(data.friendLog)],
    [
      "GetFriendLogHistoryPage",
      (limit, beforeId) => {
        const ordered = [...data.friendLog].reverse();
        const start = typeof beforeId === "number" ? ordered.filter((row) => count(row[0], 0) < beforeId) : ordered;
        return rows(start.slice(0, Math.min(count(limit, 100), LIMIT_MAX)));
      },
    ],
    [
      "GetFilteredFriendLogHistoryPage",
      (limit, beforeId, beforeDate, types, search, shouldHideUnfriends, isAscending) => {
        const ordered = filteredFriendLog(types, search, shouldHideUnfriends, isAscending);
        const cursorDate = text(beforeDate);
        const afterCursor =
          typeof beforeId === "number"
            ? ordered.filter((row) => {
                const byDate = text(row[1]).localeCompare(cursorDate);
                const isPastDate = isAscending === true ? byDate > 0 : byDate < 0;
                return isPastDate || (byDate === 0 && count(row[0], 0) < beforeId);
              })
            : ordered;
        return rows(afterCursor.slice(0, Math.min(count(limit, 100), LIMIT_MAX)));
      },
    ],
    [
      "GetFilteredFriendLogHistoryPageAtOffset",
      (limit, offset, types, search, shouldHideUnfriends, isAscending) => {
        const ordered = filteredFriendLog(types, search, shouldHideUnfriends, isAscending);
        const start = count(offset, 0);
        return rows(ordered.slice(start, start + Math.min(count(limit, 100), LIMIT_MAX)));
      },
    ],
    ["GetFilteredFriendLogHistoryCount", (types, search, shouldHideUnfriends) => rows([[filteredFriendLog(types, search, shouldHideUnfriends, false).length]])],
    [
      "GetFriendLogHistoryForUserId",
      (userId, types) => rows(data.friendLog.filter((row) => row[3] === userId && (texts(types).length === 0 || texts(types).includes(text(row[2]))))),
    ],
    [
      "AddFriendLogHistory",
      (createdAt, type, userId, displayName, previousDisplayName, trustLevel, previousTrustLevel, friendNumber) => {
        nextRowId += 1;
        data.friendLog.push([
          nextRowId,
          text(createdAt),
          text(type),
          text(userId),
          text(displayName),
          text(previousDisplayName) || null,
          text(trustLevel) || null,
          text(previousTrustLevel) || null,
          typeof friendNumber === "number" ? friendNumber : null,
        ]);
      },
    ],
    ["GetMaxFriendLogNumber", () => rows([[data.friendLogCurrent.length]])],
    ["GetFriendLogHistoryTableSize", () => rows([[data.friendLog.length]])],
    ["LookupFeed", (filters, _vipList, limit) => rows(data.feed.filter(typeFilter(texts(filters), 4)).slice(0, count(limit, 500)))],
    [
      "SearchFeed",
      (search, filters, _vipList, limit) =>
        rows(
          data.feed
            .filter(typeFilter(texts(filters), 4))
            .filter((row) => contains(row[3], text(search)))
            .slice(0, count(limit, 500))
        ),
    ],
    ["LookupGameLog", (filters, _vipList, limit) => rows(data.gameLog.filter(typeFilter(texts(filters), 2)).slice(0, count(limit, 500)))],
    [
      "SearchGameLog",
      (search, filters, _vipList, _userId, limit) =>
        rows(
          data.gameLog
            .filter(typeFilter(texts(filters), 2))
            .filter((row) => contains(row[3], text(search)) || contains(row[8], text(search)))
            .slice(0, count(limit, 500))
        ),
    ],
    ["GetNotifications", (limit) => rows(data.notifications.slice(0, count(limit, 500)))],
    [
      "LookupNotifications",
      (search, filters, _vipList, limit) =>
        rows(
          data.notifications
            .filter(typeFilter(texts(filters), 2))
            .filter((row) => text(search) === "" || contains(row[4], text(search)))
            .slice(0, count(limit, 500))
        ),
    ],
    ["GetNotificationsV2", (limit) => rows(data.notificationsV2.slice(0, count(limit, 500)))],
    ["GetMutualGraphFriends", () => rows(data.friends.map((friend) => [friend.id]))],
    ["GetMutualGraphLinks", () => rows(data.mutualLinks)],
    [
      "GetMutualCounts",
      () => {
        const counts = new Map<string, number>();
        for (const link of data.mutualLinks) {
          const id = text(link[1]);
          counts.set(id, (counts.get(id) ?? 0) + 1);
        }
        return rows([...counts.entries()]);
      },
    ],
    ["GetGpsTableSize", () => rows([[data.feed.filter((row) => row[4] === "GPS").length]])],
    ["GetOnlineOfflineTableSize", () => rows([[data.feed.filter((row) => row[4] === "Online" || row[4] === "Offline").length]])],
    ["GetJoinLeaveTableSize", () => rows([[data.gameLog.filter((row) => row[2] === "OnPlayerJoined" || row[2] === "OnPlayerLeft").length]])],
    ["GetNotificationTableSize", () => rows([[data.notifications.length]])],
  ];
  return new Map(handlers);
}

function nextInsertId(): () => number {
  let next = 5000000;
  return () => {
    next += 1;
    return next;
  };
}

export { createDatabaseHandlers, nextInsertId };
export type { Handler };
