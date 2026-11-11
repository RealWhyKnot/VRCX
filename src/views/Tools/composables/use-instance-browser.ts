import { computed, onScopeDispose, ref, watch } from "vue";

import { instanceRequest } from "../../../api/instance";
import {
  DISCOVER_MAX_VIBES,
  DISCOVER_PAGE_SIZE,
  buildDiscoverQuery,
  clampOccupants,
  createDiscoverFilters,
  filterDiscovered,
  parseDiscovery,
  type DiscoveredInstance,
} from "../../../shared/utils/instance-discovery";
import { logError } from "../../../stores/vrcx-messages";

export type InstanceBrowserSource = "discover" | "mine";

const REFRESH_DELAY_MS = 400;

export function useInstanceBrowser() {
  const filters = ref(createDiscoverFilters());
  const source = ref<InstanceBrowserSource>("discover");
  const searchText = ref("");
  const instances = ref<DiscoveredInstance[]>([]);
  const isLoading = ref(false);
  const hasLoadFailed = ref(false);
  const hasMore = ref(false);
  let latest = 0;

  const visibleInstances = computed(() => filterDiscovered(instances.value, searchText.value));

  async function fetchPage(offset: number): Promise<DiscoveredInstance[]> {
    if (source.value === "mine") {
      return parseDiscovery(await instanceRequest.getActiveInstances({ n: DISCOVER_PAGE_SIZE, offset }));
    }
    return parseDiscovery(await instanceRequest.discoverInstances(buildDiscoverQuery(filters.value)));
  }

  async function load(offset: number): Promise<void> {
    latest += 1;
    const ticket = latest;
    isLoading.value = true;
    hasLoadFailed.value = false;
    try {
      const page = await fetchPage(offset);
      if (ticket !== latest) {
        return;
      }
      const known = new Set(offset > 0 ? instances.value.map((instance) => instance.location) : []);
      const fresh = page.filter((instance) => !known.has(instance.location));
      instances.value = offset > 0 ? [...instances.value, ...fresh] : fresh;
      hasMore.value = source.value === "mine" && page.length >= DISCOVER_PAGE_SIZE && fresh.length > 0;
    } catch (err) {
      if (ticket === latest) {
        hasLoadFailed.value = true;
        if (offset === 0) {
          instances.value = [];
        }
        hasMore.value = false;
      }
      logError(err);
    } finally {
      if (ticket === latest) {
        isLoading.value = false;
      }
    }
  }

  function refresh(): Promise<void> {
    return load(0);
  }

  function loadMore(): Promise<void> {
    return load(instances.value.length);
  }

  let timer: ReturnType<typeof setTimeout> | undefined;

  watch(
    [filters, source],
    () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        refresh().catch(logError);
      }, REFRESH_DELAY_MS);
    },
    { deep: true }
  );

  onScopeDispose(() => {
    clearTimeout(timer);
  });

  function setVibes(value: unknown): void {
    const picked = Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
    filters.value.vibeIds = picked.slice(0, DISCOVER_MAX_VIBES);
  }

  function setMinOccupants(value: unknown): void {
    filters.value.minOccupants = clampOccupants(value);
  }

  function resetFilters(): void {
    filters.value = createDiscoverFilters();
    searchText.value = "";
  }

  return {
    filters,
    source,
    searchText,
    instances,
    visibleInstances,
    isLoading,
    hasLoadFailed,
    hasMore,
    refresh,
    loadMore,
    setVibes,
    setMinOccupants,
    resetFilters,
  };
}
