<script setup lang="ts">
import DropdownMenu from "@/components/ui/dropdown-menu/DropdownMenu.vue";
import DropdownMenuContent from "@/components/ui/dropdown-menu/DropdownMenuContent.vue";
import DropdownMenuItem from "@/components/ui/dropdown-menu/DropdownMenuItem.vue";
import DropdownMenuTrigger from "@/components/ui/dropdown-menu/DropdownMenuTrigger.vue";
import { ChevronRight, Ellipsis, GripVertical } from "lucide-vue-next";
import { computed, ref } from "vue";
import Button from "@/components/ui/button/Button.vue";
import TreeItem from "@/components/ui/tree/TreeItem.vue";
import { useI18n } from "vue-i18n";
import { useSortable } from "@dnd-kit/vue/sortable";
import type { ComponentPublicInstance } from "vue";
import type { NavDefinition } from "../nav-menu/nav-menu-types";
import { isNavTreeEntry } from "./custom-nav-types";
import type { NavDragState, NavFlatItem, NavTreeEntry, NavTreeFolderNode } from "./custom-nav-types";

type SortableTreeItem = NavFlatItem & {
  hasChildren?: boolean;
  bind?: Record<string, unknown>;
};

const props = withDefaults(
  defineProps<{
    item: SortableTreeItem;
    index: number;
    definitionsMap: Map<string, NavDefinition>;
    dragState?: Partial<NavDragState>;
  }>(),
  {
    dragState: () => ({}),
  }
);

const emit = defineEmits<{
  editFolder: [id: string];
  deleteFolder: [id: string];
  editDashboard: [key: string];
  deleteDashboard: [key: string];
  hide: [key: string];
  toggle: [];
}>();

const { t } = useI18n();

const element = ref<ComponentPublicInstance | null>(null);

const isFolderNode = (node: NavTreeEntry): node is NavTreeFolderNode => "type" in node && node.type === "folder";

const nodeValue = computed<NavTreeEntry>(() => {
  const value = props.item.value;
  if (!isNavTreeEntry(value)) {
    throw new Error("custom nav tree item is missing its id or level");
  }
  return value;
});
const isFolder = computed(() => isFolderNode(nodeValue.value));
const nodeKey = computed(() => ("key" in nodeValue.value ? nodeValue.value.key : nodeValue.value.id));
const isDashboard = computed(() => {
  return !isFolder.value && nodeKey.value.startsWith("dashboard-");
});
const isTool = computed(() => {
  return !isFolder.value && nodeKey.value.startsWith("tool-");
});
const hasChildren = computed(() => props.item.hasChildren);
const level = computed(() => nodeValue.value.level);

const { isDragSource } = useSortable({
  id: nodeKey,
  index: computed(() => props.index),
  element,
});

const displayLabel = computed(() => {
  const value = nodeValue.value;
  if (isFolderNode(value)) {
    return value.name.trim() || t("nav_menu.custom_nav.folder_name_placeholder");
  }
  const def = props.definitionsMap.get(nodeKey.value);
  if (!def) {
    return nodeKey.value || "";
  }
  return def.isDashboard ? def.labelKey : t(def.labelKey);
});

const displayIcon = computed(() => {
  const value = nodeValue.value;
  if (isFolderNode(value)) {
    return value.icon || "ri-folder-line";
  }
  const def = props.definitionsMap.get(nodeKey.value);
  return def?.icon ?? "";
});

const isDropHighlighted = computed(() => {
  if (!props.dragState.active) return false;
  if (!isFolder.value) return false;
  return props.dragState.overTargetId === nodeKey.value && props.dragState.overIsFolder;
});
</script>

<template>
  <TreeItem
    ref="element"
    :value="item.value"
    :level="level"
    v-bind="item.bind"
    class="group select-none cursor-grab active:cursor-grabbing"
    :class="[
      isDragSource ? 'opacity-40' : '',
      isFolder ? 'bg-muted/50 border-l-primary/60 border-l-2 font-semibold' : '',
      level > 0 ? 'text-muted-foreground' : '',
      isDropHighlighted ? 'ring-primary/50 bg-primary/10 ring-2' : '',
    ]"
  >
    <template #default="{ isExpanded }">
      <GripVertical class="size-4 shrink-0 text-muted-foreground opacity-50 group-hover:opacity-100" />

      <button
        v-if="hasChildren"
        type="button"
        class="flex size-4 shrink-0 items-center justify-center rounded transition-transform cursor-pointer"
        :class="isExpanded ? 'rotate-90' : ''"
        @click.stop="emit('toggle')"
      >
        <ChevronRight class="size-3.5" />
      </button>
      <span v-else class="size-4 shrink-0" />

      <i v-if="displayIcon" :class="displayIcon" class="text-base" />

      <span class="flex-1 truncate text-sm">{{ displayLabel }}</span>

      <DropdownMenu>
        <DropdownMenuTrigger as-child>
          <Button
            size="icon-sm"
            variant="ghost"
            :aria-label="t('nav_tooltip.manage')"
            class="ml-auto size-6 shrink-0 opacity-0 group-hover:opacity-100"
            @click.stop
          >
            <Ellipsis class="size-3.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <template v-if="isFolder">
            <DropdownMenuItem @click="emit('editFolder', nodeValue.id)">
              {{ t("nav_menu.custom_nav.edit_folder") }}
            </DropdownMenuItem>
            <DropdownMenuItem class="text-destructive" @click="emit('deleteFolder', nodeValue.id)">
              {{ t("nav_menu.custom_nav.delete_folder") }}
            </DropdownMenuItem>
          </template>
          <template v-else-if="isDashboard">
            <DropdownMenuItem @click="emit('editDashboard', nodeKey)">
              {{ t("nav_menu.custom_nav.edit_dashboard") }}
            </DropdownMenuItem>
            <DropdownMenuItem class="text-destructive" @click="emit('deleteDashboard', nodeKey)">
              {{ t("nav_menu.custom_nav.delete_dashboard") }}
            </DropdownMenuItem>
          </template>
          <template v-else>
            <DropdownMenuItem @click="emit('hide', nodeKey)">
              {{ isTool ? t("common.actions.delete") : t("nav_menu.custom_nav.hide") }}
            </DropdownMenuItem>
          </template>
        </DropdownMenuContent>
      </DropdownMenu>
    </template>
  </TreeItem>
</template>
