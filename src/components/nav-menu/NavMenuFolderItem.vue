<template>
  <SidebarMenuItem>
    <ContextMenu>
      <ContextMenuTrigger as-child>
        <div class="w-full">
          <DropdownMenu
            v-if="isCollapsed"
            :open="collapsedDropdownOpenId === item.index"
            @update:open="(value) => emit('collapsed-dropdown-open-change', item.index, value)"
          >
            <DropdownMenuTrigger as-child>
              <SidebarMenuButton
                :is-active="item.children?.some((e) => e.index === activeMenuIndex) ?? false"
                :tooltip="item.titleIsCustom ? item.title : t(item.title || '')"
              >
                <i :class="item.icon" class="inline-flex size-6 items-center justify-center text-lg relative"
                  ><span v-if="isNavItemNotified(item)" class="notify-dot bg-red-500 -right-1!" aria-hidden="true"></span
                ></i>
                <span v-show="!isCollapsed">{{ item.titleIsCustom ? item.title : t(item.title || "") }}</span>
              </SidebarMenuButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="right" align="start" class="w-56">
              <DropdownMenuItem v-for="entry in item.children" :key="entry.index" @select="(event: Event) => emit('collapsed-submenu-select', event, entry)">
                <i v-if="entry.icon" :class="entry.icon" class="inline-flex size-4 items-center justify-center text-base relative"
                  ><span v-if="isEntryNotified(entry)" class="notify-dot bg-red-500 -right-1! top-0.5!" aria-hidden="true"></span
                ></i>
                <span v-if="entry.titleIsCustom">{{ entry.label }}</span>
                <span v-else>{{ t(entry.label) }}</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Collapsible v-else class="group/collapsible" :default-open="isFolderDefaultOpen()">
            <template #default="{ open }">
              <CollapsibleTrigger as-child>
                <SidebarMenuButton
                  :is-active="item.children?.some((e) => e.index === activeMenuIndex) ?? false"
                  :tooltip="item.titleIsCustom ? item.title : t(item.title || '')"
                >
                  <i :class="item.icon" class="inline-flex size-6 items-center justify-center text-lg relative"
                    ><span v-if="isNavItemNotified(item)" class="notify-dot bg-red-500" aria-hidden="true"></span
                  ></i>
                  <span v-show="!isCollapsed">{{ item.titleIsCustom ? item.title : t(item.title || "") }}</span>

                  <ChevronRight v-show="!isCollapsed" class="ml-auto transition-transform" :class="open ? 'rotate-90' : ''" />
                </SidebarMenuButton>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <SidebarMenuSub>
                  <SidebarMenuSubItem v-for="entry in item.children" :key="entry.index">
                    <ContextMenu>
                      <ContextMenuTrigger as-child>
                        <SidebarMenuSubButton :is-active="activeMenuIndex === entry.index" @click="emit('submenu-click', entry)">
                          <i v-if="entry.icon" :class="entry.icon" class="inline-flex size-5 items-center justify-center text-base relative"
                            ><span v-if="isEntryNotified(entry)" class="notify-dot bg-red-500 -right-0.5!" aria-hidden="true"></span
                          ></i>
                          <span v-if="entry.titleIsCustom">{{ entry.label }}</span>
                          <span v-else>{{ t(entry.label) }}</span>
                        </SidebarMenuSubButton>
                      </ContextMenuTrigger>
                      <ContextMenuContent>
                        <ContextMenuItem v-if="hasNotifications" @click="emit('clear-notifications')">
                          {{ t("nav_menu.mark_all_read") }}
                        </ContextMenuItem>
                        <ContextMenuSeparator v-if="hasNotifications" />
                        <template v-if="isDashboardItem(entry)">
                          <ContextMenuItem @click="emit('edit-dashboard', entry)">
                            {{ t("nav_menu.edit_dashboard") }}
                          </ContextMenuItem>
                          <ContextMenuItem variant="destructive" @click="emit('delete-dashboard', entry)">
                            {{ t("nav_menu.delete_dashboard") }}
                          </ContextMenuItem>
                          <ContextMenuSeparator />
                        </template>
                        <ContextMenuItem v-if="isToolItem(entry)" @click="emit('unpin-tool', entry)">
                          {{ t("nav_menu.custom_nav.unpin_from_nav") }}
                        </ContextMenuItem>
                        <ContextMenuSeparator v-if="isToolItem(entry)" />
                        <ContextMenuItem @click="emit('open-custom-nav')">
                          {{ t("nav_menu.custom_nav.header") }}
                        </ContextMenuItem>
                      </ContextMenuContent>
                    </ContextMenu>
                  </SidebarMenuSubItem>
                </SidebarMenuSub>
              </CollapsibleContent>
            </template>
          </Collapsible>
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem v-if="hasNotifications" @click="emit('clear-notifications')">
          {{ t("nav_menu.mark_all_read") }}
        </ContextMenuItem>
        <ContextMenuSeparator v-if="hasNotifications" />
        <ContextMenuItem @click="emit('open-custom-nav')">
          {{ t("nav_menu.custom_nav.header") }}
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  </SidebarMenuItem>
</template>

