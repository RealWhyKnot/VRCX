<template>
  <div class="flex h-full min-h-0 flex-col">
    <WidgetHeader :title="t('dashboard.widget.feed')" icon="ri-rss-line" route-name="feed">
      <DropdownMenu v-if="configUpdater">
        <DropdownMenuTrigger as-child>
          <Button variant="ghost" size="icon-sm">
            <Settings class="size-3.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" class="w-48">
          <DropdownMenuCheckboxItem
            v-for="filterType in FEED_TYPES"
            :key="filterType"
            :model-value="isFilterActive(filterType)"
            @select.prevent
            @update:model-value="toggleFilter(filterType)"
          >
            {{ t(`view.feed.filters.${filterType}`) }}
          </DropdownMenuCheckboxItem>
          <DropdownMenuSeparator />
          <DropdownMenuCheckboxItem :model-value="config.showType || false" @select.prevent @update:model-value="toggleBooleanConfig('showType')">
            {{ t("dashboard.widget.config.show_type") }}
          </DropdownMenuCheckboxItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </WidgetHeader>

    <div ref="listRef" class="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
      <Table v-if="filteredData.length" class="">
        <TableBody>
          <TableRow
            v-for="(item, index) in filteredData"
            :key="`${item.type}-${item.created_at}-${index}`"
            class="cursor-default in-[.is-compact-table]:py-1! in-[.is-comfortable-table]:py-1.5!"
            :class="{ 'border-l-2 border-l-chart-4': isFavoriteRow(item) }"
          >
            <TableCell class="w-28 text-[11px] tabular-nums text-muted-foreground">
              <TooltipWrapper :content="formatExactTime(item.created_at)" side="top">
                <span>{{ formatTime(item.created_at) }}</span>
              </TooltipWrapper>
            </TableCell>
            <TableCell v-if="showType" class="w-16 text-[11px] text-muted-foreground">
              {{ item.type }}
            </TableCell>
            <TableCell class="max-w-0 truncate">
              <template v-if="item.type === 'GPS'">
                <div class="flex items-center min-w-0">
                  <MapPin class="mr-1 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <UserContextMenu :user-id="item.userId ?? ''" :state="getFriendState(item.userId)" :location="getFriendLocation(item.userId)">
                    <span class="shrink-0 cursor-pointer" @click="openUser(item.userId)">{{ item.displayName }}</span>
                  </UserContextMenu>
                  <span class="shrink-0 text-muted-foreground mx-1"> → </span>
                  <div class="min-w-0 flex-1 truncate">
                    <Location
                      :location="item.location ?? ''"
                      :hint="item.worldName ?? ''"
                      :grouphint="item.groupName ?? ''"
                      enable-context-menu
                      disable-tooltip
                    />
                  </div>
                </div>
              </template>
              <template v-else-if="item.type === 'Online'">
                <div class="flex items-center min-w-0">
                  <i class="x-user-status online mr-1 shrink-0"></i>
                  <UserContextMenu :user-id="item.userId ?? ''" :state="getFriendState(item.userId)" :location="getFriendLocation(item.userId)">
                    <span class="shrink-0 cursor-pointer" @click="openUser(item.userId)">{{ item.displayName }}</span>
                  </UserContextMenu>
                  <template v-if="item.location">
                    <span class="shrink-0 text-muted-foreground"> → </span>
                    <div class="min-w-0 flex-1 truncate">
                      <Location
                        :location="item.location ?? ''"
                        :hint="item.worldName ?? ''"
                        :grouphint="item.groupName ?? ''"
                        enable-context-menu
                        disable-tooltip
                      />
                    </div>
                  </template>
                </div>
              </template>
              <template v-else-if="item.type === 'Offline'">
                <i class="x-user-status mr-1"></i>
                <UserContextMenu :user-id="item.userId ?? ''" :state="getFriendState(item.userId)" :location="getFriendLocation(item.userId)">
                  <span class="cursor-pointer" @click="openUser(item.userId)">{{ item.displayName }}</span>
                </UserContextMenu>
              </template>
              <template v-else-if="item.type === 'Status'">
                <i class="x-user-status mr-1" :class="statusClass(item.status ?? undefined)"></i>
                <UserContextMenu :user-id="item.userId ?? ''" :state="getFriendState(item.userId)" :location="getFriendLocation(item.userId)">
                  <span class="cursor-pointer" @click="openUser(item.userId)">{{ item.displayName }}</span>
                </UserContextMenu>
                <span class="text-muted-foreground ml-1"> {{ item.statusDescription }}</span>
              </template>
              <template v-else-if="item.type === 'Avatar'">
                <Box class="mr-1 inline-block h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <UserContextMenu :user-id="item.userId ?? ''" :state="getFriendState(item.userId)" :location="getFriendLocation(item.userId)">
                  <span class="cursor-pointer" @click="openUser(item.userId)">{{ item.displayName }}</span>
                </UserContextMenu>
                <span class="text-muted-foreground"> → {{ item.avatarName }}</span>
              </template>
              <template v-else-if="item.type === 'Bio'">
                <Pencil class="mr-1 inline-block h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <UserContextMenu :user-id="item.userId ?? ''" :state="getFriendState(item.userId)" :location="getFriendLocation(item.userId)">
                  <span class="cursor-pointer" @click="openUser(item.userId)">{{ item.displayName }}</span>
                </UserContextMenu>
                <span class="ml-1 text-muted-foreground">{{ t("dashboard.widget.feed_bio") }}</span>
              </template>
              <template v-else>
                <UserContextMenu :user-id="item.userId ?? ''" :state="getFriendState(item.userId)" :location="getFriendLocation(item.userId)">
                  <span class="cursor-pointer" @click="openUser(item.userId)">{{ item.displayName }}</span>
                </UserContextMenu>
                <span class="text-muted-foreground"> {{ item.type }}</span>
              </template>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
      <div v-else class="flex h-full items-center justify-center text-[13px] text-muted-foreground">
        {{ t("dashboard.widget.no_data") }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { Box, MapPin, Pencil, Settings } from "lucide-vue-next";

import { statusClass } from "@/shared/utils/user";
import { formatDateFilter } from "@/coordinators/date-coordinator";
import { showUserDialog } from "@/coordinators/user-coordinator";
import { useFeedStore } from "@/stores/feed";
import { useFriendStore } from "@/stores/friend";

import Button from "@/components/ui/button/Button.vue";
import DropdownMenu from "@/components/ui/dropdown-menu/DropdownMenu.vue";
import DropdownMenuCheckboxItem from "@/components/ui/dropdown-menu/DropdownMenuCheckboxItem.vue";
import DropdownMenuContent from "@/components/ui/dropdown-menu/DropdownMenuContent.vue";
import DropdownMenuSeparator from "@/components/ui/dropdown-menu/DropdownMenuSeparator.vue";
import DropdownMenuTrigger from "@/components/ui/dropdown-menu/DropdownMenuTrigger.vue";
import Location from "@/components/Location.vue";
import UserContextMenu from "@/components/UserContextMenu.vue";
import TooltipWrapper from "@/components/ui/tooltip/TooltipWrapper.vue";
import WidgetHeader from "./WidgetHeader.vue";
import Table from "@/components/ui/table/Table.vue";
import TableBody from "@/components/ui/table/TableBody.vue";
import TableRow from "@/components/ui/table/TableRow.vue";
import TableCell from "@/components/ui/table/TableCell.vue";
import type { FeedRow } from "@/services/database/feed";

type FeedWidgetConfig = {
  filters?: string[];
  showType?: boolean;
};

const FEED_TYPES = ["GPS", "Online", "Offline", "Status", "Avatar", "Bio"];

const props = withDefaults(
  defineProps<{
    config?: FeedWidgetConfig;
    configUpdater?: ((config: FeedWidgetConfig) => void) | null;
  }>(),
  {
    config: () => ({}),
    configUpdater: null,
  }
);

const { t } = useI18n();
const feedStore = useFeedStore();
const friendStore = useFriendStore();

const activeFilters = computed(() => {
  const filters = props.config.filters;
  if (filters && Array.isArray(filters) && filters.length > 0) {
    return filters;
  }
  return FEED_TYPES;
});

function isFavoriteRow(row: FeedRow) {
  return "isFavorite" in row && Boolean(row.isFavorite);
}

function isFilterActive(filterType: string) {
  const filters = props.config.filters;
  if (!filters || !Array.isArray(filters) || filters.length === 0) return true;
  return filters.includes(filterType);
}

function toggleFilter(filterType: string) {
  if (!props.configUpdater) return;
  const currentFilters = props.config.filters;
  let filters: string[];
  if (!currentFilters || !Array.isArray(currentFilters) || currentFilters.length === 0) {
    filters = FEED_TYPES.filter((f) => f !== filterType);
  } else if (currentFilters.includes(filterType)) {
    filters = currentFilters.filter((f) => f !== filterType);
    if (filters.length === 0) filters = [];
  } else {
    filters = [...currentFilters, filterType];
    if (filters.length === FEED_TYPES.length) filters = [];
  }
  props.configUpdater({ ...props.config, filters });
}

function toggleBooleanConfig(key: "showType") {
  if (!props.configUpdater) return;
  props.configUpdater({ ...props.config, [key]: !props.config[key] });
}

const showType = computed(() => {
  return props.config.showType ?? false;
});

const filteredData = computed(() => {
  const filters = activeFilters.value;
  return feedStore.feedTableData.filter((item) => filters.includes(item.type)).slice(0, 100);
});

function formatTime(dateStr: string | null) {
  return formatDateFilter(dateStr, "short");
}

function formatExactTime(dateStr: string | null) {
  return formatDateFilter(dateStr, "long");
}

function openUser(userId: string | null) {
  if (userId) {
    showUserDialog(userId);
  }
}

function getFriendState(userId: string | null) {
  if (!userId) return "";
  const friend = friendStore.friends.get(userId);
  return friend?.state ?? "";
}

function getFriendLocation(userId: string | null) {
  if (!userId) return "";
  const friend = friendStore.friends.get(userId);
  return friend?.ref?.location ?? "";
}

defineExpose({ FEED_TYPES });
</script>
