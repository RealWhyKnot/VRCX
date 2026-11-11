<script setup lang="ts">
import type { ClassValue } from "clsx";
import type { ListboxItemEmits, ListboxItemProps, PrimitiveProps } from "reka-ui";
import { computed, onMounted, onUnmounted, ref } from "vue";
import { ListboxItem, useForwardPropsEmits, useId } from "reka-ui";
import { reactiveOmit, useCurrentElement } from "@vueuse/core";
import { cn } from "@/lib/utils";

import { useCommand, useCommandGroup } from ".";

const props = withDefaults(
  defineProps<{
    value: ListboxItemProps["value"];
    disabled?: boolean;
    asChild?: boolean;
    as?: PrimitiveProps["as"] | undefined;
    class?: ClassValue | undefined;
  }>(),
  {
    as: undefined,
    class: undefined,
  }
);
const emits = defineEmits<ListboxItemEmits>();

const delegatedProps: Record<string, unknown> = reactiveOmit(props, "class");

const forwarded = useForwardPropsEmits(delegatedProps, emits);

const id = useId();
const { filterState, allItems, allGroups } = useCommand();
const groupContext = useCommandGroup();

const isRender = computed(() => {
  if (!filterState.search) {
    return true;
  } else {
    const filteredCurrentItem = filterState.filtered.items.get(id);

    if (filteredCurrentItem === undefined) {
      return true;
    }

    return filteredCurrentItem > 0;
  }
});

const itemRef = ref();
const currentElement = useCurrentElement(itemRef);
onMounted(() => {
  if (!(currentElement.value instanceof HTMLElement)) return;

  allItems.value.set(id, currentElement.value.textContent);

  const groupId = groupContext?.id;
  if (groupId) {
    if (!allGroups.value.has(groupId)) {
      allGroups.value.set(groupId, new Set([id]));
    } else {
      allGroups.value.get(groupId)?.add(id);
    }
  }
});
onUnmounted(() => {
  allItems.value.delete(id);
});
</script>

<template>
  <ListboxItem
    v-if="isRender"
    v-bind="forwarded"
    :id="id"
    ref="itemRef"
    :value="props.value"
    data-slot="command-item"
    :class="
      cn(
        'data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground [&_svg:not([class*=\'text-\'])]:text-muted-foreground relative flex cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-hidden select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*=\'size-\'])]:size-4',
        props.class
      )
    "
    @select="
      () => {
        filterState.search = '';
      }
    "
  >
    <slot />
  </ListboxItem>
</template>
