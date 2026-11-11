import type { VrcxUser } from "../types/vrcx";
import type { InstanceRoom, NamedRefTarget, UserRefTarget } from "./instance-types";
import { isRecord, isVrcxUser } from "./instance-type-guards";
import { textOf } from "./instance-value-parsers";

export function toUserRefTarget(source: Record<string, unknown>): UserRefTarget {
  return { id: textOf(source["id"]), displayName: textOf(source["displayName"]) };
}

export function toNamedRefTarget(source: Record<string, unknown>): NamedRefTarget {
  return { id: textOf(source["id"]), name: textOf(source["name"]) };
}

export function friendRefOf(friend: unknown): VrcxUser | undefined {
  const ref: unknown = isRecord(friend) ? friend["ref"] : undefined;
  return isVrcxUser(ref) ? ref : undefined;
}

export function friendLocationTagOf(friend: unknown): string | undefined {
  const location: unknown = isRecord(friend) ? friend["$location"] : undefined;
  if (!isRecord(location)) {
    return undefined;
  }
  const tag = location["tag"];
  return typeof tag === "string" ? tag : undefined;
}

export function newEmptyRoom(id: string, tag: string, shortName: string, ref: InstanceRoom["ref"]): InstanceRoom {
  return {
    id,
    tag,
    $location: {},
    friendCount: 0,
    users: [],
    shortName,
    ref,
  };
}

export function userCountOf(room: InstanceRoom): number {
  return room.ref.userCount ?? Number.NaN;
}
