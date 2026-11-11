import { ref } from "vue";
import { storeToRefs } from "pinia";
import type { SearchUsers } from "vrchat";

import { useSearchStore } from "../../../stores/search";

type SearchUserParams = NonNullable<SearchUsers["query"]> & { n: number; offset: number };

function createDefaultSearchUserParams(): SearchUserParams {
  return {
    n: 60,
    offset: 0,
    search: "",
    customFields: "displayName",
    sort: "relevance",
  };
}

export function useSearchUser() {
  const { searchText } = storeToRefs(useSearchStore());
  const { moreSearchUser } = useSearchStore();

  const searchUserParams = ref<SearchUserParams>(createDefaultSearchUserParams());
  const searchUserSortByLastLoggedIn = ref(false);
  const isSearchUserLoading = ref(false);

  async function searchUser() {
    searchUserParams.value = {
      ...createDefaultSearchUserParams(),
      search: searchText.value,
      sort: searchUserSortByLastLoggedIn.value ? "last_login" : "relevance",
    };
    await handleMoreSearchUser();
  }

  async function handleMoreSearchUser(go: number | null = null) {
    isSearchUserLoading.value = true;
    await moreSearchUser(go, searchUserParams.value);
    isSearchUserLoading.value = false;
  }

  function clearUserSearch() {
    searchUserParams.value = createDefaultSearchUserParams();
  }

  return {
    searchUserParams,
    searchUserSortByLastLoggedIn,
    isSearchUserLoading,
    searchUser,
    handleMoreSearchUser,
    clearUserSearch,
  };
}
