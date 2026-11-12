import { extractFileId } from "./file-utils";

export type KnownUser = {
  id: string;
  name: string;
  iconUrl: string;
  ownedIconUrls: string[];
  location: string;
  isFriend: boolean;
};

export type InstanceFace =
  | { kind: "known"; key: string; userId: string; name: string; iconUrl: string; isFriend: boolean }
  | { kind: "unknown"; key: string; fileId: string; iconUrl: string; isFriend: boolean };

export type InstanceFaces = {
  faces: InstanceFace[];
  hiddenCount: number;
};

export type FaceSource = {
  location: string;
  userCount: number;
  friendIconUrls: string[];
  userIconUrls: string[];
};

export type FileOwner = { kind: "user"; userId: string } | { kind: "avatar" } | { kind: "unknown" };

export type FaceOwner = { kind: "user"; userId: string; name: string } | { kind: "avatar" };

export const MAX_FACES = 8;

const USER_UPLOAD_TAGS = ["icon", "gallery"] as const;
const AVATAR_FILE_PREFIX = "Avatar - ";

export function buildFaceIndex(users: Iterable<KnownUser>): Map<string, KnownUser> {
  const index = new Map<string, KnownUser>();
  for (const user of users) {
    for (const url of user.ownedIconUrls) {
      const fileId = extractFileId(url);
      const existing = index.get(fileId);
      if (fileId && (!existing || (user.isFriend && !existing.isFriend))) {
        index.set(fileId, user);
      }
    }
  }
  return index;
}

function knownFace(user: KnownUser, iconUrl: string): InstanceFace {
  return { kind: "known", key: user.id, userId: user.id, name: user.name, iconUrl: iconUrl || user.iconUrl, isFriend: user.isFriend };
}

function rank(face: InstanceFace): number {
  if (face.isFriend) {
    return face.kind === "known" ? 0 : 1;
  }
  return face.kind === "known" ? 2 : 3;
}

export function buildInstanceFaces(
  source: FaceSource,
  friendsHere: readonly KnownUser[],
  index: ReadonlyMap<string, KnownUser>,
  limit = MAX_FACES
): InstanceFaces {
  const faces: InstanceFace[] = [];
  const shownUsers = new Set<string>();
  const shownFiles = new Set<string>();
  const add = (user: KnownUser, iconUrl: string) => {
    if (!shownUsers.has(user.id)) {
      shownUsers.add(user.id);
      faces.push(knownFace(user, iconUrl));
    }
  };
  for (const friend of friendsHere) {
    add(friend, "");
    for (const url of friend.ownedIconUrls) {
      shownFiles.add(extractFileId(url));
    }
  }
  const lists: readonly (readonly [readonly string[], boolean])[] = [
    [source.friendIconUrls, true],
    [source.userIconUrls, false],
  ];
  for (const [urls, isFriendList] of lists) {
    for (const [position, url] of urls.entries()) {
      const fileId = extractFileId(url);
      const user = index.get(fileId);
      if (user) {
        add(user, url);
      } else if (fileId && !shownFiles.has(fileId)) {
        shownFiles.add(fileId);
        faces.push({ kind: "unknown", key: `${fileId}:${position}`, fileId, iconUrl: url, isFriend: isFriendList });
      }
    }
  }
  const ordered = faces.map((face, position) => ({ face, position })).sort((a, b) => rank(a.face) - rank(b.face) || a.position - b.position);
  const shown = ordered.slice(0, Math.max(0, limit)).map((entry) => entry.face);
  return { faces: shown, hiddenCount: Math.max(0, Math.max(source.userCount, faces.length) - shown.length) };
}

export function readFileUploader(file: unknown): string {
  if (typeof file !== "object" || file === null) {
    return "";
  }
  const ownerId: unknown = Reflect.get(file, "ownerId");
  return typeof ownerId === "string" && ownerId.startsWith("usr_") ? ownerId : "";
}

export function readFileOwner(file: unknown): FileOwner {
  if (typeof file !== "object" || file === null) {
    return { kind: "unknown" };
  }
  const ownerId: unknown = Reflect.get(file, "ownerId");
  const name: unknown = Reflect.get(file, "name");
  const tags: unknown = Reflect.get(file, "tags");
  if (typeof name === "string" && name.startsWith(AVATAR_FILE_PREFIX)) {
    return { kind: "avatar" };
  }
  const isUserUpload = Array.isArray(tags) && USER_UPLOAD_TAGS.some((tag) => tags.includes(tag));
  if (isUserUpload && typeof ownerId === "string" && ownerId.startsWith("usr_")) {
    return { kind: "user", userId: ownerId };
  }
  return { kind: "unknown" };
}

export type InstancePeopleSource = {
  userCount?: number | undefined;
  userIcons?: readonly string[] | undefined;
};

export function instanceFaceSource(location: string, instance: InstancePeopleSource | null | undefined): FaceSource {
  return {
    location,
    userCount: instance?.userCount ?? 0,
    friendIconUrls: [],
    userIconUrls: (instance?.userIcons ?? []).filter((url) => typeof url === "string" && url.startsWith("https://")),
  };
}

export function withoutFriends(result: InstanceFaces): InstanceFaces {
  return { faces: result.faces.filter((face) => !face.isFriend), hiddenCount: result.hiddenCount };
}
