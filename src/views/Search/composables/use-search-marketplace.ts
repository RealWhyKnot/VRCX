import { ref } from "vue";
import { storeToRefs } from "pinia";
import type { Avatar } from "vrchat";

import { useSearchStore } from "../../../stores/search";
import { replaceBioSymbols } from "../../../shared/utils/base/string";
import { marketplaceRequest } from "../../../api/marketplace";
import type { Json, MarketplaceAvatarSearchParams } from "../../../types/vrcx";

type MarketplaceSearchPage = { results?: Json<Avatar>[]; hasNext?: boolean };

function createDefaultSearchMarketplaceParams(): MarketplaceAvatarSearchParams {
  return {
    n: 50,
    offset: 0,
    releaseStatus: "public",
    order: "ascending",
    marketplace: "all",
    metadata: true,
    search: "",
  };
}

export function useSearchMarketplace() {
  const { searchText } = storeToRefs(useSearchStore());

  const searchMarketplaceParams = ref<MarketplaceAvatarSearchParams>(createDefaultSearchMarketplaceParams());
  const searchMarketplaceResults = ref<Json<Avatar>[]>([]);
  const searchMarketplaceHasNext = ref(false);
  const isSearchMarketplaceLoading = ref(false);

  async function searchMarketplace() {
    searchMarketplaceParams.value = {
      ...createDefaultSearchMarketplaceParams(),
      search: replaceBioSymbols(searchText.value),
    };
    await moreSearchMarketplace();
  }

  async function moreSearchMarketplace(go?: number) {
    const params = searchMarketplaceParams.value;
    if (go) {
      const offset = params.offset + params.n * go;
      params.offset = offset < 0 ? 0 : offset;
    }
    isSearchMarketplaceLoading.value = true;
    await marketplaceRequest
      .searchAvatars(params)
      .finally(() => {
        isSearchMarketplaceLoading.value = false;
      })
      .then((args) => {
        const page: MarketplaceSearchPage = args.json;
        const map = new Map<string, Json<Avatar>>();
        for (const json of page.results ?? []) {
          map.set(json.id, {
            ...json,
            name: replaceBioSymbols(json.name),
            authorName: replaceBioSymbols(json.authorName),
          });
        }
        searchMarketplaceResults.value = Array.from(map.values());
        searchMarketplaceHasNext.value = Boolean(page.hasNext);
        return args;
      });
  }

  function clearMarketplaceSearch() {
    searchMarketplaceParams.value = createDefaultSearchMarketplaceParams();
    searchMarketplaceResults.value = [];
    searchMarketplaceHasNext.value = false;
  }

  return {
    searchMarketplaceParams,
    searchMarketplaceResults,
    searchMarketplaceHasNext,
    isSearchMarketplaceLoading,
    searchMarketplace,
    moreSearchMarketplace,
    clearMarketplaceSearch,
  };
}
