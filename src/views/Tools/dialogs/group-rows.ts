import type { Group } from "vrchat";

import type { groupRequest } from "../../../api/group";
import type { Json } from "../../../types/vrcx";

export type GroupRow = Json<Group> & { id: string };

export type GroupMembershipStatus = Parameters<typeof groupRequest.getMyGroupsByStatus>[0]["membershipStatus"];

export function hasGroupId(group: Json<Group>): group is GroupRow {
  return group.id !== undefined;
}
