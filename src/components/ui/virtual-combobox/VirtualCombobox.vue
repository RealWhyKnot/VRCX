<template>
  <Popover v-model:open="isOpen">
    <PopoverTrigger as-child>
      <Button variant="outline" role="combobox" class="w-full justify-between" :disabled="disabled">
        <slot name="trigger" :text="selectionSummaryText" :clear="clearSelection">
          <span class="truncate">
            {{ selectionSummaryText || placeholder }}
          </span>
        </slot>

        <div class="flex items-center gap-1">
          <button
            v-if="clearable && selectedValueSet.size > 0"
            type="button"
            class="flex items-center justify-center rounded-sm opacity-50 hover:opacity-100 cursor-pointer"
            @click.stop.prevent="clearSelection"
          >
            <X class="size-3.5" />
          </button>
          <span class="opacity-60">▾</span>
        </div>
      </Button>
    </PopoverTrigger>

    <PopoverContent class="w-(--reka-popover-trigger-width) p-2">
      <Input v-if="searchable" v-model="searchText" :placeholder="searchPlaceholder" class="mb-2" />

      <div
        ref="scrollContainerRef"
        class="max-h-(--combobox-max-height) overflow-auto rounded-md border"
        :style="{ '--combobox-max-height': `${maxHeight}px` }"
      >
        <div class="relative h-(--combobox-total-size)" :style="{ '--combobox-total-size': `${virtualizer.getTotalSize()}px` }">
          <template v-for="virtualRow in virtualizer.getVirtualItems()" :key="String(virtualRow.key)">
            <div
              class="absolute left-0 top-0 w-full [transform:translateY(var(--combobox-row-start))]"
              :style="{ '--combobox-row-start': `${virtualRow.start}px` }"
            >
              <template v-for="entry in [virtualListEntries[virtualRow.index]]" :key="entry?.key">
                <template v-if="entry?.type === 'group'">
                  <div
                    class="px-2 text-xs font-medium opacity-70 flex items-center h-(--combobox-group-height)"
                    :style="{ '--combobox-group-height': `${groupHeaderHeight}px` }"
                  >
                    <slot name="group" :group="entry.group">
                      {{ entry.group.label }}
                    </slot>
                  </div>
                </template>

                <template v-else-if="entry?.type === 'item'">
                  <button
                    type="button"
                    class="flex w-full items-center gap-2 px-2 text-left cursor-pointer h-(--combobox-item-height)"
                    :style="{ '--combobox-item-height': `${itemHeight}px` }"
                    @click="toggleSelection(entry.value)"
                  >
                    <slot name="item" :item="entry.item" :selected="selectedValueSet.has(entry.value)">
                      <span class="truncate text-sm">
                        {{ entry.item.label }}
                      </span>
                      <span v-if="selectedValueSet.has(entry.value)" class="ml-auto opacity-70"> ✓ </span>
                    </slot>
                  </button>
                </template>
              </template>
            </div>
          </template>

          <div v-if="virtualListEntries.length === 0" class="p-3 text-sm opacity-70">
            <slot name="empty">Nothing found</slot>
          </div>
        </div>
      </div>
    </PopoverContent>
  </Popover>
</template>

<script setup lang="ts">
import { computed, ref, shallowRef, watch } from "vue";
import Popover from "@/components/ui/popover/Popover.vue";
import PopoverContent from "@/components/ui/popover/PopoverContent.vue";
import PopoverTrigger from "@/components/ui/popover/PopoverTrigger.vue";
import Button from "@/components/ui/button/Button.vue";
import Input from "@/components/ui/input/Input.vue";
import { X } from "lucide-vue-next";
import { useVirtualizer } from "@tanstack/vue-virtual";

defineOptions({ name: "UiVirtualCombobox" });

type VirtualComboboxItem = {
  value: string | number;
  label?: string;
  search?: string;
};

type VirtualComboboxGroup = {
  key?: string | number;
  label?: string;
  items?: VirtualComboboxItem[];
};

type VirtualComboboxValue = string | number | (string | number)[] | null;

type VirtualComboboxEntry =
  | {
      type: "group";
      key: string;
      group: VirtualComboboxGroup;
    }
  | {
      type: "item";
      key: string;
      group: VirtualComboboxGroup;
      item: VirtualComboboxItem;
      value: string;
    };

