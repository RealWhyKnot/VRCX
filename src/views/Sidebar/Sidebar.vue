<template>
  <div class="x-aside-container">
    <div style="display: flex; align-items: baseline">
      <div class="search-container p-2 pl-0" style="flex: 1">
        <button
          type="button"
          class="border-input dark:bg-input/30 flex h-9 w-full items-center gap-2 rounded-md border bg-transparent px-3 shadow-xs transition-[color,box-shadow] hover:border-ring cursor-pointer overflow-hidden"
          @click="openQuickSearch"
        >
          <Search class="size-4 shrink-0 opacity-50" />
          <span class="search-text flex-1 min-w-0 text-left text-sm text-muted-foreground truncate">{{ t("side_panel.search_placeholder") }}</span>
          <Kbd class="search-kbd shrink-0">{{ isMac ? "⌘" : "Ctrl" }}</Kbd>
          <Kbd class="search-kbd shrink-0">K</Kbd>
        </button>
      </div>
      <div class="flex items-center mx-1 gap-1">
        <TooltipWrapper side="bottom" :content="t('side_panel.refresh_tooltip')">
          <Button
            class="rounded-full"
            variant="ghost"
            size="icon-sm"
            :disabled="isRefreshFriendsLoading"
            :aria-label="t('side_panel.refresh_tooltip')"
            @click="runRefreshFriendsListFlow"
          >
            <Spinner v-if="isRefreshFriendsLoading" />
            <RefreshCw v-else />
          </Button>
        </TooltipWrapper>
        <ContextMenu v-if="hasUnseenNotifications">
          <ContextMenuTrigger as-child>
            <TooltipWrapper side="bottom" :content="t('side_panel.notification_center.title')">
              <Button
                class="rounded-full relative"
                variant="ghost"
                size="icon-sm"
                :aria-label="t('side_panel.notification_center.title')"
                @click="isNotificationCenterOpen = !isNotificationCenterOpen"
              >
                <Bell />
                <span class="absolute top-1 right-1.25 size-1.5 rounded-full bg-red-500" />
              </Button>
            </TooltipWrapper>
          </ContextMenuTrigger>
          <ContextMenuContent>
            <ContextMenuItem @click="markNotificationsRead">
              {{ t("nav_menu.mark_all_read") }}
            </ContextMenuItem>
          </ContextMenuContent>
        </ContextMenu>
        <TooltipWrapper v-else side="bottom" :content="t('side_panel.notification_center.title')">
          <Button
            class="rounded-full relative"
            variant="ghost"
            size="icon-sm"
            :aria-label="t('side_panel.notification_center.title')"
            @click="isNotificationCenterOpen = !isNotificationCenterOpen"
            @contextmenu.prevent="toast.info(t('side_panel.notification_center.no_unseen_notifications'))"
          >
            <Bell />
          </Button>
        </TooltipWrapper>
        <Popover v-model:open="isSettingsPopoverOpen">
          <PopoverTrigger as-child>
            <Button class="rounded-full" variant="ghost" size="icon-sm" :aria-label="t('nav_tooltip.settings')">
              <Settings />
            </Button>
          </PopoverTrigger>
          <PopoverContent side="bottom" align="end" class="w-64 p-3" @open-auto-focus.prevent>
            <div class="flex flex-col gap-2.5 text-xs">
              <span class="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
                {{ t("side_panel.settings.display") }}
              </span>
              <Field orientation="horizontal">
                <FieldLabel>{{ t("side_panel.settings.group_by_instance") }}</FieldLabel>
                <Switch
                  :model-value="isSidebarGroupByInstance"
                  :aria-label="t('side_panel.settings.group_by_instance')"
                  @update:model-value="setIsSidebarGroupByInstance"
                />
              </Field>
              <Field v-if="isSidebarGroupByInstance" orientation="horizontal">
                <FieldLabel>{{ t("side_panel.settings.hide_friends_in_same_instance") }}</FieldLabel>
                <Switch
                  :model-value="isHideFriendsInSameInstance"
                  :aria-label="t('side_panel.settings.hide_friends_in_same_instance')"
                  @update:model-value="setIsHideFriendsInSameInstance"
                />
              </Field>
              <Field v-if="isSidebarGroupByInstance" orientation="horizontal">
                <FieldLabel>{{ t("side_panel.settings.same_instance_above_favorites") }}</FieldLabel>
                <Switch
                  :model-value="isSameInstanceAboveFavorites"
                  :aria-label="t('side_panel.settings.same_instance_above_favorites')"
                  @update:model-value="setIsSameInstanceAboveFavorites"
                />
              </Field>
              <Field orientation="horizontal">
                <FieldLabel>{{ t("side_panel.settings.split_favorite_friends") }}</FieldLabel>
                <Switch
                  :model-value="isSidebarDivideByFriendGroup"
                  :aria-label="t('side_panel.settings.split_favorite_friends')"
                  @update:model-value="setIsSidebarDivideByFriendGroup"
                />
              </Field>
              <Field orientation="horizontal">
                <FieldLabel>{{ t("view.settings.appearance.appearance.show_cosmetics") }}</FieldLabel>
                <Switch
                  :model-value="sidebarCosmetics"
                  :aria-label="t('view.settings.appearance.appearance.show_cosmetics')"
                  @update:model-value="setSidebarCosmetics"
                />
              </Field>

              <Separator />

              <Collapsible v-model:open="isAdvancedOpen">
                <CollapsibleTrigger as-child>
                  <button
                    type="button"
                    class="flex w-full items-center justify-between py-0.5 text-[11px] font-medium text-muted-foreground uppercase tracking-wide cursor-pointer hover:text-foreground transition-colors cursor-pointer"
                  >
                    {{ t("side_panel.settings.advanced") }}
                    <ChevronDown class="size-3.5 transition-transform duration-200" :class="{ 'rotate-180': isAdvancedOpen }" />
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div class="flex flex-col gap-2.5 pt-2.5">
                    <span class="text-[10px] font-medium text-muted-foreground/70 uppercase tracking-wide">
                      {{ t("side_panel.settings.sorting") }}
                    </span>
                    <Field>
                      <FieldContent>
                        <Select :model-value="sidebarSortMethod1" @update:model-value="(v) => setSidebarSortMethod1(toSortMethod(v))">
                          <SelectTrigger size="sm">
                            <SelectValue :placeholder="t('view.settings.appearance.side_panel.sorting.placeholder')" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem v-for="opt in sortOptions" :key="opt.value" :value="opt.value">
                              {{ opt.label }}
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </FieldContent>
                    </Field>
                    <Field>
                      <FieldLabel>{{ t("side_panel.settings.sort_secondary") }}</FieldLabel>
                      <FieldContent>
                        <Select
                          :model-value="sidebarSortMethod2"
                          :disabled="!sidebarSortMethod1"
                          @update:model-value="(v) => setSidebarSortMethod2(v === CLEAR_VALUE ? '' : toSortMethod(v))"
                        >
                          <SelectTrigger size="sm">
                            <SelectValue :placeholder="t('view.settings.appearance.side_panel.sorting.placeholder')" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem :value="CLEAR_VALUE">{{ t("dialog.gallery_select.none") }}</SelectItem>
                            <SelectItem v-for="opt in sortOptions" :key="opt.value" :value="opt.value">
                              {{ opt.label }}
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </FieldContent>
                    </Field>
                    <Field>
                      <FieldLabel>{{ t("side_panel.settings.sort_tertiary") }}</FieldLabel>
                      <FieldContent>
                        <Select
                          :model-value="sidebarSortMethod3"
                          :disabled="!sidebarSortMethod2"
                          @update:model-value="(v) => setSidebarSortMethod3(v === CLEAR_VALUE ? '' : toSortMethod(v))"
                        >
                          <SelectTrigger size="sm">
                            <SelectValue :placeholder="t('view.settings.appearance.side_panel.sorting.placeholder')" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem :value="CLEAR_VALUE">{{ t("dialog.gallery_select.none") }}</SelectItem>
                            <SelectItem v-for="opt in sortOptions" :key="opt.value" :value="opt.value">
                              {{ opt.label }}
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </FieldContent>
                    </Field>

                    <Separator />

                    <span class="text-[10px] font-medium text-muted-foreground/70 uppercase tracking-wide">
                      {{ t("side_panel.settings.favorites_section") }}
                    </span>
                    <Field>
                      <FieldLabel>{{ t("side_panel.settings.favorite_groups") }}</FieldLabel>
                      <FieldContent>
                        <Select :model-value="resolvedSidebarFavoriteGroups" multiple @update:model-value="handleFavoriteGroupsChange">
                          <SelectTrigger size="sm" class="w-full overflow-hidden">
                            <SelectValue :placeholder="t('side_panel.settings.favorite_groups_placeholder')">
                              <template v-if="resolvedSidebarFavoriteGroups.length">
                                <span class="truncate">{{ selectedFavGroupLabel }}</span>
                                <span v-if="resolvedSidebarFavoriteGroups.length > 1" class="bg-primary text-primary-foreground shrink-0 rounded px-1 text-xs">
                                  +{{ resolvedSidebarFavoriteGroups.length - 1 }}
                                </span>
                              </template>
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectGroup>
                              <SelectItem v-for="group in favoriteFriendGroups" :key="group.key" :value="group.key">
                                {{ group.displayName }}
                              </SelectItem>
                            </SelectGroup>
                            <template v-if="localFriendFavoriteGroups.length">
                              <SelectSeparator />
                              <SelectGroup>
                                <SelectItem v-for="group in localFriendFavoriteGroups" :key="'local:' + group" :value="'local:' + group">
                                  {{ group }}
                                </SelectItem>
                              </SelectGroup>
                            </template>
                          </SelectContent>
                        </Select>
                      </FieldContent>
                    </Field>
                    <Button
                      v-if="isSidebarDivideByFriendGroup"
                      variant="outline"
                      size="sm"
                      class="w-full text-sm"
                      @click="
                        isSettingsPopoverOpen = false;
                        isGroupOrderDialogOpen = true;
                      "
                    >
                      {{ t("side_panel.settings.edit_group_order") }}
                    </Button>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </div>
    <TabsUnderline
      default-value="friends"
      :items="sidebarTabs"
      :unmount-on-hide="false"
      variant="equal"
      fill
      class="zero-margin-tabs"
      style="height: calc(100% - 70px); margin-top: 6px"
    >
      <template #label-friends>
        <span>{{ t("side_panel.friends") }}</span>
        <span class="sidebar-tab-count"> ({{ onlineFriendCount }}/{{ friends.size }}) </span>
      </template>
      <template #label-groups>
        <span>{{ t("side_panel.groups") }}</span>
        <span class="sidebar-tab-count"> ({{ groupInstances.length }}) </span>
      </template>
      <template #friends>
        <div class="h-full overflow-hidden">
          <FriendsSidebar />
        </div>
      </template>
      <template #groups>
        <div class="h-full overflow-hidden">
          <GroupsSidebar />
        </div>
      </template>
    </TabsUnderline>
    <NotificationCenterSheet />
    <FavoriteFriendGroupOrderDialog v-model:open="isGroupOrderDialogOpen" />
    <QuickSearchDialog />
  </div>
