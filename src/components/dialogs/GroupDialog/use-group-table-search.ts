import { computed } from "vue";
import type { TableFilter } from "../../../types/vrcx";

export function useGroupTableSearch(getFilters: () => TableFilter[] | undefined) {
  const searchText = computed({
    get: () => {
      const value = getFilters()?.[0]?.value;
      return typeof value === "string" || typeof value === "number" ? String(value) : "";
    },
    set: (value: string | number) => {
      const filter = getFilters()?.[0];
      if (filter) {
        filter.value = value;
      }
    },
  });

  const searchQuery = computed(() => searchText.value.trim().toLowerCase());

  return { searchText, searchQuery };
}
