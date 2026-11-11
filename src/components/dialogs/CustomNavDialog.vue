<template>
  <Dialog :open="visible" @update:open="(open) => (open ? null : handleClose())">
    <DialogContent class="sm:min-w-180">
      <DialogHeader>
        <DialogTitle>{{ t("nav_menu.custom_nav.dialog_title") }}</DialogTitle>
      </DialogHeader>

      <div class="min-h-[40vh] max-h-[60vh] overflow-y-auto">
        <DragDropProvider @drag-start="onDragStart" @drag-over="onDragOver" @drag-end="onDragEnd">
          <Tree
            :items="treeItems"
            :get-key="getNavNodeKey"
            :get-children="getNavNodeChildren"
            :expanded="expandedKeys"
            class="gap-0.5 pr-3"
            @update:expanded="(val) => (expandedKeys = val)"
          >
            <template #default="{ flattenItems }">
              <template v-for="(item, idx) in flattenItems" :key="item._id">
                <template v-if="isPlaceholder(item)">
                  <div class="rounded-md border border-dashed border-muted-foreground/25 p-1.5 text-sm text-muted-foreground/50 mt-1">
                    {{ t("nav_menu.custom_nav.folder_drop_here") }}
                  </div>
                </template>
                <SortableTreeNode
                  v-else
                  :item="item"
                  :index="getSortableIndex(idx, flattenItems)"
                  :definitions-map="definitionsMap"
                  :drag-state="dragState"
                  @edit-folder="openFolderEditor"
                  @delete-folder="handleDeleteFolder"
                  @edit-dashboard="openDashboardEditor"
                  @delete-dashboard="handleDeleteDashboard"
                  @hide="handleHideItem"
                  @toggle="handleTreeToggle(item)"
                />
              </template>
            </template>
          </Tree>
        </DragDropProvider>

        <template v-if="hiddenItems.length">
          <div class="my-3 flex items-center gap-2 pr-3">
            <Separator class="flex-1" />
            <span class="text-xs text-muted-foreground">
              {{ t("nav_menu.custom_nav.hidden_items") }}
            </span>
            <Separator class="flex-1" />
          </div>
          <div class="flex flex-col gap-0.5 pr-3">
            <div
              v-for="item in hiddenItems"
              :key="item.key"
              class="group flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground"
              @click="handleShowItem(item.key)"
            >
              <span class="size-4 shrink-0" />
              <span class="size-4 shrink-0" />
              <i v-if="item.icon" :class="item.icon" class="text-base" />
              <span class="flex-1 truncate">{{ item.label }}</span>
              <Button size="icon-sm" variant="ghost" class="ml-auto size-6 shrink-0 opacity-0 group-hover:opacity-100" @click.stop="handleShowItem(item.key)">
                <Minus class="size-3.5" />
              </Button>
            </div>
          </div>
        </template>
      </div>

      <DialogFooter>
        <div class="flex w-full items-center justify-between">
          <div class="flex gap-2">
            <Button variant="outline" @click="handleAddFolder">
              {{ t("nav_menu.custom_nav.new_folder") }}
            </Button>
            <Button variant="outline" @click="handleAddDashboard">
              {{ t("dashboard.new_dashboard") }}
            </Button>
            <Button variant="ghost" class="text-destructive" @click="handleReset">
              {{ t("nav_menu.custom_nav.restore_default") }}
            </Button>
          </div>
          <div class="flex gap-2">
            <Button variant="secondary" @click="handleClose">
              {{ t("nav_menu.custom_nav.cancel") }}
            </Button>
            <Button @click="handleSave">
              {{ t("common.actions.confirm") }}
            </Button>
          </div>
        </div>
      </DialogFooter>
    </DialogContent>
  </Dialog>

  <Dialog v-model:open="folderEditor.visible">
    <DialogContent class="sm:max-w-100">
      <DialogHeader>
        <DialogTitle>
          {{ folderEditor.editorType === "dashboard" ? t("nav_menu.custom_nav.edit_dashboard") : t("nav_menu.custom_nav.edit_folder") }}
        </DialogTitle>
      </DialogHeader>
      <div class="flex flex-col gap-3">
        <InputGroupField v-model="folderEditor.data.name" :placeholder="t('nav_menu.custom_nav.folder_name_placeholder')" />
        <InputGroupField v-model="folderEditor.data.icon" :placeholder="t('nav_menu.custom_nav.folder_icon_placeholder')">
          <template #trailing>
            <HoverCard>
              <HoverCardTrigger as-child>
                <InputGroupButton size="icon-xs" :aria-label="t('nav_menu.custom_nav.folder_icon_placeholder')">
                  <LinkIcon class="size-3.5" />
                </InputGroupButton>
              </HoverCardTrigger>
              <HoverCardContent side="bottom" align="end" class="w-80">
                <div class="text-sm leading-snug">
                  <div>
                    Find the icon you want on this site and paste its class name here, e.g.
                    <span class="font-mono">ri-arrow-left-up-line</span>
                  </div>
                  <div class="mt-2">
                    <a class="cursor-pointer text-blue-600" @click.prevent="openExternalLink('https://remixicon.com/')"> https://remixicon.com/ </a>
                  </div>
                </div>
              </HoverCardContent>
            </HoverCard>
          </template>
        </InputGroupField>
      </div>
      <DialogFooter>
        <Button variant="secondary" @click="folderEditor.visible = false">
          {{ t("nav_menu.custom_nav.cancel") }}
        </Button>
        <Button :disabled="!folderEditor.data.name?.trim()" @click="handleFolderEditorSave">
          {{ t("common.actions.confirm") }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
import Dialog from "@/components/ui/dialog/Dialog.vue";
import DialogContent from "@/components/ui/dialog/DialogContent.vue";
import DialogFooter from "@/components/ui/dialog/DialogFooter.vue";
import DialogHeader from "@/components/ui/dialog/DialogHeader.vue";
import DialogTitle from "@/components/ui/dialog/DialogTitle.vue";
import { computed, reactive, ref, watch } from "vue";
import HoverCard from "@/components/ui/hover-card/HoverCard.vue";
import HoverCardContent from "@/components/ui/hover-card/HoverCardContent.vue";
import HoverCardTrigger from "@/components/ui/hover-card/HoverCardTrigger.vue";
import { Link as LinkIcon, Minus } from "lucide-vue-next";
import Button from "@/components/ui/button/Button.vue";
import { DragDropProvider } from "@dnd-kit/vue";
import { openExternalLink } from "@/shared/utils/app-actions";
import { useI18n } from "vue-i18n";

import dayjs from "dayjs";

import InputGroupButton from "../ui/input-group/InputGroupButton.vue";
import InputGroupField from "../ui/input-group/InputGroupField.vue";
import Separator from "../ui/separator/Separator.vue";
import Tree from "../ui/tree/Tree.vue";
import { isToolNavKey } from "../../shared/constants/tools";
import { navDefinitions } from "../../shared/constants/ui.ts";
import { DASHBOARD_NAV_KEY_PREFIX, DEFAULT_DASHBOARD_ICON } from "../../shared/constants/dashboard";
import { useDashboardStore } from "../../stores/dashboard";
import { useModalStore } from "../../stores/modal";

import SortableTreeNode from "./SortableTreeNode.vue";
import type { NavDefinition, NavLayoutEntry, NavLayoutItemEntry } from "../nav-menu/nav-menu-types";
import { isNavDefinition, isNavTreeEntry } from "./custom-nav-types";
import type { NavFlatItem, NavLayoutFolder, NavLayoutState, NavTreeEntry, NavTreeItemNode, NavTreePlaceholderNode } from "./custom-nav-types";
import { cloneLayout, isFolderEntry } from "./custom-nav-layout";
import { useCustomNavDrag } from "./use-custom-nav-drag";

type NavHiddenPlacement = {
  parentId: string | null;
  index: number;
};

type NavFolderEditor = {
  visible: boolean;
  isEditing: boolean;
  editingId: string | null;
  editorType: "folder" | "dashboard";
  data: {
    id: string;
    name: string;
    icon: string;
  };
};

const props = withDefaults(
  defineProps<{
    visible?: boolean;
    layout?: NavLayoutEntry[];
    hiddenKeys?: string[];
    defaultHiddenKeys?: string[];
    defaultLayout?: NavLayoutEntry[];
    definitions?: NavDefinition[];
  }>(),
  {
    visible: false,
    layout: () => [],
    hiddenKeys: () => [],
    defaultHiddenKeys: () => [],
    defaultLayout: () => [],
    definitions: () => [],
  }
);

const emit = defineEmits<{
  "update:visible": [value: boolean];
  save: [layout: NavLayoutEntry[], hiddenKeys: string[]];
  "dashboard-created": [dashboardId: string, layout: NavLayoutEntry[], hiddenKeys: string[]];
}>();
const { t } = useI18n();
const dashboardStore = useDashboardStore();
const modalStore = useModalStore();

const iconOrDefault = (icon: string, fallback: string) => {
  const trimmed = icon.trim();
  return trimmed ? trimmed : fallback;
};

const localLayout = ref<NavLayoutState[]>(cloneLayout(props.layout));
const hiddenKeySet = ref(new Set<string>());
const hiddenPlacement = ref(new Map<string, NavHiddenPlacement>());
const DEFAULT_FOLDER_ICON = "ri-folder-line";

const folderEditor = reactive<NavFolderEditor>({
  visible: false,
  isEditing: false,
  editingId: null,
  editorType: "folder",
  data: { id: "", name: "", icon: "" },
});

const createFolderId = () => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `custom-folder-${crypto.randomUUID()}`;
  }
  return `custom-folder-${dayjs().toISOString()}-${Math.random().toString().slice(2, 7)}`;
};