</template>

<script setup lang="ts">
import Select from "@/components/ui/select/Select.vue";
import SelectContent from "@/components/ui/select/SelectContent.vue";
import SelectGroup from "@/components/ui/select/SelectGroup.vue";
import SelectItem from "@/components/ui/select/SelectItem.vue";
import SelectSeparator from "@/components/ui/select/SelectSeparator.vue";
import SelectTrigger from "@/components/ui/select/SelectTrigger.vue";
import SelectValue from "@/components/ui/select/SelectValue.vue";
import { Bell, ChevronDown, RefreshCw, Search, Settings } from "lucide-vue-next";
import { toast } from "vue-sonner";
import ContextMenu from "@/components/ui/context-menu/ContextMenu.vue";
import ContextMenuContent from "@/components/ui/context-menu/ContextMenuContent.vue";
import ContextMenuItem from "@/components/ui/context-menu/ContextMenuItem.vue";
import ContextMenuTrigger from "@/components/ui/context-menu/ContextMenuTrigger.vue";
import Field from "@/components/ui/field/Field.vue";
import FieldContent from "@/components/ui/field/FieldContent.vue";
import FieldLabel from "@/components/ui/field/FieldLabel.vue";
import Popover from "@/components/ui/popover/Popover.vue";
import PopoverContent from "@/components/ui/popover/PopoverContent.vue";
import PopoverTrigger from "@/components/ui/popover/PopoverTrigger.vue";
import { computed, ref } from "vue";
import { useMagicKeys, whenever } from "@vueuse/core";
import type { AcceptableValue } from "reka-ui";
import Button from "@/components/ui/button/Button.vue";
import Collapsible from "@/components/ui/collapsible/Collapsible.vue";
import CollapsibleContent from "@/components/ui/collapsible/CollapsibleContent.vue";
import CollapsibleTrigger from "@/components/ui/collapsible/CollapsibleTrigger.vue";
import Kbd from "@/components/ui/kbd/Kbd.vue";
import Separator from "@/components/ui/separator/Separator.vue";
import Spinner from "@/components/ui/spinner/Spinner.vue";
import Switch from "@/components/ui/switch/Switch.vue";
import TabsUnderline from "@/components/ui/tabs/TabsUnderline.vue";
import { storeToRefs } from "pinia";
import { useI18n } from "vue-i18n";

