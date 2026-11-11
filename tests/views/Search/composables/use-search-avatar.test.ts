import { beforeEach, describe, expect, it, vi } from "vitest";
import { ref } from "vue";
import type { lookupAvatars } from "../../../../src/coordinators/avatar-coordinator";

type SearchAvatarItem = Awaited<ReturnType<typeof lookupAvatars>> extends Map<string, infer T> ? T : never;

function createAvatar(id: string, name: string): SearchAvatarItem {
  return {
    authorId: "usr_1",
    authorName: "Author",
    name,
    description: "",
    id,
    imageUrl: "",
    thumbnailImageUrl: "",
    created_at: "",
    updated_at: "",
    releaseStatus: "public",
  };
}

const mockAvatarRemoteDatabase = ref(true);
const mockSearchText = ref("");
const mockLookupAvatars = vi.fn<(type: string, search: string) => Promise<Map<string, SearchAvatarItem>>>();

vi.mock("../../../../src/stores/settings/advanced", () => ({
  useAdvancedSettingsStore: () => ({
    avatarRemoteDatabase: mockAvatarRemoteDatabase,
  }),
}));
vi.mock("pinia", () => ({
  storeToRefs: (store: unknown) => store,
}));
vi.mock("../../../../src/stores/search", () => ({
  useSearchStore: () => ({
    searchText: mockSearchText,
  }),
}));

vi.mock("../../../../src/coordinators/avatar-coordinator", () => ({
  lookupAvatars: (type: string, search: string) => mockLookupAvatars(type, search),
}));

import { useSearchAvatar } from "../../../../src/views/Search/composables/use-search-avatar";

describe("useSearchAvatar", () => {
  beforeEach(() => {
    mockAvatarRemoteDatabase.value = true;
    mockSearchText.value = "";
    mockLookupAvatars.mockReset();
  });

  it("queries remote avatars and builds first page", async () => {
    mockSearchText.value = "alice";
    mockLookupAvatars.mockResolvedValue(
      new Map([
        ["a", createAvatar("avtr_1", "A")],
        ["b", createAvatar("avtr_1", "A-dup")],
        ["c", createAvatar("avtr_2", "B")],
      ])
    );

    const api = useSearchAvatar();
    await api.searchAvatar();

    expect(mockLookupAvatars).toHaveBeenCalledWith("search", "alice");
    expect(api.searchAvatarResults.value.map((x) => x.id)).toEqual(["avtr_1", "avtr_2"]);
    expect(api.searchAvatarPage.value.map((x) => x.id)).toEqual(["avtr_1", "avtr_2"]);
    expect(api.searchAvatarPageNum.value).toBe(0);
  });

  it("skips remote query when text is too short", async () => {
    mockSearchText.value = "ab";
    const api = useSearchAvatar();

    await api.searchAvatar();

    expect(mockLookupAvatars).not.toHaveBeenCalled();
    expect(api.searchAvatarResults.value).toEqual([]);
  });

  it("paginates results by 10 items", () => {
    const api = useSearchAvatar();
    api.searchAvatarResults.value = Array.from({ length: 25 }, (_, i) => createAvatar(`avtr_${i}`, `Avatar ${i}`));
    api.searchAvatarPage.value = api.searchAvatarResults.value.slice(0, 10);

    api.moreSearchAvatar(1);
    expect(api.searchAvatarPageNum.value).toBe(1);
    expect(api.searchAvatarPage.value.map((x) => x.id)).toEqual(Array.from({ length: 10 }, (_, i) => `avtr_${i + 10}`));

    api.moreSearchAvatar(-1);
    expect(api.searchAvatarPageNum.value).toBe(0);
    expect(api.searchAvatarPage.value.map((x) => x.id)).toEqual(Array.from({ length: 10 }, (_, i) => `avtr_${i}`));
  });
});
