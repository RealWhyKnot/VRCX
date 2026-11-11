import { ref } from "vue";
import * as workerTimers from "worker-timers";

type RefreshToken = {
  cancelled: boolean;
  resolve: (() => void) | null;
};

export function useFavoritesLocalRefresh(fetchItem: (id: string) => Promise<void>) {
  const refreshingLocalFavorites = ref(false);
  const worker = ref<ReturnType<typeof workerTimers.setTimeout> | null>(null);
  const refreshCancelToken = ref<RefreshToken | null>(null);

  async function refreshLocalFavorites(ids: readonly string[]) {
    if (refreshingLocalFavorites.value) {
      return;
    }
    refreshingLocalFavorites.value = true;
    const token: RefreshToken = {
      cancelled: false,
      resolve: null,
    };
    refreshCancelToken.value = token;
    const isRefreshCancelled = () => token.cancelled;
    try {
      for (const id of ids) {
        if (isRefreshCancelled()) {
          break;
        }
        try {
          await fetchItem(id);
        } catch (err) {
          console.error(err);
        }
        if (isRefreshCancelled()) {
          break;
        }
        await new Promise<void>((resolve) => {
          token.resolve = resolve;
          worker.value = workerTimers.setTimeout(() => {
            worker.value = null;
            resolve();
          }, 1000);
        });
      }
    } finally {
      if (worker.value) {
        workerTimers.clearTimeout(worker.value);
        worker.value = null;
      }
      if (refreshCancelToken.value === token) {
        refreshCancelToken.value = null;
      }
      refreshingLocalFavorites.value = false;
    }
  }

  function cancelLocalRefresh() {
    if (!refreshingLocalFavorites.value) {
      return;
    }
    if (refreshCancelToken.value) {
      refreshCancelToken.value.cancelled = true;
      refreshCancelToken.value.resolve?.();
    }
    if (worker.value) {
      workerTimers.clearTimeout(worker.value);
      worker.value = null;
    }
    refreshingLocalFavorites.value = false;
  }

  return { refreshingLocalFavorites, refreshLocalFavorites, cancelLocalRefresh };
}
