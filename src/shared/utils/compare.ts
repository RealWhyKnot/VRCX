import { sortStatus } from "./friend";

type Row = Record<string, unknown>;

function isRow(value: unknown): value is Row {
  return typeof value === "object" && value !== null;
}

function rowOf(value: unknown): Row {
  if (!isRow(value)) {
    throw new TypeError("Cannot compare a value that is not an object");
  }
  return value;
}

function refOf(value: unknown): Row | undefined {
  const ref = rowOf(value)["ref"];
  return isRow(ref) ? ref : undefined;
}

function isLessThan(a: unknown, b: unknown): boolean {
  if (typeof a === "string" && typeof b === "string") {
    return a < b;
  }
  return Number(a) < Number(b);
}

function compareUpperCaseDescending(a: string, b: string): number {
  const upperA = a.toUpperCase();
  const upperB = b.toUpperCase();
  if (upperA < upperB) {
    return 1;
  }
  if (upperA > upperB) {
    return -1;
  }
  return 0;
}

function compareByName(a: unknown, b: unknown): number {
  const aName = rowOf(a)["name"];
  const bName = rowOf(b)["name"];
  if (typeof aName !== "string" || typeof bName !== "string") {
    return 0;
  }
  return aName.localeCompare(bName);
}

function compareByCreatedAt(a: unknown, b: unknown): number {
  const aCreatedAt = rowOf(a)["created_at"];
  const bCreatedAt = rowOf(b)["created_at"];
  if (typeof aCreatedAt !== "string" || typeof bCreatedAt !== "string") {
    return 0;
  }
  return compareUpperCaseDescending(aCreatedAt, bCreatedAt);
}

function compareByCreatedAtAscending(a: unknown, b: unknown): number {
  const aCreatedAt = rowOf(a)["created_at"];
  const bCreatedAt = rowOf(b)["created_at"];
  if (isLessThan(aCreatedAt, bCreatedAt)) {
    return -1;
  }
  if (isLessThan(bCreatedAt, aCreatedAt)) {
    return 1;
  }
  return 0;
}

function compareByUpdatedAt(a: unknown, b: unknown): number {
  const aUpdatedAt = rowOf(a)["updated_at"];
  const bUpdatedAt = rowOf(b)["updated_at"];
  if (typeof aUpdatedAt !== "string" || typeof bUpdatedAt !== "string") {
    return 0;
  }
  return compareUpperCaseDescending(aUpdatedAt, bUpdatedAt);
}

function compareByDisplayName(a: unknown, b: unknown): number {
  const aDisplayName = rowOf(a)["displayName"];
  const bDisplayName = rowOf(b)["displayName"];
  if (typeof aDisplayName !== "string" || typeof bDisplayName !== "string") {
    return 0;
  }
  return aDisplayName.localeCompare(bDisplayName);
}

function compareById(a: unknown, b: unknown): number {
  const aId = rowOf(a)["id"];
  const bId = rowOf(b)["id"];
  if (typeof aId !== "string" || typeof bId !== "string") {
    return 0;
  }
  return aId.localeCompare(bId);
}

function compareByMemberCount(a: unknown, b: unknown): number {
  const aMemberCount = rowOf(a)["memberCount"];
  const bMemberCount = rowOf(b)["memberCount"];
  if (typeof aMemberCount !== "number" || typeof bMemberCount !== "number") {
    return 0;
  }
  return aMemberCount - bMemberCount;
}

function compareByPrivate(a: unknown, b: unknown): number {
  const aRef = refOf(a);
  const bRef = refOf(b);
  if (aRef === undefined || bRef === undefined) {
    return 0;
  }
  if (aRef["location"] === "private" && bRef["location"] === "private") {
    return 0;
  } else if (aRef["location"] === "private") {
    return 1;
  } else if (bRef["location"] === "private") {
    return -1;
  }
  return 0;
}

function compareByStatus(a: unknown, b: unknown): number {
  const aRef = refOf(a);
  const bRef = refOf(b);
  if (aRef === undefined || bRef === undefined) {
    return 0;
  }
  if (aRef["status"] === bRef["status"]) {
    return 0;
  }
  if (aRef["state"] === "offline") {
    return 1;
  }
  return sortStatus(aRef["status"], bRef["status"]);
}

function onlineForOf(value: unknown): unknown {
  return refOf(value)?.["$online_for"];
}

