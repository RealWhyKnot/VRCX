import { describe, expect, it } from "vitest";
import { ref } from "vue";
import { createI18n } from "vue-i18n";

import { createDefaultAvatarRef, type AvatarUnityPackage } from "../../../../src/shared/utils/avatar-transforms";
import { useMyAvatarFilters } from "../../../../src/views/MyAvatars/composables/use-my-avatar-filters";
import type { AvatarTag, MyAvatar } from "../../../../src/views/MyAvatars/types";

const i18n = createI18n({ legacy: false, locale: "en-US", missingWarn: false, fallbackWarn: false, messages: { "en-US": {} } });

function createAvatar(id: string, releaseStatus: "public" | "private", unityPackages: AvatarUnityPackage[]): MyAvatar {
  return createDefaultAvatarRef({ id, name: id, releaseStatus, unityPackages });
}

function createFilters() {
  const avatars = ref<MyAvatar[]>([
    createAvatar("rated-pc", "public", [{ platform: "standalonewindows", performanceRating: "Good" }]),
    createAvatar("unrated-pc", "private", [{ platform: "standalonewindows" }]),
    createAvatar("quest", "public", [{ platform: "android", performanceRating: "Medium" }]),
    createAvatar("impostor-only", "private", [{ platform: "ios", variant: "impostor" }]),
  ]);
  const avatarTagsMap = ref(new Map<string | null, AvatarTag[]>());
  return useMyAvatarFilters({ t: i18n.global.t, avatars, avatarTagsMap });
}

function ids(list: MyAvatar[]) {
  return list.map((avatar) => avatar.id);
}

describe("useMyAvatarFilters", () => {
  it("shows every avatar by default", () => {
    const filters = createFilters();
    expect(ids(filters.filteredAvatars.value)).toEqual(["rated-pc", "unrated-pc", "quest", "impostor-only"]);
    expect(filters.activeFilterCount.value).toBe(0);
  });

  it("keeps avatars that have a platform build without a performance rating", () => {
    const filters = createFilters();
    filters.setPlatformFilter("pc");
    expect(ids(filters.filteredAvatars.value)).toEqual(["rated-pc", "unrated-pc"]);
    expect(filters.activeFilterCount.value).toBe(1);
  });

  it("ignores impostor builds when filtering by platform", () => {
    const filters = createFilters();
    filters.setPlatformFilter("ios");
    expect(ids(filters.filteredAvatars.value)).toEqual([]);
  });

  it("goes back to all platforms when the active toggle is switched off", () => {
    const filters = createFilters();
    filters.setPlatformFilter("android");
    expect(ids(filters.filteredAvatars.value)).toEqual(["quest"]);
    filters.setPlatformFilter(undefined);
    expect(filters.platformFilter.value).toBe("all");
    expect(ids(filters.filteredAvatars.value)).toHaveLength(4);
    expect(filters.activeFilterCount.value).toBe(0);
  });

  it("goes back to every release status when the active toggle is switched off", () => {
    const filters = createFilters();
    filters.setReleaseStatusFilter("private");
    expect(ids(filters.filteredAvatars.value)).toEqual(["unrated-pc", "impostor-only"]);
    filters.setReleaseStatusFilter(undefined);
    expect(filters.releaseStatusFilter.value).toBe("all");
    expect(filters.activeFilterCount.value).toBe(0);
  });
});
