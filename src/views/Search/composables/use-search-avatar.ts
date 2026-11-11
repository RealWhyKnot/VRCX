import { ref } from "vue";
import { storeToRefs } from "pinia";

import { useAdvancedSettingsStore } from "../../../stores/settings/advanced";
import { useSearchStore } from "../../../stores/search";
import { lookupAvatars } from "../../../coordinators/avatar-coordinator";

type SearchAvatarItem = Awaited<ReturnType<typeof lookupAvatars>> extends Map<string, infer T> ? T : never;

export function useSearchAvatar() {
  const { avatarRemoteDatabase } = storeToRefs(useAdvancedSettingsStore());
  const { searchText } = storeToRefs(useSearchStore());

  const searchAvatarPageNum = ref(0);
  const searchAvatarResults = ref<SearchAvatarItem[]>([]);
  const searchAvatarPage = ref<SearchAvatarItem[]>([]);
  const isSearchAvatarLoading = ref(false);

  async function searchAvatar() {
    isSearchAvatarLoading.value = true;
    const avatars = new Map<string, SearchAvatarItem>();
    const query = searchText.value;

    if (query && query.length >= 3 && avatarRemoteDatabase.value) {
      const data = await lookupAvatars("search", query);
      data.forEach((avatar) => {
        avatars.set(avatar.id, avatar);
      });
    }

    isSearchAvatarLoading.value = false;
    const avatarsArray = Array.from(avatars.values());
    searchAvatarPageNum.value = 0;
    searchAvatarResults.value = avatarsArray;
    searchAvatarPage.value = avatarsArray.slice(0, 10);
  }

  function moreSearchAvatar(n: -1 | 1) {
    searchAvatarPageNum.value += n;
    const offset = searchAvatarPageNum.value * 10;
    searchAvatarPage.value = searchAvatarResults.value.slice(offset, offset + 10);
  }

  function clearAvatarSearch() {
    searchAvatarResults.value = [];
    searchAvatarPage.value = [];
    searchAvatarPageNum.value = 0;
  }

  return {
    searchAvatarPageNum,
    searchAvatarResults,
    searchAvatarPage,
    isSearchAvatarLoading,
    searchAvatar,
    moreSearchAvatar,
    clearAvatarSearch,
  };
}
