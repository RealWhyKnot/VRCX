import type { Ref } from "vue";
import type { NotificationJson } from "./types";
import { notificationRequest } from "../../api/notification";
import { executeWithBackoff } from "../../shared/utils/retry";
import { isRateLimited, logError } from "./errors";

export type SeenQueueDeps = {
  notificationTable: Ref<{ data: { id?: string | undefined; version?: number | undefined }[] }>;
  unseenNotifications: Ref<string[]>;
  uiStore: { removeNotify: (name: string) => void };
  handleNotificationSee: (notificationId: string) => void;
  handleNotificationV2Update: (args: { params: { notificationId: string }; json: NotificationJson }) => void;
  handleNotificationV2Hide: (notificationId: string) => void;
};

export function createSeenQueue(deps: SeenQueueDeps) {
  const { notificationTable, unseenNotifications, uiStore, handleNotificationSee, handleNotificationV2Update, handleNotificationV2Hide } = deps;
  const seeQueue: { id: string; version: number }[] = [];
  const seenIds = new Set<string>();
  let isSeeProcessing = false;

  async function processSeeQueue() {
    if (isSeeProcessing) return;
    isSeeProcessing = true;
    let item = seeQueue.shift();
    while (item) {
      const { id, version } = item;
      try {
        await executeWithBackoff(
          async () => {
            if (version >= 2) {
              const args = await notificationRequest.seeNotificationV2({
                notificationId: id,
              });
              handleNotificationV2Update({
                params: { notificationId: id },
                json: { ...args.json, seen: true },
              });
            } else {
              await notificationRequest.seeNotification({
                notificationId: id,
              });
              handleNotificationSee(id);
            }
          },
          {
            maxRetries: 3,
            baseDelay: 1000,
            shouldRetry: isRateLimited,
          }
        );
      } catch (err) {
        console.warn("Failed to mark notification as seen:", id);
        if (isRateLimited(err)) {
          seenIds.delete(id);
        } else if (version >= 2) {
          handleNotificationV2Hide(id);
        }
      }
      item = seeQueue.shift();
    }
    isSeeProcessing = false;
  }

  function queueMarkAsSeen(notificationId: string, version = 1) {
    if (seenIds.has(notificationId)) return;
    seenIds.add(notificationId);
    seeQueue.push({ id: notificationId, version });
    void processSeeQueue().catch(logError);
  }

  function markAllAsSeen() {
    const unseenIds = [...unseenNotifications.value];
    for (const id of unseenIds) {
      const ref = notificationTable.value.data.find((n) => n.id === id);
      const version = ref?.version ?? 1;
      queueMarkAsSeen(id, version);
    }
    unseenNotifications.value = [];
    uiStore.removeNotify("notification");
  }

  return { queueMarkAsSeen, markAllAsSeen };
}
