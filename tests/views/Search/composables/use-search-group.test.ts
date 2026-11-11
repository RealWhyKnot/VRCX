import { beforeEach, describe, expect, it, vi } from "vitest";
import { ref } from "vue";
import type { SearchGroups } from "vrchat";

type SearchGroupParams = NonNullable<SearchGroups["query"]>;

const mockSearchText = ref("");
const mockReplaceBioSymbols = vi.fn<(text: string) => string>((text) => text);
const mockGroupSearch = vi.fn<(params: SearchGroupParams) => Promise<{ json: never[] }>>();

vi.mock("pinia", () => ({
  storeToRefs: (store: unknown) => store,
}));

vi.mock("../../../../src/stores/search", () => ({
  useSearchStore: () => ({
    searchText: mockSearchText,
  }),
}));

vi.mock("../../../../src/shared/utils/base/string", () => ({
  replaceBioSymbols: (text: string) => mockReplaceBioSymbols(text),
}));

vi.mock("../../../../src/api/group", () => ({
  groupRequest: {
    groupSearch: (params: SearchGroupParams) => mockGroupSearch(params),
  },
}));

import { useSearchGroup } from "../../../../src/views/Search/composables/use-search-group";

describe("useSearchGroup", () => {
  beforeEach(() => {
    mockSearchText.value = "";
    mockReplaceBioSymbols.mockReset();
    mockReplaceBioSymbols.mockImplementation((text) => text);
    mockGroupSearch.mockReset();
  });

  it("moves backward paging offset without going below zero", async () => {
    mockGroupSearch.mockResolvedValue({ json: [] });
    const api = useSearchGroup();
    api.searchGroupParams.value = { n: 10, offset: 5, query: "abc" };

    await api.moreSearchGroup(-1);

    expect(mockGroupSearch).toHaveBeenCalledWith({
      n: 10,
      offset: 0,
      query: "abc",
    });
  });
});
