import { computed, reactive, watch } from "vue";
import { defineStore } from "pinia";
import { toast } from "vue-sonner";
import { useI18n } from "vue-i18n";
import { useRouter } from "vue-router";
import type { MutualFriend } from "vrchat";

import { createRateLimiter } from "../shared/utils/throttle";
import { executeWithBackoff } from "../shared/utils/retry";
import { database } from "../services/database";
import { useFriendStore } from "./friend";
import { useUserStore } from "./user";
import { userRequest } from "../api/user";
import type { Json } from "../types/vrcx";
import type { FriendContext } from "./friend-types";

type MutualFriendEntry = Json<MutualFriend>;

type MutualFetchOptions = {
  rateLimiter?: ReturnType<typeof createRateLimiter>;
  isCancelled?: () => boolean;
};

type MutualFriendFetchResult = {
  friend: FriendContext;
  mutuals: MutualFriendEntry[];
};

function createDefaultFetchState() {
  return {
    processedFriends: 0,
  };
}

const EMPTY_USER_ID = "usr_00000000-0000-0000-0000-000000000000";

function normalizeIdentifier(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "bigint" || typeof value === "boolean") return String(value);
  return "";
}

function isValidMutualIdentifier(value: unknown): boolean {
  const identifier = normalizeIdentifier(value);
  return Boolean(identifier && identifier !== EMPTY_USER_ID);
}

function errorStatus(err: unknown): number | undefined {
  if (typeof err === "object" && err !== null && "status" in err && typeof err.status === "number") {
    return err.status;
  }
  return undefined;
}

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "object" && err !== null && "message" in err && typeof err.message === "string") {
    return err.message;
  }
  return "";
}

