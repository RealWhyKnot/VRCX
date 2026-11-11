import { computed, ref, type Ref } from "vue";
import type { AcceptableValue } from "reka-ui";
import type { ComposerTranslation } from "vue-i18n";
import { getPlatformInfo } from "../../../shared/utils/avatar";
import type { AvatarTag, MyAvatar } from "../types";

type PlatformFilter = "all" | "pc" | "android" | "ios";

type MyAvatarFiltersOptions = {
  t: ComposerTranslation;
  avatars: Ref<MyAvatar[]>;
  avatarTagsMap: Ref<Map<string | null, AvatarTag[]>>;
};

export function useMyAvatarFilters({ t, avatars, avatarTagsMap }: MyAvatarFiltersOptions) {
  const searchText = ref("");
  const releaseStatusFilter = ref("all");
  const tagFilters = ref(new Set<string>());
  const platformFilter = ref<PlatformFilter>("all");

  const allTags = computed(() => {
    const tagSet = new Set<string>();
    for (const tags of avatarTagsMap.value.values()) {
      for (const entry of tags) {
        tagSet.add(entry.tag);
      }
    }
    return Array.from(tagSet).sort();
  });

  const releaseStatusOptions = [
    { value: "all", label: t("view.search.avatar.all") },
    { value: "public", label: t("view.search.avatar.public") },
    { value: "private", label: t("view.search.avatar.private") },
  ];

  const platformOptions = [
    { value: "pc", label: "PC" },
    { value: "android", label: "Android" },
    { value: "ios", label: "iOS" },
  ];

  const activeFilterCount = computed(() => {
    let count = 0;
    if (releaseStatusFilter.value !== "all") count++;
    count += tagFilters.value.size;
    if (platformFilter.value !== "all") count++;
    return count;
  });

  function setReleaseStatusFilter(value: AcceptableValue | AcceptableValue[] | undefined) {
    releaseStatusFilter.value = typeof value === "string" ? value : "all";
  }

  function setPlatformFilter(value: AcceptableValue | AcceptableValue[] | undefined) {
    platformFilter.value = isPlatformFilter(value) ? value : "all";
  }

  function isPlatformFilter(value: AcceptableValue | AcceptableValue[] | undefined): value is PlatformFilter {
    return value === "pc" || value === "android" || value === "ios" || value === "all";
  }

  function toggleTagFilter(tag: string) {
    const next = new Set(tagFilters.value);
    if (next.has(tag)) next.delete(tag);
    else next.add(tag);
    tagFilters.value = next;
  }

  function clearFilters() {
    releaseStatusFilter.value = "all";
    tagFilters.value = new Set();
    platformFilter.value = "all";
  }

  const filteredAvatars = computed(() => {
    let list = avatars.value;

    if (releaseStatusFilter.value === "public") {
      list = list.filter((a) => a.releaseStatus === "public");
    } else if (releaseStatusFilter.value === "private") {
      list = list.filter((a) => a.releaseStatus === "private");
    }

    if (tagFilters.value.size) {
      list = list.filter((a) => a.$tags?.some((t) => tagFilters.value.has(t.tag)));
    }

    const platform = platformFilter.value;
    if (platform !== "all") {
      list = list.filter((a) => Boolean(getPlatformInfo(a.unityPackages)[platform].platform));
    }

    if (searchText.value) {
      const query = searchText.value.toLowerCase();
      list = list.filter((a) => a.name.toLowerCase().includes(query) || a.$tags?.some((t) => t.tag.toLowerCase().includes(query)));
    }

    return list;
  });

  return {
    searchText,
    releaseStatusFilter,
    tagFilters,
    platformFilter,
    allTags,
    releaseStatusOptions,
    platformOptions,
    activeFilterCount,
    setReleaseStatusFilter,
    setPlatformFilter,
    toggleTagFilter,
    clearFilters,
    filteredAvatars,
  };
}
