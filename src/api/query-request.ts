import type { QueryKey } from "@tanstack/vue-query";

import { entityQueryPolicies } from "../queries/policies";
import { fetchWithEntityPolicy } from "../queries/entity-cache";
import { queryKeys } from "../queries/keys";

import { avatarRequest } from "./avatar";
import { favoriteRequest } from "./favorite";

import { groupRequest } from "./group";
import { instanceRequest } from "./instance";
import { inventoryRequest } from "./inventory";
import { marketplaceRequest } from "./marketplace";
import { miscRequest } from "./misc";
import { userRequest } from "./user";

import { worldRequest } from "./world";

type EntityQueryPolicy = Parameters<typeof fetchWithEntityPolicy<unknown>>[0]["policy"];

type RequestFn = (...args: never[]) => Promise<unknown>;

type Definition<F extends RequestFn> = {
  params: Parameters<F>[0];
  response: Awaited<ReturnType<F>>;
};

type NoArgDefinition<F extends RequestFn> = {
  params: undefined;
  response: Awaited<ReturnType<F>>;
};

type QueryDefinitions = {
  user: Definition<typeof userRequest.getUser>;
  "user.dialog": Definition<typeof userRequest.getUser>;
  "user.force": Definition<typeof userRequest.getUser>;
  publicProfile: Definition<typeof userRequest.getPublicProfile>;
  avatar: Definition<typeof avatarRequest.getAvatar>;
  "avatar.dialog": Definition<typeof avatarRequest.getAvatar>;
  world: Definition<typeof worldRequest.getWorld>;
  "world.dialog": Definition<typeof worldRequest.getWorld>;
  "world.location": Definition<typeof worldRequest.getWorld>;
  "world.force": Definition<typeof worldRequest.getWorld>;
  worldsByUser: {
    params: NonNullable<Parameters<typeof worldRequest.getWorlds>[0]> & { userId: string; option?: string | null };
    response: Awaited<ReturnType<typeof worldRequest.getWorlds>>;
  };
  group: Definition<typeof groupRequest.getGroup>;
  "group.dialog": Definition<typeof groupRequest.getGroup>;
  "group.force": Definition<typeof groupRequest.getGroup>;
  groupMember: Definition<typeof groupRequest.getGroupMember>;
  groupMembers: Definition<typeof groupRequest.getGroupMembers>;
  groupGallery: Definition<typeof groupRequest.getGroupGallery>;
  groupCalendar: {
    params: { groupId: string };
    response: Awaited<ReturnType<typeof groupRequest.getGroupCalendar>>;
  };
  groupCalendarEvent: Definition<typeof groupRequest.getGroupCalendarEvent>;
  avatarGallery: {
    params: { avatarId: string };
    response: Awaited<ReturnType<typeof avatarRequest.getAvatarGallery>>;
  };
  "avatarGallery.force": {
    params: { avatarId: string };
    response: Awaited<ReturnType<typeof avatarRequest.getAvatarGallery>>;
  };
  favoriteLimits: NoArgDefinition<typeof favoriteRequest.getFavoriteLimits>;
  userInventoryItem: Definition<typeof inventoryRequest.getUserInventoryItem>;
  fileAnalysis: Definition<typeof miscRequest.getFileAnalysis>;
  worldPersistData: Definition<typeof miscRequest.hasWorldPersistData>;
  mutualCounts: Definition<typeof userRequest.getMutualCounts>;
  visits: NoArgDefinition<typeof miscRequest.getVisits>;
  instanceCount: NoArgDefinition<typeof instanceRequest.getInstanceCount>;
  file: Definition<typeof miscRequest.getFile>;
  avatarStyles: NoArgDefinition<typeof avatarRequest.getAvailableAvatarStyles>;
  representedGroup: Definition<typeof groupRequest.getRepresentedGroup>;
  vrchatCredits: NoArgDefinition<typeof marketplaceRequest.getVRChatCredits>;
};

type QueryResource = keyof QueryDefinitions;

type FetchArgs<K extends QueryResource> = QueryDefinitions[K]["params"] extends undefined ? [params?: undefined] : [params: QueryDefinitions[K]["params"]];

