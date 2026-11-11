<script setup lang="ts">
import { nextTick, watch } from "vue";
import { useCommand } from "@/components/ui/command";

import { useQuickSearchStore } from "../stores/quick-search";

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

<template>
  <span v-if="false" />
</template>
