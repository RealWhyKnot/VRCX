import { watch } from "vue";
import { watchState } from "./watch-state";

export function prefetchAfterFriendsLoaded(load: () => Promise<void>, onError: (error: unknown) => void): void {
  watch(
    [() => watchState.isLoggedIn, () => watchState.isFriendsLoaded],
    ([isLoggedIn, isFriendsLoaded], _previous, onCleanup) => {
      if (!isLoggedIn || !isFriendsLoaded) return;
      let isCancelled = false;
      const run = () => {
        if (!isCancelled && watchState.isLoggedIn && watchState.isFriendsLoaded) {
          void load().catch(onError);
        }
      };
      if (typeof requestIdleCallback === "function") {
        const handle = requestIdleCallback(run, { timeout: 2000 });
        onCleanup(() => {
          isCancelled = true;
          cancelIdleCallback(handle);
        });
      } else {
        const handle = setTimeout(run, 0);
        onCleanup(() => {
          isCancelled = true;
          clearTimeout(handle);
        });
      }
    },
    { immediate: true, flush: "post" }
  );
}