type QueryEntry<P, R> = {
  key: (params: P) => QueryKey;
  policy: EntityQueryPolicy;
  queryFn: (params: P) => Promise<R>;
};

type QueryRegistry = {
  [K in QueryResource]: QueryEntry<QueryDefinitions[K]["params"], QueryDefinitions[K]["response"]>;
};

const registry: QueryRegistry = Object.freeze({
  user: {
    key: (params) => queryKeys.user(params.userId),
    policy: entityQueryPolicies.user,
    queryFn: (params) => userRequest.getUser(params),
  },
  "user.dialog": {
    key: (params) => queryKeys.user(params.userId),
    policy: Object.freeze({
      ...entityQueryPolicies.user,
      staleTime: 60_000,
    }),
    queryFn: (params) => userRequest.getUser(params),
  },
  "user.force": {
    key: (params) => queryKeys.user(params.userId),
    policy: Object.freeze({
      ...entityQueryPolicies.user,
      staleTime: 0,
    }),
    queryFn: (params) => userRequest.getUser(params),
  },
  publicProfile: {
    key: (params) => queryKeys.profile(params.userId),
    policy: entityQueryPolicies.profile,
    queryFn: (params) => userRequest.getPublicProfile(params),
  },
  avatar: {
    key: (params) => queryKeys.avatar(params.avatarId),
    policy: entityQueryPolicies.avatar,
    queryFn: (params) => avatarRequest.getAvatar(params),
  },
  "avatar.dialog": {
    key: (params) => queryKeys.avatar(params.avatarId),
    policy: Object.freeze({
      ...entityQueryPolicies.avatar,
      staleTime: 120_000,
    }),
    queryFn: (params) => avatarRequest.getAvatar(params),
  },
  world: {
    key: (params) => queryKeys.world(params.worldId),
    policy: entityQueryPolicies.world,
    queryFn: (params) => worldRequest.getWorld(params),
  },
  "world.dialog": {
    key: (params) => queryKeys.world(params.worldId),
    policy: Object.freeze({
      ...entityQueryPolicies.world,
      staleTime: 120_000,
    }),
    queryFn: (params) => worldRequest.getWorld(params),
  },
  "world.location": {
    key: (params) => queryKeys.world(params.worldId),
    policy: Object.freeze({
      ...entityQueryPolicies.world,
      staleTime: 120_000,
    }),
    queryFn: (params) => worldRequest.getWorld(params),
  },
  "world.force": {
    key: (params) => queryKeys.world(params.worldId),
    policy: Object.freeze({
      ...entityQueryPolicies.world,
      staleTime: 0,
    }),
    queryFn: (params) => worldRequest.getWorld(params),
  },
  worldsByUser: {
    key: (params) => queryKeys.worldsByUser(params),
    policy: entityQueryPolicies.worldCollection,
    queryFn: (params) => {
      const option = params.option ?? "";
      return worldRequest.getWorlds(params, option === "" ? undefined : option);
    },
  },
  group: {
    key: (params) => queryKeys.group(params.groupId, params.includeRoles),
    policy: entityQueryPolicies.group,
    queryFn: (params) => groupRequest.getGroup(params),
  },
  "group.dialog": {
    key: (params) => queryKeys.group(params.groupId, params.includeRoles),
    policy: Object.freeze({
      ...entityQueryPolicies.group,
      staleTime: 120_000,
    }),
    queryFn: (params) => groupRequest.getGroup(params),
  },
  "group.force": {
    key: (params) => queryKeys.group(params.groupId, params.includeRoles),
    policy: Object.freeze({
      ...entityQueryPolicies.group,
      staleTime: 0,
    }),
    queryFn: (params) => groupRequest.getGroup(params),
  },
  groupMember: {
    key: (params) => queryKeys.groupMember(params),
    policy: entityQueryPolicies.groupCollection,
    queryFn: (params) => groupRequest.getGroupMember(params),
  },
  groupMembers: {
    key: (params) => queryKeys.groupMembers(params),
    policy: entityQueryPolicies.groupCollection,
    queryFn: (params) => groupRequest.getGroupMembers(params),
  },
  groupGallery: {
    key: (params) => queryKeys.groupGallery(params),
    policy: entityQueryPolicies.groupCollection,
    queryFn: (params) => groupRequest.getGroupGallery(params),
  },
  groupCalendar: {
    key: (params) => queryKeys.groupCalendar(params.groupId),
    policy: entityQueryPolicies.groupCollection,
    queryFn: (params) => groupRequest.getGroupCalendar(params.groupId),
  },
  groupCalendarEvent: {
    key: (params) => queryKeys.groupCalendarEvent(params),
    policy: entityQueryPolicies.groupCalendarEvent,
    queryFn: (params) => groupRequest.getGroupCalendarEvent(params),
  },
  avatarGallery: {
    key: (params) => queryKeys.avatarGallery(params.avatarId),
    policy: entityQueryPolicies.avatarGallery,
    queryFn: (params) => avatarRequest.getAvatarGallery(params.avatarId),
  },
  "avatarGallery.force": {
    key: (params) => queryKeys.avatarGallery(params.avatarId),
    policy: Object.freeze({
      ...entityQueryPolicies.avatarGallery,
      staleTime: 0,
    }),
    queryFn: (params) => avatarRequest.getAvatarGallery(params.avatarId),
  },
  favoriteLimits: {
    key: () => queryKeys.favoriteLimits(),
    policy: entityQueryPolicies.favoriteLimits,
    queryFn: () => favoriteRequest.getFavoriteLimits(),
  },
  userInventoryItem: {
    key: (params) => queryKeys.userInventoryItem(params),
    policy: entityQueryPolicies.inventoryCollection,
    queryFn: (params) => inventoryRequest.getUserInventoryItem(params),
  },
  fileAnalysis: {
    key: (params) => queryKeys.fileAnalysis(params),
    policy: entityQueryPolicies.fileAnalysis,
    queryFn: (params) => miscRequest.getFileAnalysis(params),
  },
  worldPersistData: {
    key: (params) => queryKeys.worldPersistData(params.worldId),
    policy: entityQueryPolicies.worldPersistData,
    queryFn: (params) => miscRequest.hasWorldPersistData(params),
  },
  mutualCounts: {
    key: (params) => queryKeys.mutualCounts(params.userId),
    policy: entityQueryPolicies.mutualCounts,
    queryFn: (params) => userRequest.getMutualCounts(params),
  },
  visits: {
    key: () => queryKeys.visits(),
    policy: entityQueryPolicies.visits,
    queryFn: () => miscRequest.getVisits(),
  },
  instanceCount: {
    key: () => queryKeys.instanceCount(),
    policy: entityQueryPolicies.instanceCount,
    queryFn: () => instanceRequest.getInstanceCount(),
  },
  file: {
    key: (params) => queryKeys.file(params.fileId),
    policy: entityQueryPolicies.fileObject,
    queryFn: (params) => miscRequest.getFile(params),
  },
  avatarStyles: {
    key: () => queryKeys.avatarStyles(),
    policy: entityQueryPolicies.avatarStyles,
    queryFn: () => avatarRequest.getAvailableAvatarStyles(),
  },
  representedGroup: {
    key: (params) => queryKeys.representedGroup(params.userId),
    policy: entityQueryPolicies.representedGroup,
    queryFn: (params) => groupRequest.getRepresentedGroup(params),
  },
  vrchatCredits: {
    key: () => queryKeys.vrchatCredits(),
    policy: entityQueryPolicies.vrchatCredits,
    queryFn: () => marketplaceRequest.getVRChatCredits(),
  },
});

const queryRequest = {
  async fetch<K extends QueryResource>(resource: K, ...args: FetchArgs<K>): Promise<QueryDefinitions[K]["response"] & { cache: boolean }> {
    if (!Object.hasOwn(registry, resource)) {
      throw new Error(`Unknown query resource: ${resource}`);
    }
    const entry = registry[resource];
    const params: QueryDefinitions[K]["params"] = args[0];

    const { data, cache } = await fetchWithEntityPolicy({
      queryKey: entry.key(params),
      policy: entry.policy,
      queryFn: () => entry.queryFn(params),
      label: resource,
    });

    return {
      ...data,
      cache,
    };
  },
};

export { queryRequest };