const expandedKeys = ref<string[]>([]);

const { dragState, onDragStart, onDragOver, onDragEnd } = useCustomNavDrag(localLayout, expandedKeys);

watch(
  () => props.visible,
  (isVisible) => {
    if (isVisible) {
      localLayout.value = cloneLayout(props.layout);
      hiddenKeySet.value = new Set(props.hiddenKeys);
      hiddenPlacement.value = new Map();
      expandedKeys.value = localLayout.value.filter(isFolderEntry).map((entry) => entry.id);
    }
  }
);

const builtInDefinitions: NavDefinition[] = navDefinitions.flatMap((definition) => (isNavDefinition(definition) ? [definition] : []));

const activeDefinitions = computed<NavDefinition[]>(() => (props.definitions.length ? props.definitions : builtInDefinitions));

const definitionsMap = computed(() => {
  const map = new Map<string, NavDefinition>();

  activeDefinitions.value.forEach((def) => {
    if (def.key) {
      map.set(def.key, def);
    }
  });
  return map;
});

const treeItems = computed<NavTreeEntry[]>(() => {
  return localLayout.value
    .map((entry): NavTreeEntry | null => {
      if (isFolderEntry(entry)) {
        const children = entry.items
          .map((key): NavTreeItemNode | null => {
            const def = definitionsMap.value.get(key);
            if (!def) return null;
            return { id: key, type: "item", key, level: 1, parentId: entry.id };
          })
          .filter((child): child is NavTreeItemNode => child !== null);

        const folderChildren: (NavTreeItemNode | NavTreePlaceholderNode)[] = children.length
          ? children
          : [{ id: `${entry.id}__placeholder`, _placeholder: true, level: 1 }];

        return {
          id: entry.id,
          type: "folder",
          name: entry.name,
          icon: entry.icon,
          level: 0,
          children: folderChildren,
        };
      }
      if (!definitionsMap.value.has(entry.key)) return null;
      return { id: entry.key, type: "item", key: entry.key, level: 0 };
    })
    .filter((node): node is NavTreeEntry => node !== null);
});