<script setup lang="ts">
import { ChevronRight } from "lucide-vue-next";
import { useI18n } from "vue-i18n";

import Collapsible from "@/components/ui/collapsible/Collapsible.vue";
import CollapsibleContent from "@/components/ui/collapsible/CollapsibleContent.vue";
import CollapsibleTrigger from "@/components/ui/collapsible/CollapsibleTrigger.vue";
import ContextMenu from "@/components/ui/context-menu/ContextMenu.vue";
import ContextMenuContent from "@/components/ui/context-menu/ContextMenuContent.vue";
import ContextMenuItem from "@/components/ui/context-menu/ContextMenuItem.vue";
import ContextMenuSeparator from "@/components/ui/context-menu/ContextMenuSeparator.vue";
import ContextMenuTrigger from "@/components/ui/context-menu/ContextMenuTrigger.vue";
import DropdownMenu from "@/components/ui/dropdown-menu/DropdownMenu.vue";
import DropdownMenuContent from "@/components/ui/dropdown-menu/DropdownMenuContent.vue";
import DropdownMenuItem from "@/components/ui/dropdown-menu/DropdownMenuItem.vue";
import DropdownMenuTrigger from "@/components/ui/dropdown-menu/DropdownMenuTrigger.vue";
import SidebarMenuButton from "@/components/ui/sidebar/SidebarMenuButton.vue";
import SidebarMenuItem from "@/components/ui/sidebar/SidebarMenuItem.vue";
import SidebarMenuSub from "@/components/ui/sidebar/SidebarMenuSub.vue";
import SidebarMenuSubButton from "@/components/ui/sidebar/SidebarMenuSubButton.vue";
import SidebarMenuSubItem from "@/components/ui/sidebar/SidebarMenuSubItem.vue";

import type { NavIndexed, NavMenuChild, NavMenuItem } from "./nav-menu-types";

const props = withDefaults(
  defineProps<{
    item: NavMenuItem;
    isCollapsed?: boolean;
    activeMenuIndex?: string;
    collapsedDropdownOpenId?: string | null;
    hasNotifications?: boolean;
    isEntryNotified: (entry: NavMenuChild) => boolean;
    isNavItemNotified: (item: NavMenuItem) => boolean;
    isDashboardItem: (item: NavIndexed) => boolean;
    isToolItem: (item: NavIndexed) => boolean;
  }>(),
  {
    isCollapsed: false,
    activeMenuIndex: "",
    collapsedDropdownOpenId: null,
    hasNotifications: false,
  }
);

const emit = defineEmits<{
  "collapsed-dropdown-open-change": [index: string, isOpen: boolean];
  "collapsed-submenu-select": [event: Event, entry: NavMenuChild];
  "submenu-click": [entry: NavMenuChild];
  "clear-notifications": [];
  "edit-dashboard": [item: NavIndexed];
  "delete-dashboard": [item: NavIndexed];
  "unpin-tool": [item: NavIndexed];
  "open-custom-nav": [];
}>();
const { t } = useI18n();

const isFolderDefaultOpen = (): boolean =>
  props.activeMenuIndex === "" || (props.item.children?.some((entry) => entry.index === props.activeMenuIndex) ?? false);
</script>

<style scoped>
.notify-dot {
  position: absolute;
  top: 4px;
  right: 0;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  transform: translateY(-50%);
}
</style>