import { useAppearanceSettingsStore } from "../../stores/settings/appearance";
import { useFavoriteStore } from "../../stores/favorite";
import { useFriendStore } from "../../stores/friend";
import { useGroupStore } from "../../stores/group";
import { useNotificationStore } from "../../stores/notification";
import { runRefreshFriendsListFlow } from "../../coordinators/friend-sync-coordinator";
import { normalizeFavoriteGroupsChange, resolveFavoriteGroups } from "./sidebar-settings-utils";
import { useQuickSearchStore } from "../../stores/quick-search";

import FriendsSidebar from "./components/FriendsSidebar.vue";
import QuickSearchDialog from "../../components/QuickSearchDialog.vue";
import FavoriteFriendGroupOrderDialog from "./components/FavoriteFriendGroupOrderDialog.vue";
import GroupsSidebar from "./components/GroupsSidebar.vue";
import NotificationCenterSheet from "./components/NotificationCenterSheet.vue";

defineOptions({ name: "SidebarView" });

const { friends, isRefreshFriendsLoading, onlineFriendCount } = storeToRefs(useFriendStore());
const { groupInstances } = storeToRefs(useGroupStore());
const notificationStore = useNotificationStore();
const { isNotificationCenterOpen, hasUnseenNotifications } = storeToRefs(notificationStore);
const quickSearchStore = useQuickSearchStore();
const { t } = useI18n();

