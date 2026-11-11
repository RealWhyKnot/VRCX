<script setup lang="ts">
import type { ClassValue } from "clsx";
import type { ListboxRootEmits, ListboxRootProps, PrimitiveProps } from "reka-ui";
import { ListboxRoot, useFilter, useForwardPropsEmits } from "reka-ui";
import { reactive, ref, watch } from "vue";
import { cn } from "@/lib/utils";
import { reactiveOmit } from "@vueuse/core";

import type { CommandFilterState } from ".";
import { provideCommandContext } from ".";

defineOptions({ name: "UiCommand" });

const props = withDefaults(
  defineProps<{
    modelValue?: ListboxRootProps["modelValue"] | undefined;
    defaultValue?: ListboxRootProps["defaultValue"] | undefined;
    multiple?: boolean;
    orientation?: ListboxRootProps["orientation"] | undefined;
    dir?: ListboxRootProps["dir"] | undefined;
    disabled?: boolean;
    selectionBehavior?: ListboxRootProps["selectionBehavior"] | undefined;
    highlightOnHover?: boolean;
    by?: ListboxRootProps["by"] | undefined;
    asChild?: boolean;
    as?: PrimitiveProps["as"] | undefined;
    name?: string | undefined;
    required?: boolean;
    class?: ClassValue | undefined;
  }>(),
  {
    modelValue: "",
    defaultValue: undefined,
    orientation: undefined,
    dir: undefined,
    selectionBehavior: undefined,
    by: undefined,
    as: undefined,
    name: undefined,
    class: undefined,
  }
);

const emits = defineEmits<ListboxRootEmits>();

const delegatedProps: Record<string, unknown> = reactiveOmit(props, "class");

const forwarded = useForwardPropsEmits(delegatedProps, emits);

const allItems = ref(new Map<string, string>());
const allGroups = ref(new Map<string, Set<string>>());

const { contains } = useFilter({ sensitivity: "base" });
const filterState = reactive<CommandFilterState>({
  search: "",
  filtered: {
    count: 0,

    items: new Map(),

    groups: new Set(),
  },
});

function filterItems() {
  if (!filterState.search) {
    filterState.filtered.count = allItems.value.size;

    return;
  }

  filterState.filtered.groups = new Set();
  let itemCount = 0;

  for (const [id, value] of allItems.value) {
    const isMatch = contains(value, filterState.search);
    filterState.filtered.items.set(id, isMatch ? 1 : 0);
    if (isMatch) itemCount++;
  }

  for (const [groupId, group] of allGroups.value) {
    for (const itemId of group) {
      if ((filterState.filtered.items.get(itemId) ?? 0) > 0) {
        filterState.filtered.groups.add(groupId);
        break;
      }
    }
  }

  filterState.filtered.count = itemCount;
}

watch(
  () => filterState.search,
  () => {
    filterItems();
  }
);

provideCommandContext({
  allItems,
  allGroups,
  filterState,
});
</script>

<template>
  <ListboxRoot
    data-slot="command"
    v-bind="forwarded"
    :class="cn('bg-popover text-popover-foreground flex h-full w-full flex-col overflow-hidden rounded-md', props.class)"
  >
    <slot />
  </ListboxRoot>
</template>
