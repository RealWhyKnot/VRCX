import { ref } from "vue";
import { storeToRefs } from "pinia";

import { useSearchStore } from "../../../stores/search";
import { replaceBioSymbols } from "../../../shared/utils/base/string";
import { groupRequest } from "../../../api/group";

function createDefaultSearchGroupParams() {
  return {
    n: 60,
    offset: 0,
    query: "",
  };
}

export function useSearchGroup() {
  const { searchText } = storeToRefs(useSearchStore());

  const searchGroupParams = ref(createDefaultSearchGroupParams());
  const searchGroupResults = ref([]);
  const isSearchGroupLoading = ref(false);

  async function searchGroup() {
    searchGroupParams.value = {
      ...createDefaultSearchGroupParams(),
      query: replaceBioSymbols(searchText.value),
    };
    await moreSearchGroup();
  }

  async function moreSearchGroup(go) {
    const params = searchGroupParams.value;
    if (go) {
      params.offset += params.n * go;
      if (params.offset < 0) {
        params.offset = 0;
      }
    }
    isSearchGroupLoading.value = true;
    await groupRequest
      .groupSearch(params)
      .finally(() => {
        isSearchGroupLoading.value = false;
      })
      .then((args) => {
        const map = new Map();
        for (const json of args.json) {
          map.set(json.id, json);
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