const isMac = navigator.platform.toUpperCase().includes("MAC");

const keys = useMagicKeys();
const metaKKey = keys["Meta+k"];
const ctrlKKey = keys["Ctrl+k"];
if (metaKKey) whenever(metaKKey, () => openQuickSearch());
if (ctrlKKey) whenever(ctrlKKey, () => openQuickSearch());

function openQuickSearch() {
  quickSearchStore.open();
}

function markNotificationsRead() {
  notificationStore.markAllAsSeen();
}

const appearanceSettingsStore = useAppearanceSettingsStore();
const {
  sidebarSortMethod1,
  sidebarSortMethod2,
  sidebarSortMethod3,
  isSidebarGroupByInstance,
  isHideFriendsInSameInstance,
  isSameInstanceAboveFavorites,
  isSidebarDivideByFriendGroup,
  sidebarFavoriteGroups,
  sidebarCosmetics,
} = storeToRefs(appearanceSettingsStore);
const {
  setSidebarSortMethod1,
  setSidebarSortMethod2,
  setSidebarSortMethod3,
  setIsSidebarGroupByInstance,
  setIsHideFriendsInSameInstance,
  setIsSameInstanceAboveFavorites,
  setIsSidebarDivideByFriendGroup,
  setSidebarFavoriteGroups,
  setSidebarCosmetics,
} = appearanceSettingsStore;