const hiddenItems = computed(() =>
  activeDefinitions.value
    .filter((def) => hiddenKeySet.value.has(def.key) && !isToolNavKey(def.key))
    .map((def) => ({
      key: def.key,
      icon: def.icon,
      label: def.isDashboard ? def.labelKey : t(def.labelKey),
    }))
);

const getNavNodeKey = (node: Record<string, unknown>) => (isNavTreeEntry(node) ? node.id : "");

const getNavNodeChildren = (node: Record<string, unknown>) => (isNavTreeEntry(node) && "children" in node ? node.children : undefined);

const isPlaceholder = (item: NavFlatItem | undefined) => Boolean(item && "_placeholder" in item.value);

const getSortableIndex = (originalIdx: number, flattenItems: NavFlatItem[]) => {
  let sortableIdx = 0;
  for (let i = 0; i < originalIdx; i++) {
    if (!isPlaceholder(flattenItems[i])) sortableIdx += 1;
  }
  return sortableIdx;
};

const handleHideItem = (key: string) => {
  if (isToolNavKey(key)) {
    removeFromLayout(key);
    return;
  }

  let placement: NavHiddenPlacement | null = null;
  for (const [index, entry] of localLayout.value.entries()) {
    if (entry.type === "item" && entry.key === key) {
      placement = { parentId: null, index };
      localLayout.value.splice(index, 1);
      break;
    }
    if (isFolderEntry(entry)) {
      const idx = entry.items.indexOf(key);
      if (idx >= 0) {
        placement = { parentId: entry.id, index: idx };
        entry.items.splice(idx, 1);
        break;
      }
    }
  }
  if (placement) {
    hiddenPlacement.value.set(key, placement);
  }
  hiddenKeySet.value.add(key);
  localLayout.value = [...localLayout.value];
};

