import { sortStatus } from "./friend";

function compareByName(a, b) {
  if (typeof a.name !== "string" || typeof b.name !== "string") {
    return 0;
  }
  return a.name.localeCompare(b.name);
}

function compareByCreatedAt(a, b) {
  if (typeof a.created_at !== "string" || typeof b.created_at !== "string") {
    return 0;
  }
  const A = a.created_at.toUpperCase();
  const B = b.created_at.toUpperCase();
  if (A < B) {
    return 1;
  }
  if (A > B) {
    return -1;
  }
  return 0;
}

function compareByCreatedAtAscending(a, b) {
  const A = a.created_at;
  const B = b.created_at;
  if (A < B) {
    return -1;
  }
  if (A > B) {
    return 1;
  }
  return 0;
}

function compareByUpdatedAt(a, b) {
  if (typeof a.updated_at !== "string" || typeof b.updated_at !== "string") {
    return 0;
  }
  const A = a.updated_at.toUpperCase();
  const B = b.updated_at.toUpperCase();
  if (A < B) {
    return 1;
  }
  if (A > B) {
    return -1;
  }
  return 0;
}

function compareByDisplayName(a, b) {
  if (typeof a.displayName !== "string" || typeof b.displayName !== "string") {
    return 0;
  }
  return a.displayName.localeCompare(b.displayName);
}

function compareById(a, b) {
  if (typeof a.id !== "string" || typeof b.id !== "string") {
    return 0;
  }
  return a.id.localeCompare(b.id);
}

function compareByMemberCount(a, b) {
  if (typeof a.memberCount !== "number" || typeof b.memberCount !== "number") {
    return 0;
  }
  return a.memberCount - b.memberCount;
}

function compareByPrivate(a, b) {
  if (typeof a.ref === "undefined" || typeof b.ref === "undefined") {
    return 0;
  }
  if (a.ref.location === "private" && b.ref.location === "private") {
    return 0;
  } else if (a.ref.location === "private") {
    return 1;
  } else if (b.ref.location === "private") {
    return -1;
  }
  return 0;
}

function compareByStatus(a, b) {
  if (typeof a.ref === "undefined" || typeof b.ref === "undefined") {
    return 0;
  }
  if (a.ref.status === b.ref.status) {
    return 0;
  }
  if (a.ref.state === "offline") {
    return 1;
  }
  return sortStatus(a.ref.status, b.ref.status);
}

function compareByLastActive(a, b) {
  if (a.state === "online" && b.state === "online") {
    if (a.ref?.$online_for && b.ref?.$online_for && a.ref.$online_for === b.ref.$online_for) {
      return compareByActivityField(a, b, "last_login");
    }
    return compareByActivityField(a, b, "$online_for");
  }

  return compareByActivityField(a, b, "last_activity");
}

function compareByLastActiveRef(a, b) {
  if (a.state === "online" && b.state === "online") {
    if (a.$online_for && b.$online_for && a.$online_for === b.$online_for) {
      return a.last_login < b.last_login ? 1 : -1;
    }
    return a.$online_for < b.$online_for ? 1 : -1;
  }
  return a.last_activity < b.last_activity ? 1 : -1;
}

function compareByLastSeen(a, b) {
  return compareByActivityField(a, b, "$lastSeen");
}

function compareByActivityField(a, b, field) {
  if (typeof a.ref === "undefined" || typeof b.ref === "undefined") {
    return 0;
  }

  if (a.ref[field] < b.ref[field] || (a.ref[field] !== "" && b.ref[field] === "")) {
    return 1;
  }
  if (a.ref[field] > b.ref[field] || (a.ref[field] === "" && b.ref[field] !== "")) {
    return -1;
  }
  return 0;
}

function compareByTimeInInstance(a, b) {
  if (!a.ref || !b.ref) {
    return 0;
  }

  if (a.pendingOffline && !b.pendingOffline) {
    return 1;
  }
  if (!a.pendingOffline && b.pendingOffline) {
    return -1;
  }

  return b.ref.$location_at - a.ref.$location_at;
}

function compareByLocationAt(a, b) {
  if (a.location === "traveling" && b.location === "traveling") {
    return 0;
  }
  if (a.location === "traveling") {
    return 1;
  }
  if (b.location === "traveling") {
    return -1;
  }
  if (a.$location_at < b.$location_at) {
    return -1;
  }
  if (a.$location_at > b.$location_at) {
    return 1;
  }
  return 0;
}

function compareByLocation(a, b) {
  if (typeof a.ref === "undefined" || typeof b.ref === "undefined") {
    return 0;
  }
  if (a.state !== "online" || b.state !== "online") {
    return 0;
  }

  return a.ref.location.localeCompare(b.ref.location);
}

function compareByFriendOrder(a, b) {
  if (typeof a === "undefined" || typeof b === "undefined") {
    return 0;
  }
  return b.$friendNumber - a.$friendNumber;
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
