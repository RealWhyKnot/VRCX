import { beforeEach, describe, expect, it, vi } from "vitest";
import { ref } from "vue";
import type { SearchUsers } from "vrchat";

type SearchUserParams = NonNullable<SearchUsers["query"]> & { n: number; offset: number };

const mockSearchText = ref("");
const mockMoreSearchUser = vi.fn<(go: number | null, params: SearchUserParams) => Promise<void>>(() => Promise.resolve());

vi.mock("pinia", () => ({
  storeToRefs: (store: unknown) => store,
}));

vi.mock("../../../../src/stores/search", () => ({
  useSearchStore: () => ({
    searchText: mockSearchText,
    moreSearchUser: mockMoreSearchUser,
  }),
}));

import { useSearchUser } from "../../../../src/views/Search/composables/use-search-user";

describe("useSearchUser", () => {
  beforeEach(() => {
    mockSearchText.value = "";
    mockMoreSearchUser.mockReset();
    mockMoreSearchUser.mockResolvedValue(undefined);
  });

  it("passes page direction into handleMoreSearchUser", async () => {
    const api = useSearchUser();
    api.searchUserParams.value = {
      n: 10,
      offset: 10,
      search: "Alice",
      customFields: "displayName",
      sort: "relevance",
    };

    await api.handleMoreSearchUser(-1);

    expect(mockMoreSearchUser).toHaveBeenCalledWith(-1, api.searchUserParams.value);
  });
});
