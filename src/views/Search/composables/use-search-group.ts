import { ref } from "vue";
import { storeToRefs } from "pinia";
import type { LimitedGroup, SearchGroups } from "vrchat";

import { useSearchStore } from "../../../stores/search";
import { replaceBioSymbols } from "../../../shared/utils/base/string";
import { groupRequest } from "../../../api/group";
import type { Json } from "../../../types/vrcx";

type SearchGroupParams = NonNullable<SearchGroups["query"]>;

function createDefaultSearchGroupParams(): SearchGroupParams {
  return {
    n: 60,
    offset: 0,
    query: "",
  };
}

export function useSearchGroup() {
  const { searchText } = storeToRefs(useSearchStore());

  const searchGroupParams = ref<SearchGroupParams>(createDefaultSearchGroupParams());
  const searchGroupResults = ref<Json<LimitedGroup>[]>([]);
  const isSearchGroupLoading = ref(false);

  async function searchGroup() {
    searchGroupParams.value = {
      ...createDefaultSearchGroupParams(),
      query: replaceBioSymbols(searchText.value),
    };
    await moreSearchGroup();
  }

  async function moreSearchGroup(go?: number) {
    const params = searchGroupParams.value;
    if (go) {
      const offset = (params.offset ?? 0) + (params.n ?? 0) * go;
      params.offset = offset < 0 ? 0 : offset;
    }
    isSearchGroupLoading.value = true;
    await groupRequest
      .groupSearch(params)
      .finally(() => {
        isSearchGroupLoading.value = false;
      })
      .then((args) => {
        const map = new Map<string, Json<LimitedGroup>>();
        for (const json of args.json) {
          if (json.id !== undefined) {
            map.set(json.id, json);
          }
        }
        searchGroupResults.value = Array.from(map.values());
        return args;
      });
  }

  function clearGroupSearch() {
    searchGroupParams.value = createDefaultSearchGroupParams();
    searchGroupResults.value = [];
  }

  return {
    searchGroupParams,
    searchGroupResults,
    isSearchGroupLoading,
    searchGroup,
    moreSearchGroup,
    clearGroupSearch,
  };
}