const favoriteStore = useFavoriteStore();
const { favoriteFriendGroups, localFriendFavoriteGroups } = storeToRefs(favoriteStore);

const allFavoriteGroupKeys = computed(() => {
  const keys = favoriteFriendGroups.value.map((g) => g.key);
  for (const group of localFriendFavoriteGroups.value) {
    keys.push("local:" + group);
  }
  return keys;
});

const resolvedSidebarFavoriteGroups = computed(() => resolveFavoriteGroups(sidebarFavoriteGroups.value, allFavoriteGroupKeys.value));

function toSortMethod(value: AcceptableValue): string {
  return typeof value === "string" ? value : "";
}

function handleFavoriteGroupsChange(value: AcceptableValue) {
  const selected = Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
  setSidebarFavoriteGroups(normalizeFavoriteGroupsChange(selected, allFavoriteGroupKeys.value));
}

const selectedFavGroupLabel = computed(() => {
  const key = resolvedSidebarFavoriteGroups.value[0];
  if (!key) return "";
  if (key.startsWith("local:")) return key.slice(6);
  const displayName = favoriteFriendGroups.value.find((g) => g.key === key)?.displayName;
  if (!displayName) return key;
  return displayName;
});

const CLEAR_VALUE = "__clear__";
const isGroupOrderDialogOpen = ref(false);
const isSettingsPopoverOpen = ref(false);
const isAdvancedOpen = ref(false);

const sortOptions = computed(() => [
  { value: "Sort Alphabetically", label: t("view.settings.appearance.side_panel.sorting.alphabetical") },
  { value: "Sort by Status", label: t("view.settings.appearance.side_panel.sorting.status") },
  { value: "Sort Private to Bottom", label: t("view.settings.appearance.side_panel.sorting.private_to_bottom") },
  { value: "Sort by Last Active", label: t("view.settings.appearance.side_panel.sorting.last_active") },
  { value: "Sort by Last Seen", label: t("view.settings.appearance.side_panel.sorting.last_seen") },
  { value: "Sort by Time in Instance", label: t("view.settings.appearance.side_panel.sorting.time_in_instance") },
  { value: "Sort by Location", label: t("view.settings.appearance.side_panel.sorting.location") },
]);

const sidebarTabs = computed(() => [
  { value: "friends", label: t("side_panel.friends") },
  { value: "groups", label: t("side_panel.groups") },
]);
</script>

<style scoped>
.x-aside-container {
  display: flex;
  flex: none;
  flex-direction: column;
  padding: 8px 6px 6px;
  order: 99;
  height: 100%;
  box-sizing: border-box;
  padding-left: 8px;
}

.sidebar-tab-count {
  font-size: 12px;
  margin-left: 8px;
}

.search-container {
  container-type: inline-size;
}

@container (max-width: 150px) {
  .search-text {
    display: none;
  }
}

@container (max-width: 80px) {
  .search-kbd {
    display: none;
  }
}
</style>