const handleShowItem = (key: string) => {
  hiddenKeySet.value.delete(key);
  hiddenKeySet.value = new Set(hiddenKeySet.value);
  const placement = hiddenPlacement.value.get(key) ?? null;

  let isRestored = false;
  if (placement?.parentId) {
    const parentId = placement.parentId;
    const folder = localLayout.value.find((entry): entry is NavLayoutFolder => isFolderEntry(entry) && entry.id === parentId);
    if (folder) {
      const insertAt = Math.max(0, Math.min(placement.index, folder.items.length));
      folder.items.splice(insertAt, 0, key);
      isRestored = true;
    }
  }

  if (!isRestored && placement?.parentId === null) {
    const insertAt = Math.max(0, Math.min(placement.index, localLayout.value.length));
    localLayout.value.splice(insertAt, 0, { type: "item", key });
    isRestored = true;
  }

  if (!isRestored) {
    localLayout.value.push({ type: "item", key });
  }

  hiddenPlacement.value.delete(key);
  localLayout.value = [...localLayout.value];
};

const handleDeleteFolder = (folderId: string) => {
  const folder = localLayout.value.find((entry): entry is NavLayoutFolder => isFolderEntry(entry) && entry.id === folderId);
  if (!folder) return;
  const childItems = folder.items.map((key): NavLayoutItemEntry => ({ type: "item", key }));
  localLayout.value.splice(localLayout.value.indexOf(folder), 1, ...childItems);
  localLayout.value = [...localLayout.value];
};

const handleTreeToggle = (item: NavFlatItem) => {
  if (!isNavTreeEntry(item.value)) return;
  const id = item.value.id;
  if (!id) return;
  if (expandedKeys.value.includes(id)) {
    expandedKeys.value = expandedKeys.value.filter((k) => k !== id);
  } else {
    expandedKeys.value = [...expandedKeys.value, id];
  }
};

const openFolderEditor = (folderId: string) => {
  const entry = localLayout.value.find((e): e is NavLayoutFolder => isFolderEntry(e) && e.id === folderId);
  if (!entry) return;
  folderEditor.isEditing = true;
  folderEditor.editingId = folderId;
  folderEditor.editorType = "folder";
  folderEditor.data = { id: entry.id, name: entry.name, icon: entry.icon };
  folderEditor.visible = true;
};

const openDashboardEditor = (dashboardKey: string) => {
  const dashboardId = dashboardKey.replace(DASHBOARD_NAV_KEY_PREFIX, "");
  const dashboard = dashboardStore.getDashboard(dashboardId);
  if (!dashboard || !("name" in dashboard)) return;

  folderEditor.isEditing = true;
  folderEditor.editingId = dashboardKey;
  folderEditor.editorType = "dashboard";
  folderEditor.data = {
    id: dashboardKey,
    name: dashboard.name,
    icon: dashboard.icon || "",
  };
  folderEditor.visible = true;
};

