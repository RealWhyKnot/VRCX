import { ref } from "vue";
import { storeToRefs } from "pinia";
import type { AcceptableValue } from "reka-ui";
import type { SearchWorlds } from "vrchat";

import { replaceBioSymbols } from "../../../shared/utils/base/string";
import { useAuthStore } from "../../../stores/auth";
import { useSearchStore } from "../../../stores/search";
import { useWorldStore } from "../../../stores/world";
import { worldRequest } from "../../../api/world";
import { logFailure } from "../../../stores/log-failure";
import type { WorldRef } from "../../../shared/utils/world-transforms";

type SearchWorldParams = NonNullable<SearchWorlds["query"]>;
type SearchWorldOrder = NonNullable<SearchWorldParams["order"]>;

type SearchWorldRow = {
  index?: number;
  sortHeading?: string;
  sortOrder?: string;
  sortOwnership?: string;
  tag?: string | null;
};

function createDefaultSearchWorldParams(): SearchWorldParams {
  return {
    n: 60,
    offset: 0,
  };
}

function toSearchWorldOrder(value: string | undefined): SearchWorldOrder {
  return value === "ascending" ? "ascending" : "descending";
}

export function useSearchWorld() {
  const { cachedWorlds } = useWorldStore();
  const { searchText } = storeToRefs(useSearchStore());
  const { cachedConfig } = storeToRefs(useAuthStore());

  const searchWorldOption = ref("");
  const searchWorldLabs = ref(false);
  const searchWorldParams = ref<SearchWorldParams>(createDefaultSearchWorldParams());
  const searchWorldCategoryIndex = ref<number | null>(null);
  const searchWorldResults = ref<WorldRef[]>([]);
  const isSearchWorldLoading = ref(false);

  function searchWorld(row: SearchWorldRow) {
    searchWorldOption.value = "";
    searchWorldCategoryIndex.value = row.index ?? null;
    const params = createDefaultSearchWorldParams();
    switch (row.sortHeading ?? "") {
      case "featured":
        params.sort = "order";
        params.featured = true;
        break;
      case "trending":
        params.sort = "popularity";
        params.featured = false;
        break;
      case "updated":
        params.sort = "updated";
        break;
      case "created":
        params.sort = "created";
        break;
      case "publication":
        params.sort = "publicationDate";
        break;
      case "shuffle":
        params.sort = "shuffle";
        break;
      case "active":
        searchWorldOption.value = "active";
        break;
      case "recent":
        searchWorldOption.value = "recent";
        break;
      case "favorite":
        searchWorldOption.value = "favorites";
        break;
      case "labs":
        params.sort = "labsPublicationDate";
        break;
      case "heat":
        params.sort = "heat";
        params.featured = false;
        break;
      default:
        params.sort = "relevance";
        params.search = replaceBioSymbols(searchText.value);
        break;
    }
    params.order = toSearchWorldOrder(row.sortOrder);
    if (row.sortOwnership === "mine") {
      params.user = "me";
      params.releaseStatus = "all";
    }
    if (row.tag) {
      params.tag = row.tag;
    }
    if (!searchWorldLabs.value) {
      if (params.tag) {
        params.tag += ",system_approved";
      } else {
        params.tag = "system_approved";
      }
    }

    searchWorldParams.value = params;
    moreSearchWorld();
  }

  function handleSearchWorldCategorySelect(value: AcceptableValue | AcceptableValue[]) {
    if (typeof value !== "number") return;
    searchWorldCategoryIndex.value = value;
    const row = cachedConfig.value.dynamicWorldRows?.find((r) => r.index === value);
    searchWorld(row ?? {});
  }

  function moreSearchWorld(go?: number) {
    const params = searchWorldParams.value;
    if (go) {
      const offset = (params.offset ?? 0) + (params.n ?? 0) * go;
      params.offset = offset < 0 ? 0 : offset;
    }
    isSearchWorldLoading.value = true;
    void worldRequest
      .getWorlds(params, searchWorldOption.value)
      .finally(() => {
        isSearchWorldLoading.value = false;
      })
      .then((args) => {
        const map = new Map<string, WorldRef>();
        for (const json of args.json) {
          const ref = cachedWorlds.get(json.id);
          if (ref !== undefined) {
            map.set(ref.id, ref);
          }
        }
        searchWorldResults.value = Array.from(map.values());
        return args;
      })
      .catch(logFailure("Searching worlds failed:"));
  }

  function clearWorldSearch() {
    searchWorldParams.value = createDefaultSearchWorldParams();
    searchWorldResults.value = [];
  }

  return {
    searchWorldOption,
    searchWorldLabs,
    searchWorldParams,
    searchWorldCategoryIndex,
    searchWorldResults,
    isSearchWorldLoading,
    searchWorld,
    moreSearchWorld,
    handleSearchWorldCategorySelect,
    clearWorldSearch,
  };
}
