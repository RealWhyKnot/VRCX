import type { CreateInstanceRequestRegion, InstanceType } from "vrchat";

import type { VrcxCreateInstanceRequest } from "../types/vrcx";
import type { CreateInstanceDialogOptions } from "./instance-types";
import { parseLocation } from "../shared/utils/location-parser";
import { hasGroupPermission } from "../shared/utils/group";
import { instanceRequest } from "../api/instance";
import { configRepository } from "../services/config";
import { groupAccessTypeOf } from "./instance-value-parsers";
import type { useUserStore } from "./user";

export type CreateInstanceCreateDeps = {
  userStore: ReturnType<typeof useUserStore>;
};

export function createInstanceCreate(deps: CreateInstanceCreateDeps) {
  const { userStore } = deps;

  async function getInstanceName(location: string) {
    let instanceName: string | null | undefined = "";

    const L = parseLocation(location);
    if (L.isRealInstance && L.worldId && L.instanceId) {
      try {
        const args = await instanceRequest.getInstance({
          worldId: L.worldId,
          instanceId: L.instanceId,
        });
        const ref = args.ref;
        if (ref === null) {
          throw new Error(`Instance record missing for ${location}`);
        }
        instanceName = ref.displayName;
      } catch (e) {
        console.error("getInstanceName failed location", location, e);
      }
    }

    return instanceName;
  }

  async function createNewInstance(worldId = "", options?: CreateInstanceDialogOptions) {
    const D: CreateInstanceDialogOptions = options ?? {
      loading: false,
      accessType: await configRepository.getString("instanceDialogAccessType", "public"),
      region: await configRepository.getString("instanceRegion", "US West"),
      worldId,
      groupId: await configRepository.getString("instanceDialogGroupId", ""),
      groupAccessType: await configRepository.getString("instanceDialogGroupAccessType", "plus"),
      ageGate: await configRepository.getBool("instanceDialogAgeGate", false),
      queueEnabled: await configRepository.getBool("instanceDialogQueueEnabled", true),
      roleIds: [],
      groupRef: {},
    };

    let type: InstanceType = "public";
    let canRequestInvite = false;
    switch (D.accessType) {
      case "friends":
        type = "friends";
        break;
      case "friends+":
        type = "hidden";
        break;
      case "invite":
        type = "private";
        break;
      case "invite+":
        type = "private";
        canRequestInvite = true;
        break;
      case "group":
        type = "group";
        break;
    }
    let region: CreateInstanceRequestRegion = "us";
    if (D.region === "US East") {
      region = "use";
    } else if (D.region === "Europe") {
      region = "eu";
    } else if (D.region === "Japan") {
      region = "jp";
    }
    const params: VrcxCreateInstanceRequest = {
      type,
      canRequestInvite,
      worldId: D.worldId,
      ownerId: userStore.currentUser.id,
      region,
    };
    if (type === "group") {
      const groupAccessType = groupAccessTypeOf(D.groupAccessType);
      if (groupAccessType) {
        params.groupAccessType = groupAccessType;
      }
      params.ownerId = D.groupId;
      params.queueEnabled = D.queueEnabled;
      if (D.groupAccessType === "members") {
        params.roleIds = D.roleIds;
      }
    }
    if (D.minimumAvatarPerformance) {
      params.minimumAvatarPerformance = D.minimumAvatarPerformance;
    }
    const canAgeGate =
      type === "group" ? hasGroupPermission(D.groupRef, "group-instance-age-gated-create") : userStore.currentUser.ageVerificationStatus === "18+";
    if (D.ageGate && canAgeGate) {
      params.ageGate = true;
    }
    if (D.displayName) {
      params.displayName = D.displayName;
    }
    if (D.description) {
      params.description = D.description;
    }
    if (D.languages?.length) {
      params.languages = D.languages;
    }
    if (D.categoryId) {
      params.categoryId = D.categoryId;
    }
    if (D.vibeIds?.length) {
      params.vibeIds = D.vibeIds;
    }
    try {
      const args = await instanceRequest.createInstance(params);
      return args;
    } catch (err) {
      console.error(err);
      return null;
    }
  }

  return {
    getInstanceName,
    createNewInstance,
  };
}
