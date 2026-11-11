import { useQuery } from "@tanstack/vue-query";

import { avatarRequest } from "../api/avatar";
import { groupRequest } from "../api/group";
import { userRequest } from "../api/user";
import { worldRequest } from "../api/world";
import { entityQueryPolicies, toQueryOptions } from "./policies";
import { queryKeys } from "./keys";

export function useUserQuery(userId: string) {
  return useQuery({
    queryKey: queryKeys.user(userId),
    queryFn: () => userRequest.getUser({ userId }),
    enabled: Boolean(userId),
    ...toQueryOptions(entityQueryPolicies.user),
  });
}

export function useAvatarQuery(avatarId: string) {
  return useQuery({
    queryKey: queryKeys.avatar(avatarId),
    queryFn: () => avatarRequest.getAvatar({ avatarId }),
    enabled: Boolean(avatarId),
    ...toQueryOptions(entityQueryPolicies.avatar),
  });
}

export function useWorldQuery(worldId: string) {
  return useQuery({
    queryKey: queryKeys.world(worldId),
    queryFn: () => worldRequest.getWorld({ worldId }),
    enabled: Boolean(worldId),
    ...toQueryOptions(entityQueryPolicies.world),
  });
}

export function useGroupQuery(groupId: string, shouldIncludeRoles = false) {
  return useQuery({
    queryKey: queryKeys.group(groupId, shouldIncludeRoles),
    queryFn: () => groupRequest.getGroup({ groupId, includeRoles: shouldIncludeRoles }),
    enabled: Boolean(groupId),
    ...toQueryOptions(entityQueryPolicies.group),
  });
}
