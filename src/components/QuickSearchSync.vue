<script>
export default {
  render: () => null,
};
</script>

<script setup>
import { nextTick, watch } from "vue";
import { useCommand } from "@/components/ui/command";

import { useQuickSearchStore } from "../stores/quickSearch";

const { filterState, allItems, allGroups } = useCommand();
const quickSearchStore = useQuickSearchStore();

function overrideFilter() {
  for (const id of allItems.value.keys()) {
    filterState.filtered.items.set(id, 1);
  }
  filterState.filtered.count = allItems.value.size;
  for (const groupId of allGroups.value.keys()) {
    filterState.filtered.groups.add(groupId);
  }
}

async function syncVisibleResults() {
  if (!filterState.search) return;

  await nextTick();
  overrideFilter();
}

watch(
  () => filterState.search,
  async (value) => {
    quickSearchStore.setQuery(value);

    await syncVisibleResults();
  }
);

watch([() => allItems.value.size, () => allGroups.value.size], async () => {
  await syncVisibleResults();
});
</script>
