import { isRealInstance } from "../shared/utils/instance";

export const DIALOG_INSTANCE_STALE_MS = 60_000;

type FetchInstance = (params: { worldId: string; instanceId: string }) => Promise<unknown>;

export function createStaleInstanceRefresher(fetchInstance: FetchInstance) {
  const attemptedAtByTag = new Map<string, number>();

  function forgetOldAttempts(now: number) {
    for (const [tag, attemptedAt] of attemptedAtByTag) {
      if (now - attemptedAt >= DIALOG_INSTANCE_STALE_MS) {
        attemptedAtByTag.delete(tag);
      }
    }
  }

  return function refreshStaleInstance(tag: string, fetchedAtText: string | undefined, worldId: string, instanceId: string) {
    if (!isRealInstance(tag)) {
      return;
    }
    const now = Date.now();
    const fetchedAt = Date.parse(fetchedAtText ?? "") || 0;
    const attemptedAt = attemptedAtByTag.get(tag) ?? 0;
    if (now - Math.max(fetchedAt, attemptedAt) < DIALOG_INSTANCE_STALE_MS) {
      return;
    }
    forgetOldAttempts(now);
    attemptedAtByTag.set(tag, now);
    fetchInstance({ worldId, instanceId }).catch((error: unknown) => {
      console.error("Error fetching instance for room:", error);
    });
  };
}
