import { computed, ref, type Ref } from "vue";
import { storeToRefs } from "pinia";
import { toast } from "vue-sonner";
import type { ComposerTranslation } from "vue-i18n";
import { logFailure } from "@/stores/log-failure";
import { useChartsStore } from "../../../stores/charts";
import { useFriendStore } from "../../../stores/friend";
import { useModalStore } from "../../../stores/modal";
import { useUserStore } from "../../../stores/user";
import { database } from "../../../services/database";
import { watchState } from "../../../services/watch-state";
import { firstNonEmpty } from "./mutual-graph-labels";
import type { MutualMap, MutualNodeMeta } from "./mutual-graph-types";

type MutualGraphDataOptions = {
  t: ComposerTranslation;
  graphMeta: Ref<Map<string, MutualNodeMeta>>;
  contextMenuNodeId: Ref<string | null>;
  applyGraph: (mutualMap: MutualMap) => Promise<void>;
  hasCurrentGraph: () => boolean;
};

export function useMutualGraphData({ t, graphMeta, contextMenuNodeId, applyGraph, hasCurrentGraph }: MutualGraphDataOptions) {
  const friendStore = useFriendStore();
  const userStore = useUserStore();
  const modalStore = useModalStore();
  const chartsStore = useChartsStore();
  const { friends } = storeToRefs(friendStore);
  const { currentUser } = storeToRefs(userStore);
  const cachedUsers = userStore.cachedUsers;

  const fetchState = chartsStore.mutualGraphFetchState;
  const status = chartsStore.mutualGraphStatus;

  const isFetching = computed({
    get: () => status.isFetching,
    set: (isActive: boolean) => {
      status.isFetching = isActive;
    },
  });
  const hasFetched = computed({
    get: () => status.hasFetched,
    set: (isLoaded: boolean) => {
      status.hasFetched = isLoaded;
    },
  });

  const isLoadingSnapshot = ref(false);
  const isRefreshingNode = ref(false);
  const totalFriends = computed(() => friends.value.size);
  const isOptOut = computed(() => currentUser.value.hasSharedConnectionsOptOut);
  const fetchButtonDisabled = computed(() => isFetching.value || isOptOut.value || totalFriends.value === 0 || isLoadingSnapshot.value);
  const fetchButtonLabel = computed(() =>
    hasFetched.value ? t("view.charts.mutual_friend.actions.fetch_again") : t("view.charts.mutual_friend.actions.start_fetch")
  );
  const progressPercent = computed(() => (totalFriends.value ? Math.min(100, Math.round((fetchState.processedFriends / totalFriends.value) * 100)) : 0));

  function showStatusMessage(message: string, type: "info" | "success" | "warning" | "error" = "info") {
    if (!message) return;
    toast[type](message, { duration: 4000 });
  }

  function buildMutualMap(snapshot: Map<string, string[]>): MutualMap {
    const mutualMap: MutualMap = new Map();
    snapshot.forEach((mutualIds, friendId) => {
      if (!friendId) return;
      const friendEntry = friends.value.get(friendId);
      const fallbackRef = friendEntry?.ref ?? cachedUsers.get(friendId);
      const normalizedMutuals = mutualIds.filter((id) => id !== "usr_00000000-0000-0000-0000-000000000000");

      mutualMap.set(friendId, {
        friend: friendEntry ?? { id: friendId, ref: fallbackRef },
        mutuals: normalizedMutuals.map((id) => ({ id })),
      });
    });
    return mutualMap;
  }

  async function loadGraphFromDatabase() {
    if (!watchState.isLoggedIn || !currentUser.value.id) return;
    if (!watchState.isFriendsLoaded) return;
    if (isFetching.value || isLoadingSnapshot.value) return;
    if (hasFetched.value && !status.needsRefetch && hasCurrentGraph()) return;

    isLoadingSnapshot.value = true;

    try {
      const [snapshot, meta] = await Promise.all([database.getMutualGraphSnapshot(), database.getMutualGraphMeta()]);
      graphMeta.value = new Map(
        Array.from(meta, ([id, entry]): [string, MutualNodeMeta] => [id, { lastFetchedAt: entry.lastFetchedAt, isOptedOut: entry.optedOut }])
      );

      if (snapshot.size === 0) {
        if (totalFriends.value === 0) {
          showStatusMessage(t("view.charts.mutual_friend.status.no_friends_to_process"), "info");
          return;
        }
        if (isOptOut.value) {
          promptEnableMutualFriendsSharing();
          return;
        }
        promptInitialFetch();
        return;
      }

      const mutualMap = buildMutualMap(snapshot);

      if (!mutualMap.size) {
        promptInitialFetch();
        return;
      }

      await applyGraph(mutualMap);
      chartsStore.markMutualGraphLoaded({ notify: false });
      fetchState.processedFriends = Math.min(mutualMap.size, totalFriends.value || mutualMap.size);
      status.friendSignature = totalFriends.value;
      status.needsRefetch = false;
    } catch (err) {
      console.error("[MutualNetworkGraph] Failed to load cached mutual graph", err);
    } finally {
      isLoadingSnapshot.value = false;
    }
  }

  function promptInitialFetch() {
    if (isFetching.value || hasFetched.value || !totalFriends.value) return;

    void modalStore
      .confirm({
        description: t("view.charts.mutual_friend.prompt.message"),
        title: t("view.charts.mutual_friend.prompt.title"),
        confirmText: t("view.charts.mutual_friend.prompt.confirm"),
        cancelText: t("view.charts.mutual_friend.prompt.cancel"),
      })
      .then(async ({ ok }) => {
        if (!ok) return;
        await startFetch();
      })
      .catch(logFailure("Showing the mutual friends prompt failed:"));
  }

  function promptEnableMutualFriendsSharing() {
    void modalStore
      .confirm({
        description: t("view.charts.mutual_friend.enable_sharing_prompt.message"),
        title: t("view.charts.mutual_friend.enable_sharing_prompt.title"),
        confirmText: t("view.charts.mutual_friend.enable_sharing_prompt.confirm"),
        cancelText: t("view.charts.mutual_friend.enable_sharing_prompt.cancel"),
      })
      .then(({ ok }) => {
        if (!ok) return;
        void userStore.toggleSharedConnectionsOptOut().catch(logFailure("Toggling the shared connections opt-out failed:"));
        promptInitialFetch();
      })
      .catch(logFailure("Showing the mutual friends sharing prompt failed:"));
  }

  async function startFetch() {
    if (isFetching.value || isOptOut.value) return;
    const mutualMap = await chartsStore.fetchMutualGraph();
    if (!mutualMap) return;
    try {
      await applyGraph(mutualMap);
    } catch (err) {
      console.error("[MutualNetworkGraph] Failed to apply graph after fetch", err);
    }
  }

  function cancelFetch() {
    chartsStore.requestMutualGraphCancel();
  }

  async function handleNodeMenuRefresh() {
    const nodeId = contextMenuNodeId.value;
    contextMenuNodeId.value = null;
    if (!nodeId || isRefreshingNode.value) return;

    const isFriend = friends.value.has(nodeId);

    if (!isFriend) {
      try {
        const { ok } = await modalStore.confirm({
          title: t("view.charts.mutual_friend.context_menu.confirm_non_friend_title"),
          description: t("view.charts.mutual_friend.context_menu.confirm_non_friend_message"),
          confirmText: t("common.actions.confirm"),
          cancelText: t("common.actions.cancel"),
        });
        if (!ok) return;
      } catch {
        return;
      }
    }

    isRefreshingNode.value = true;
    try {
      const result = await chartsStore.fetchSingleFriendMutuals(nodeId);

      if (result.optedOut) {
        toast.warning(t("view.charts.mutual_friend.context_menu.user_opted_out"), { duration: 5000 });
        graphMeta.value.set(nodeId, {
          lastFetchedAt: new Date().toISOString(),
          isOptedOut: true,
        });
      } else if (result.success) {
        const name = firstNonEmpty([cachedUsers.get(nodeId)?.displayName], nodeId);
        toast.success(t("view.charts.mutual_friend.context_menu.refresh_success", { name }), {
          duration: 3000,
        });
        graphMeta.value.set(nodeId, {
          lastFetchedAt: new Date().toISOString(),
          isOptedOut: false,
        });
      } else {
        toast.error(t("view.charts.mutual_friend.context_menu.refresh_error"), { duration: 4000 });
        return;
      }

      const snapshot = await database.getMutualGraphSnapshot();
      if (snapshot.size > 0) {
        await applyGraph(buildMutualMap(snapshot));
      }
    } catch (err) {
      console.error("[MutualNetworkGraph] Refresh node error", err);
      toast.error(t("view.charts.mutual_friend.context_menu.refresh_error"), { duration: 4000 });
    } finally {
      isRefreshingNode.value = false;
    }
  }

  return {
    status,
    fetchState,
    isFetching,
    hasFetched,
    totalFriends,
    fetchButtonDisabled,
    fetchButtonLabel,
    progressPercent,
    startFetch,
    cancelFetch,
    loadGraphFromDatabase,
    handleNodeMenuRefresh,
  };
}
