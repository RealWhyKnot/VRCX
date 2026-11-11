import type { Instance, InstanceShortNameResponse, SentNotification } from "vrchat";
import type { InstanceCategory, InstanceCount, InstanceVibe, Json, RequestOptions, VrcxCreateInstanceRequest, VrcxUpdateInstanceRequest } from "../types/vrcx";
import { toast } from "vue-sonner";

import { i18n } from "../plugins/i18n";
import { request } from "../services/request";
import { useInstanceStore } from "../stores/instance";
import { toInstanceRecord } from "../shared/utils/instance-transforms";

type InstanceRef = ReturnType<ReturnType<typeof useInstanceStore>["applyInstance"]>;

function requestObject<T extends object>(endpoint: string, options: RequestOptions): Promise<T> {
  const isResponseObject = (value: unknown): value is T => typeof value === "object" && value !== null;
  return request(endpoint, options).then((response) => {
    if (!isResponseObject(response)) {
      throw new Error(`Instance response is not an object: ${endpoint}`);
    }
    return response;
  });
}

function apiErrorMessage(err: unknown): string | undefined {
  if (typeof err !== "object" || err === null || !("error" in err)) {
    return undefined;
  }
  const { error } = err;
  if (typeof error !== "object" || error === null || !("message" in error)) {
    return undefined;
  }
  return typeof error.message === "string" && error.message.length > 0 ? error.message : undefined;
}

const instanceRequest = {
  getInstance(params: {
    worldId: string;
    instanceId: string;
  }): Promise<{ json: Json<Instance>; ref: InstanceRef; params: { worldId: string; instanceId: string } }> {
    const instanceStore = useInstanceStore();
    return requestObject<Json<Instance>>(`instances/${params.worldId}:${params.instanceId}`, {
      method: "GET",
    }).then((json) => {
      return {
        json,
        params,
        ref: instanceStore.applyInstance(toInstanceRecord(json)),
      };
    });
  },

  createInstance(params: VrcxCreateInstanceRequest): Promise<{ json: Json<Instance>; params: VrcxCreateInstanceRequest; ref: InstanceRef }> {
    const instanceStore = useInstanceStore();
    return requestObject<Json<Instance>>("instances", {
      method: "POST",
      params,
    }).then((json) => {
      const args = {
        json,
        params,
        ref: instanceStore.applyInstance(toInstanceRecord(json)),
      };
      return args;
    });
  },

  getInstanceShortName(instance: { worldId: string; instanceId: string; shortName?: string }): Promise<{
    json: Json<InstanceShortNameResponse>;
    instance: { worldId: string; instanceId: string };
    params?: { shortName?: string };
  }> {
    const params: { shortName?: string } = {};
    if (instance.shortName) {
      params.shortName = instance.shortName;
    }
    return requestObject<Json<InstanceShortNameResponse>>(`instances/${instance.worldId}:${instance.instanceId}/shortName`, {
      method: "GET",
      params,
    }).then((json) => {
      const args = {
        json,
        instance,
        params,
      };
      return args;
    });
  },

  getInstanceFromShortName(params: { shortName: string }): Promise<{ json: Json<Instance>; params: { shortName: string }; ref: InstanceRef }> {
    const instanceStore = useInstanceStore();
    return requestObject<Json<Instance>>(`instances/s/${params.shortName}`, {
      method: "GET",
    }).then((json) => {
      const args = {
        json,
        params,
        ref: instanceStore.applyInstance(toInstanceRecord(json)),
      };
      return args;
    });
  },

  selfInvite(instance: { worldId: string; instanceId: string; shortName?: string }): Promise<{
    instance: { worldId: string; instanceId: string; shortName?: string };
    json: Json<SentNotification>;
    params: { shortName?: string };
  }> {
    const params: { shortName?: string } = {};
    if (instance.shortName) {
      params.shortName = instance.shortName;
    }
    return requestObject<Json<SentNotification>>(`invite/myself/to/${instance.worldId}:${instance.instanceId}`, {
      method: "POST",
      params,
    })
      .then((json) => {
        return {
          json,
          instance,
          params,
        };
      })
      .catch((err: unknown) => {
        const message = apiErrorMessage(err);
        if (message) {
          toast.error(message);
          throw err;
        }
        toast.error(i18n.global.t("message.instance.not_allowed"));
        throw err;
      });
  },

  getInstanceCount(): Promise<{ json: InstanceCount }> {
    return requestObject<InstanceCount>("instances/count", {
      method: "GET",
    }).then((json) => {
      return {
        json,
      };
    });
  },

  updateInstance(params: VrcxUpdateInstanceRequest): Promise<{ json: Json<Instance>; params: VrcxUpdateInstanceRequest; ref: InstanceRef }> {
    const instanceStore = useInstanceStore();
    const { location, ...body } = params;
    return requestObject<Json<Instance>>(`instances/${location}`, {
      method: "PUT",
      params: body,
    }).then((json) => {
      return {
        json,
        params,
        ref: instanceStore.applyInstance(toInstanceRecord(json)),
      };
    });
  },

  instanceAnnouncement(params: {
    location: string;
    title: string;
    message: string;
    imageId?: string | undefined;
    imageVersion?: string | number | undefined;
  }): Promise<{
    json: unknown;
    params: { location: string; title: string; message: string; imageId?: string | undefined; imageVersion?: string | number | undefined };
  }> {
    return request(`instances/${params.location}/announce`, {
      method: "POST",
      params,
    }).then((json) => {
      return {
        json,
        params,
      };
    });
  },

  getInstanceCategories(): Promise<{ json: InstanceCategory[] }> {
    return requestObject<InstanceCategory[]>("instanceCategories", {
      method: "GET",
    }).then((json) => {
      return {
        json,
      };
    });
  },

  getInstanceVibes(): Promise<{ json: InstanceVibe[] }> {
    return requestObject<InstanceVibe[]>("instanceVibes", {
      method: "GET",
    }).then((json) => {
      return {
        json,
      };
    });
  },
};

export { instanceRequest };
