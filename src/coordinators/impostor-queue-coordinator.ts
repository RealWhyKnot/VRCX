import { toast } from "vue-sonner";

import { avatarRequest } from "../api/avatar";
import { i18n } from "../plugins/i18n";
import { logError } from "../stores/vrcx-messages";

const MAX_WAIT_MINUTES = 60 * 24 * 7;

export function impostorWaitMinutes(stats: unknown): number {
  if (typeof stats !== "object" || stats === null || !("estimatedServiceDurationSeconds" in stats)) {
    return 0;
  }
  const seconds = stats.estimatedServiceDurationSeconds;
  if (typeof seconds !== "number" || !Number.isFinite(seconds) || seconds <= 0) {
    return 0;
  }
  return Math.min(MAX_WAIT_MINUTES, Math.ceil(seconds / 60));
}

export async function announceImpostorQueued(): Promise<void> {
  const t = i18n.global.t;
  let minutes = 0;
  try {
    minutes = impostorWaitMinutes(await avatarRequest.getImpostorQueueStats());
  } catch (err) {
    logError(err);
  }
  toast.success(minutes > 0 ? t("message.avatar.impostor_queued_wait", { minutes }) : t("message.avatar.impostor_queued"));
}