function compareByLastActive(a: unknown, b: unknown): number {
  const aRow = rowOf(a);
  const bRow = rowOf(b);
  if (aRow["state"] === "online" && bRow["state"] === "online") {
    const aOnlineFor = onlineForOf(a);
    const bOnlineFor = onlineForOf(b);
    if (aOnlineFor && bOnlineFor && aOnlineFor === bOnlineFor) {
      return compareByActivityField(a, b, "last_login");
    }
    return compareByActivityField(a, b, "$online_for");
  }

  return compareByActivityField(a, b, "last_activity");
}

function compareByLastActiveRef(a: unknown, b: unknown): number {
  const aRow = rowOf(a);
  const bRow = rowOf(b);
  if (aRow["state"] === "online" && bRow["state"] === "online") {
    if (aRow["$online_for"] && bRow["$online_for"] && aRow["$online_for"] === bRow["$online_for"]) {
      return isLessThan(aRow["last_login"], bRow["last_login"]) ? 1 : -1;
    }
    return isLessThan(aRow["$online_for"], bRow["$online_for"]) ? 1 : -1;
  }
  return isLessThan(aRow["last_activity"], bRow["last_activity"]) ? 1 : -1;
}

function compareByLastSeen(a: unknown, b: unknown): number {
  return compareByActivityField(a, b, "$lastSeen");
}

function compareByActivityField(a: unknown, b: unknown, field: string): number {
  const aRef = refOf(a);
  if (aRef === undefined) {
    return 0;
  }
  const bRef = refOf(b);
  if (bRef === undefined) {
    return 0;
  }

  const aValue = aRef[field];
  const bValue = bRef[field];
  if (isLessThan(aValue, bValue) || (aValue !== "" && bValue === "")) {
    return 1;
  }
  if (isLessThan(bValue, aValue) || (aValue === "" && bValue !== "")) {
    return -1;
  }
  return 0;
}

function compareByTimeInInstance(a: unknown, b: unknown): number {
  const aRef = refOf(a);
  const bRef = refOf(b);
  if (aRef === undefined || bRef === undefined) {
    return 0;
  }

  const aPendingOffline = rowOf(a)["pendingOffline"];
  const bPendingOffline = rowOf(b)["pendingOffline"];
  if (aPendingOffline && !bPendingOffline) {
    return 1;
  }
  if (!aPendingOffline && bPendingOffline) {
    return -1;
  }

  return Number(bRef["$location_at"]) - Number(aRef["$location_at"]);
}

function compareByLocationAt(a: unknown, b: unknown): number {
  const aRow = rowOf(a);
  const bRow = rowOf(b);
  if (aRow["location"] === "traveling" && bRow["location"] === "traveling") {
    return 0;
  }
  if (aRow["location"] === "traveling") {
    return 1;
  }
  if (bRow["location"] === "traveling") {
    return -1;
  }
  if (isLessThan(aRow["$location_at"], bRow["$location_at"])) {
    return -1;
  }
  if (isLessThan(bRow["$location_at"], aRow["$location_at"])) {
    return 1;
  }
  return 0;
}

function compareByLocation(a: unknown, b: unknown): number {
  const aRef = refOf(a);
  const bRef = refOf(b);
  if (aRef === undefined || bRef === undefined) {
    return 0;
  }
  if (rowOf(a)["state"] !== "online" || rowOf(b)["state"] !== "online") {
    return 0;
  }

  const aLocation = aRef["location"];
  const bLocation = bRef["location"];
  if (typeof aLocation !== "string" || typeof bLocation !== "string") {
    throw new TypeError("Cannot compare locations that are not strings");
  }
  return aLocation.localeCompare(bLocation);
}

function compareByFriendOrder(a: unknown, b: unknown): number {
  if (typeof a === "undefined" || typeof b === "undefined") {
    return 0;
  }
  return Number(rowOf(b)["$friendNumber"]) - Number(rowOf(a)["$friendNumber"]);
}

export {
  compareByName,
  compareByCreatedAt,
  compareByCreatedAtAscending,
  compareByUpdatedAt,
  compareByDisplayName,
  compareById,
  compareByMemberCount,
  compareByPrivate,
  compareByStatus,
  compareByLastActive,
  compareByLastActiveRef,
  compareByLastSeen,
  compareByLocationAt,
  compareByLocation,
  compareByFriendOrder,
  compareByTimeInInstance,
};
