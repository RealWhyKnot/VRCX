import { toast } from "vue-sonner";
import type { useI18n } from "vue-i18n";

import { displayLocation, parseLocation } from "../shared/utils/location-parser";
import { getGroupName } from "../shared/utils/group";
import { getWorldName } from "../shared/utils/world";
import { instanceRequest } from "../api/instance";
import type { useNotificationStore } from "./notification";
import type { useUiStore } from "./ui";
import type { useSharedFeedStore } from "./shared-feed";
import type { QueuedInstance } from "./instance-types";

export type CreateInstanceQueueDeps = {
  notificationStore: ReturnType<typeof useNotificationStore>;
  uiStore: ReturnType<typeof useUiStore>;
  sharedFeedStore: ReturnType<typeof useSharedFeedStore>;
  cachedGroupOf: (groupId: string | null) => { name: string; iconUrl: string | undefined } | undefined;
  queuedInstances: Map<string, QueuedInstance>;
  t: ReturnType<typeof useI18n>["t"];
};

export function createInstanceQueue(deps: CreateInstanceQueueDeps) {
  const { notificationStore, uiStore, sharedFeedStore, cachedGroupOf, queuedInstances, t } = deps;

  function removeAllQueuedInstances() {
    queuedInstances.forEach((ref) => {
      toast.info(`Removed instance ${ref.$worldName} from queue`);
      toast.dismiss(ref.$msgBox ?? undefined);
    });
    queuedInstances.clear();
  }

  function removeQueuedInstance(instanceId: string) {
    const ref = queuedInstances.get(instanceId);
    if (typeof ref !== "undefined") {
      toast.dismiss(ref.$msgBox ?? undefined);
      queuedInstances.delete(instanceId);
    }
  }

  function applyQueuedInstance(instanceId: string) {
    queuedInstances.forEach((ref) => {
      if (ref.location !== instanceId) {
        toast.info(
          t("message.instance.removed_form_queue", {
            worldName: ref.$worldName,
          })
        );
        toast.dismiss(ref.$msgBox ?? undefined);
        queuedInstances.delete(ref.location);
      }
    });
    if (!instanceId) {
      return;
    }
    if (!queuedInstances.has(instanceId)) {
      const L = parseLocation(instanceId);
      if (L.isRealInstance) {
        instanceRequest
          .getInstance({
            worldId: L.worldId,
            instanceId: L.instanceId,
          })
          .then((args) => {
            const queueSize = args.json.queueSize;
            if (queueSize) {
              void instanceQueueUpdate(instanceId, queueSize, queueSize).catch((error: unknown) => {
                console.error("Error updating instance queue:", error);
              });
            }
          })
          .catch((error: unknown) => {
            console.error("Error fetching instance data for queue:", error);
          });
      }
      void instanceQueueUpdate(instanceId, 0, 0).catch((error: unknown) => {
        console.error("Error updating instance queue:", error);
      });
    }
  }

  function instanceQueueReady(instanceId: string) {
    const ref = queuedInstances.get(instanceId);
    if (typeof ref !== "undefined") {
      toast.dismiss(ref.$msgBox ?? undefined);
      queuedInstances.delete(instanceId);
    }
    const L = parseLocation(instanceId);
    const group = cachedGroupOf(L.groupId);
    const groupName = group?.name ?? "";
    const worldName = ref?.$worldName ?? "";
    const location = displayLocation(instanceId, worldName, groupName);
    toast.success(`Instance ready to join ${location}`);
    const noty = {
      created_at: new Date().toJSON(),
      type: "group.queueReady",
      ...(group?.iconUrl === undefined ? {} : { imageUrl: group.iconUrl }),
      message: `Instance ready to join ${location}`,
      location: instanceId,
      ...(L.groupId ? { senderUserId: L.groupId } : {}),
      groupName,
      worldName,
    };
    if (notificationStore.notificationTable.filters[0].value.length === 0 || notificationStore.notificationTable.filters[0].value.includes(noty.type)) {
      uiStore.notifyMenu("notification");
    }
    notificationStore.queueNotificationNoty(noty);
    void sharedFeedStore.addEntry(noty).catch((error: unknown) => {
      console.error("Error adding shared feed entry:", error);
    });
    const notificationRows: unknown[] = notificationStore.notificationTable.data;
    notificationRows.push(noty);
  }

  async function instanceQueueUpdate(instanceId: string, position: number, queueSize: number) {
    let ref = queuedInstances.get(instanceId);
    if (typeof ref === "undefined") {
      ref = {
        $msgBox: null,
        $groupName: "",
        $worldName: "",
        location: instanceId,
        position: 0,
        queueSize: 0,
        updatedAt: 0,
      };
    }
    ref.position = position;
    ref.queueSize = queueSize;
    ref.updatedAt = Date.now();
    if (!ref.$groupName) {
      ref.$groupName = await getGroupName(instanceId);
    }
    if (!ref.$worldName) {
      ref.$worldName = await getWorldName(instanceId);
    }
    const location = displayLocation(instanceId, ref.$worldName, ref.$groupName);
    toast.dismiss(ref.$msgBox ?? undefined);
    ref.$msgBox = toast.info(`You are in position ${ref.position} of ${ref.queueSize} in the queue for ${location} `, {
      duration: Infinity,
      position: "bottom-right",
      closeButton: true,
      class: "vrc-instance-queue-message",
    });
    queuedInstances.set(instanceId, ref);
  }

  return {
    removeAllQueuedInstances,
    removeQueuedInstance,
    applyQueuedInstance,
    instanceQueueReady,
    instanceQueueUpdate,
  };
}