const props = withDefaults(
  defineProps<{
    modelValue?: VirtualComboboxValue;
    groups?: VirtualComboboxGroup[];

    multiple?: boolean;
    disabled?: boolean;
    clearable?: boolean;

    placeholder?: string;
    searchPlaceholder?: string;

    searchable?: boolean;

    maxHeight?: number;
    itemHeight?: number;
    groupHeaderHeight?: number;

    closeOnSelect?: boolean;
    deselectOnReselect?: boolean;
  }>(),
  {
    modelValue: null,
    groups: () => [],
    multiple: false,
    disabled: false,
    clearable: true,
    placeholder: "Select…",
    searchPlaceholder: "Search…",
    searchable: true,
    maxHeight: 320,
    itemHeight: 40,
    groupHeaderHeight: 28,
    closeOnSelect: false,
    deselectOnReselect: false,
  }
);

const emit = defineEmits<{
  "update:modelValue": [value: VirtualComboboxValue];
  change: [value: VirtualComboboxValue];
  clear: [];
}>();

const isOpen = ref(false);
const searchText = ref("");
const scrollContainerRef = shallowRef<HTMLElement | null>(null);

const normalizedGroups = computed(() => props.groups);

const selectedValueSet = computed(() => {
  if (props.multiple) {
    const values = Array.isArray(props.modelValue) ? props.modelValue : [];
    return new Set(values.map(String));
  }
  return new Set(props.modelValue != null ? [String(props.modelValue)] : []);
});

const virtualListEntries = computed(() => {
  const normalizedSearch = props.searchable ? searchText.value.toLowerCase().trim() : "";

  const entries: VirtualComboboxEntry[] = [];

  for (const group of normalizedGroups.value) {
    const groupItems = Array.isArray(group.items) ? group.items : [];

    const filteredItems = normalizedSearch
      ? groupItems.filter((item) => (item.search ?? item.label ?? "").toLowerCase().includes(normalizedSearch))
      : groupItems;

    if (!filteredItems.length) continue;

    const selected: VirtualComboboxItem[] = [];
    const unselected: VirtualComboboxItem[] = [];
    for (const item of filteredItems) {
      if (selectedValueSet.value.has(String(item.value))) {
        selected.push(item);
      } else {
        unselected.push(item);
      }
    }
    const sortedItems = [...selected, ...unselected];

    entries.push({
      type: "group",
      key: `group:${group.key ?? ""}`,
      group,
    });

    for (const item of sortedItems) {
      entries.push({
        type: "item",
        key: `item:${group.key ?? ""}:${item.value}`,
        group,
        item,
        value: String(item.value),
      });
    }
  }

  return entries;
});

const selectionSummaryText = computed(() => {
  const selectedValues = Array.from(selectedValueSet.value);
  if (!selectedValues.length) return "";

  const valueToLabelMap = new Map<string, string | undefined>();

  for (const group of normalizedGroups.value) {
    for (const item of group.items ?? []) {
      valueToLabelMap.set(String(item.value), item.label);
    }
  }

  const visibleLabels = selectedValues.slice(0, 3).map((value) => valueToLabelMap.get(value) ?? value);

  return selectedValues.length <= 3 ? visibleLabels.join(", ") : `${visibleLabels.join(", ")} +${selectedValues.length - 3}`;
});

function toggleSelection(value: string) {
  if (props.multiple) {
    const current = Array.isArray(props.modelValue) ? props.modelValue.map(String) : [];

    const next = current.includes(value) ? current.filter((v) => v !== value) : [...current, value];

    emit("update:modelValue", next);
    emit("change", next);
  } else {
    if (props.deselectOnReselect && selectedValueSet.value.has(value)) {
      clearSelection();
      if (props.closeOnSelect) {
        isOpen.value = false;
      }
      return;
    }
    emit("update:modelValue", value);
    emit("change", value);

    if (props.closeOnSelect) {
      isOpen.value = false;
    }
  }
}

function clearSelection() {
  const nextValue: VirtualComboboxValue = props.multiple ? [] : null;
  emit("update:modelValue", nextValue);
  emit("clear");
  emit("change", nextValue);
}

const virtualizer = useVirtualizer(
  computed(() => ({
    count: virtualListEntries.value.length,
    getScrollElement: () => scrollContainerRef.value,
    estimateSize: (index: number) => (virtualListEntries.value[index]?.type === "group" ? props.groupHeaderHeight : props.itemHeight),
    overscan: 10,
  }))
);

watch(searchText, () => {
  virtualizer.value.scrollToOffset(0);
});
</script>