const handleAddFolder = () => {
  folderEditor.isEditing = false;
  folderEditor.editingId = null;
  folderEditor.editorType = "folder";
  folderEditor.data = {
    id: createFolderId(),
    name: "",
    icon: "",
  };
  folderEditor.visible = true;
};

const handleAddDashboard = async () => {
  const dashboard = await dashboardStore.createDashboard(t("dashboard.default_name"));
  localLayout.value.push({
    type: "item",
    key: `${DASHBOARD_NAV_KEY_PREFIX}${dashboard.id}`,
  });
  localLayout.value = [...localLayout.value];
  emit("dashboard-created", dashboard.id, cloneLayout(localLayout.value), [...hiddenKeySet.value]);
};

const handleFolderEditorSave = async () => {
  if (!folderEditor.data.name.trim()) return;

  if (folderEditor.editorType === "dashboard") {
    const dashboardId = (folderEditor.editingId ?? "").replace(DASHBOARD_NAV_KEY_PREFIX, "");
    await dashboardStore.updateDashboard(dashboardId, {
      name: folderEditor.data.name.trim(),
      icon: iconOrDefault(folderEditor.data.icon, DEFAULT_DASHBOARD_ICON),
    });
  } else if (folderEditor.isEditing) {
    const entry = localLayout.value.find((e): e is NavLayoutFolder => isFolderEntry(e) && e.id === folderEditor.editingId);
    if (entry) {
      entry.name = folderEditor.data.name.trim();
      entry.nameKey = null;
      entry.icon = iconOrDefault(folderEditor.data.icon, DEFAULT_FOLDER_ICON);
      localLayout.value = [...localLayout.value];
    }
  } else {
    localLayout.value.push({
      type: "folder",
      id: folderEditor.data.id,
      name: folderEditor.data.name.trim(),
      nameKey: null,
      icon: iconOrDefault(folderEditor.data.icon, DEFAULT_FOLDER_ICON),
      items: [],
    });
    localLayout.value = [...localLayout.value];
    if (!expandedKeys.value.includes(folderEditor.data.id)) {
      expandedKeys.value = [...expandedKeys.value, folderEditor.data.id];
    }
  }
  folderEditor.visible = false;
};

const removeFromLayout = (key: string) => {
  let isRemoved = false;
  for (const [index, entry] of localLayout.value.entries()) {
    if (entry.type === "item" && entry.key === key) {
      localLayout.value.splice(index, 1);
      isRemoved = true;
      break;
    }
    if (isFolderEntry(entry)) {
      const idx = entry.items.indexOf(key);
      if (idx >= 0) {
        entry.items.splice(idx, 1);
        isRemoved = true;
      }
    }
  }
  if (isRemoved) {
    hiddenKeySet.value.delete(key);
    hiddenPlacement.value.delete(key);
    localLayout.value = [...localLayout.value];
  }
};

const handleDeleteDashboard = async (dashboardKey: string) => {
  const dashboardId = dashboardKey.replace(DASHBOARD_NAV_KEY_PREFIX, "");
  const { ok } = await modalStore.confirm({
    title: t("dashboard.confirmations.delete_title"),
    description: t("dashboard.confirmations.delete_description"),
    destructive: true,
  });
  if (!ok) {
    return;
  }
  await dashboardStore.deleteDashboard(dashboardId);
  removeFromLayout(dashboardKey);
};

const handleSave = () => {
  const cleanedLayout = localLayout.value.filter((entry) => !(isFolderEntry(entry) && entry.items.length === 0));
  emit("save", cloneLayout(cleanedLayout), [...hiddenKeySet.value]);
};

const handleReset = () => {
  localLayout.value = cloneLayout(props.defaultLayout);
  hiddenKeySet.value = new Set(props.defaultHiddenKeys);
  hiddenPlacement.value = new Map();
  expandedKeys.value = localLayout.value.filter(isFolderEntry).map((entry) => entry.id);
};

const handleClose = () => {
  emit("update:visible", false);
};
</script>