export const useChartsStore = defineStore("Charts", () => {
  const friendStore = useFriendStore();
  const userStore = useUserStore();

  const { t } = useI18n();

  const router = useRouter();

  const mutualGraphFetchState = reactive(createDefaultFetchState());
  const mutualGraphStatus = reactive({
    isFetching: false,
    hasFetched: false,
    completionNotified: false,
    friendSignature: 0,
    needsRefetch: false,
    cancelRequested: false,
  });

  const friendCount = computed(() => friendStore.friends.size || 0);
  const currentUser = computed(() => userStore.currentUser);
  const isOptOut = computed(() => currentUser.value.hasSharedConnectionsOptOut);

  function showInfoMessage(message: string, type: "info" | "warning"): void {
    const toastFn = toast[type];
    toastFn(message, { duration: 4000 });
  }

  watch(
    () => mutualGraphStatus.isFetching,
    (isFetching) => {
      if (!isFetching) return;
      showInfoMessage(t("view.charts.mutual_friend.notifications.start_fetching"), "info");
      mutualGraphStatus.completionNotified = false;
    }
  );

  watch(
    () => [mutualGraphStatus.hasFetched, mutualGraphStatus.isFetching],
    ([hasFetched, isFetching]) => {
      if (!hasFetched || isFetching || mutualGraphStatus.completionNotified) return;
      mutualGraphStatus.completionNotified = true;
      toast.success(t("view.charts.mutual_friend.notifications.mutual_friend_graph_ready_title"), {
        description: t("view.charts.mutual_friend.notifications.mutual_friend_graph_ready_message"),
        action: {
          label: t("common.actions.open"),
          onClick: () => {
            router.push({ name: "charts-mutual" }).catch((err: unknown) => {
              console.error("[MutualNetworkGraph] Failed to open charts page", err);
            });
          },
        },
      });
    }
  );

  watch(friendCount, (count) => {
    if (!mutualGraphStatus.hasFetched || mutualGraphStatus.isFetching || !mutualGraphStatus.friendSignature || mutualGraphStatus.needsRefetch) {
      return;
    }
    if (count !== mutualGraphStatus.friendSignature) {
      mutualGraphStatus.needsRefetch = true;
      showInfoMessage(t("view.charts.mutual_friend.notifications.friend_list_changed_fetch_again"), "warning");
    }
  });

  function resetMutualGraphState() {
    Object.assign(mutualGraphFetchState, createDefaultFetchState());
    mutualGraphStatus.isFetching = false;
    mutualGraphStatus.hasFetched = false;
    mutualGraphStatus.completionNotified = false;
    mutualGraphStatus.friendSignature = 0;
    mutualGraphStatus.needsRefetch = false;
    mutualGraphStatus.cancelRequested = false;
  }

  function markMutualGraphLoaded({ notify = true }: { notify?: boolean } = {}): void {
    mutualGraphStatus.completionNotified = notify ? false : true;
    mutualGraphStatus.hasFetched = true;
  }

  function requestMutualGraphCancel(): void {
    if (mutualGraphStatus.isFetching) mutualGraphStatus.cancelRequested = true;
  }

  async function fetchMutualFriendsForUser(userId: string, options: MutualFetchOptions = {}): Promise<MutualFriendEntry[]> {
    const { rateLimiter, isCancelled = () => false } = options;
    const collected: MutualFriendEntry[] = [];
    let offset = 0;

    for (;;) {
      if (isCancelled()) break;
      if (rateLimiter) await rateLimiter.wait();
      if (isCancelled()) break;

      const args = await executeWithBackoff(
        () => {
          if (isCancelled()) throw new Error("cancelled");
          return userRequest.getMutualFriends({
            userId,
            offset,
            n: 100,
          });
        },
        {
          maxRetries: 4,
          baseDelay: 500,
          shouldRetry: (err) => errorStatus(err) === 429 || errorMessage(err).includes("429"),
        }
      ).catch((err: unknown) => {
        if (errorMessage(err) === "cancelled") return null;
        throw err;
      });

      if (!args || isCancelled()) break;

      collected.push(...args.json.filter((entry) => isValidMutualIdentifier(entry.id)));

      if (args.json.length < 100) break;
      offset += args.json.length;
    }

    return collected;
  }

  async function fetchSingleFriendMutuals(friendId: string) {
    if (!friendId || isOptOut.value) {
      return { success: false, mutuals: [], optedOut: false };
    }

    try {
      const mutuals = await fetchMutualFriendsForUser(friendId);

      const mutualIds = mutuals.map((entry) => normalizeIdentifier(entry.id)).filter(isValidMutualIdentifier);
      await database.updateMutualsForFriend(friendId, mutualIds);
      await database.upsertMutualGraphMeta(friendId, {
        optedOut: false,
      });

      return { success: true, mutuals, optedOut: false };
    } catch (err: unknown) {
      const status = errorStatus(err);
      if (status === 403 || status === 404) {
        await database.upsertMutualGraphMeta(friendId, {
          optedOut: true,
        });
        return { success: false, mutuals: [], optedOut: true };
      }
      console.error("[MutualNetworkGraph] Single fetch error", friendId, err);
      return { success: false, mutuals: [], optedOut: false };
    }
  }

  async function fetchMutualGraph(): Promise<Map<string, MutualFriendFetchResult> | null> {
    if (mutualGraphStatus.isFetching || isOptOut.value) return null;

    if (!friendCount.value) {
      showInfoMessage(t("view.charts.mutual_friend.status.no_friends_to_process"), "info");
      return null;
    }

    const rateLimiter = createRateLimiter({
      limitPerInterval: 5,
      intervalMs: 1000,
    });

    const isCancelled = () => mutualGraphStatus.cancelRequested;

    mutualGraphStatus.isFetching = true;
    mutualGraphStatus.completionNotified = false;
    mutualGraphStatus.needsRefetch = false;
    mutualGraphStatus.cancelRequested = false;
    mutualGraphStatus.hasFetched = false;
    Object.assign(mutualGraphFetchState, { processedFriends: 0 });

    const friendSnapshot = Array.from(friendStore.friends.values());
    const mutualMap = new Map<string, MutualFriendFetchResult>();
    const metaEntries = new Map<string, { optedOut: boolean }>();

    let wasCancelled = false;

    try {
      for (let index = 0; index < friendSnapshot.length; index += 1) {
        const friend = friendSnapshot[index];
        if (!friend?.id) continue;

        if (isCancelled()) {
          wasCancelled = true;
          break;
        }

        try {
          const mutuals = await fetchMutualFriendsForUser(friend.id, {
            rateLimiter,
            isCancelled,
          });
          if (isCancelled()) {
            wasCancelled = true;
            break;
          }
          mutualMap.set(friend.id, { friend, mutuals });
          metaEntries.set(friend.id, { optedOut: false });
        } catch (err: unknown) {
          if (errorMessage(err) === "cancelled" || isCancelled()) {
            wasCancelled = true;
            break;
          }
          const status = errorStatus(err);
          if (status === 403 || status === 404) {
            metaEntries.set(friend.id, { optedOut: true });
          }
          console.warn("[MutualNetworkGraph] Skipping friend due to fetch error", friend.id, err);
          continue;
        }

        mutualGraphFetchState.processedFriends = index + 1;
        if (isCancelled()) {
          wasCancelled = true;
          break;
        }
      }

      if (wasCancelled) {
        mutualGraphStatus.hasFetched = false;
        showInfoMessage(t("view.charts.mutual_friend.messages.fetch_cancelled_graph_not_updated"), "warning");
        return null;
      }

      mutualGraphStatus.friendSignature = friendCount.value;
      mutualGraphStatus.needsRefetch = false;

      if (metaEntries.size > 0) {
        await database.bulkUpsertMutualGraphMeta(metaEntries);
      }

      try {
        const entries = new Map<string, string[]>();
        mutualMap.forEach((value, friendId) => {
          if (!friendId) return;
          const ids: string[] = [];

          for (const entry of value.mutuals) {
            const identifier = normalizeIdentifier(entry.id);
            if (isValidMutualIdentifier(identifier)) ids.push(identifier);
          }

          entries.set(friendId, ids);
        });
        await database.saveMutualGraphSnapshot(entries);
      } catch (persistErr: unknown) {
        console.error("[MutualNetworkGraph] Failed to cache data", persistErr);
      }

      markMutualGraphLoaded({ notify: true });
      return mutualMap;
    } catch (err: unknown) {
      console.error("[MutualNetworkGraph] fetch aborted", err);
      return null;
    } finally {
      mutualGraphStatus.isFetching = false;
      mutualGraphStatus.cancelRequested = false;
    }
  }

  return {
    mutualGraphFetchState,
    mutualGraphStatus,
    resetMutualGraphState,
    markMutualGraphLoaded,
    requestMutualGraphCancel,
    fetchMutualGraph,
    fetchSingleFriendMutuals,
  };
});
