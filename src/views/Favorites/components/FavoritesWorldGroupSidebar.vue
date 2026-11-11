<template>
  <div class="h-full pr-2 overflow-auto flex flex-col gap-3">
    <div class="flex flex-col gap-2">
      <div class="flex items-center justify-between font-semibold text-sm mb-[9px]">
        <span>{{ t("view.favorite.worlds.vrchat_favorites") }}</span>
        <TooltipWrapper side="bottom" :content="t('view.favorite.refresh_favorites_tooltip')">
          <Button
            class="rounded-full"
            variant="ghost"
            size="icon-sm"
            :disabled="isFavoriteLoading"
            :aria-label="t('view.favorite.refresh_favorites_tooltip')"
            @click.stop="handleRefreshFavorites"
          >
            <Spinner v-if="isFavoriteLoading" />
            <RefreshCw v-else />
          </Button>
        </TooltipWrapper>
      </div>
      <div class="flex flex-col gap-2">
        <template v-if="favoriteWorldGroups.length">
          <div
            v-for="group in favoriteWorldGroups"
            :key="group.key"
            :class="[
              'group-item x-hover-card hover:shadow-sm',
              `group-item-${group.visibility}`,
              { 'is-active': !hasSearchInput && isGroupActive('remote', group.key) },
            ]"
            @click="handleGroupClick('remote', group.key)"
          >
            <div class="flex items-start justify-between mb-1 text-[13px]">
              <span class="font-semibold">{{ group.displayName }}</span>
              <span class="text-xs">{{ group.count }}/{{ group.capacity }}</span>
            </div>
            <div class="flex items-center justify-between gap-2">
              <span class="flex items-center gap-1.5">
                <span class="text-[11px] text-muted-foreground">{{ t(`view.favorite.visibility.${group.visibility}`) }}</span>
              </span>
              <DropdownMenu
                :open="activeGroupMenu === remoteGroupMenuKey(group.key)"
                @update:open="handleGroupMenuVisible(remoteGroupMenuKey(group.key), $event)"
              >
                <DropdownMenuTrigger as-child>
                  <Button class="rounded-full" variant="ghost" size="icon-sm" :aria-label="t('nav_tooltip.manage')" @click.stop>
                    <MoreHorizontal />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent side="right" class="w-50">
                  <DropdownMenuItem @click="handleRemoteRename(group)">
                    <span>{{ t("view.favorite.rename_tooltip") }}</span>
                  </DropdownMenuItem>
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger>
                      <span>{{ t("view.favorite.visibility_tooltip") }}</span>
                    </DropdownMenuSubTrigger>
                    <DropdownMenuPortal>
                      <DropdownMenuSubContent side="right" align="start" class="w-[200px]">
                        <DropdownMenuCheckboxItem
                          v-for="visibility in worldGroupVisibilityOptions"
                          :key="visibility"
                          :model-value="group.visibility === visibility"
                          indicator-position="right"
                          @select="handleVisibilitySelection(group, visibility)"
                        >
                          <span>{{ t(`view.favorite.visibility.${visibility}`) }}</span>
                        </DropdownMenuCheckboxItem>
                      </DropdownMenuSubContent>
                    </DropdownMenuPortal>
                  </DropdownMenuSub>
                  <DropdownMenuItem variant="destructive" @click="handleRemoteClear(group)">
                    <span>{{ t("view.favorite.clear") }}</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </template>
        <template v-else>
          <div
            v-for="group in worldGroupPlaceholders"
            :key="group.key"
            :class="[
              'group-item x-hover-card hover:shadow-sm',
              'pointer-events-none opacity-70',
              { 'is-active': !hasSearchInput && isGroupActive('remote', group.key) },
            ]"
          >
            <div class="flex items-start justify-between mb-1 text-[13px]">
              <span class="font-semibold">{{ group.displayName }}</span>
              <span class="text-xs">--/--</span>
            </div>
            <div class="flex items-center justify-between gap-2">
              <div class="w-16 h-[18px] rounded-full"></div>
            </div>
          </div>
        </template>
      </div>
    </div>
    <div class="flex flex-col gap-2">
      <div class="flex items-center justify-between font-semibold text-sm mb-[9px]">
        <span>{{ t("view.favorite.worlds.local_favorites") }}</span>
        <Button
          v-if="!isRefreshingLocalFavorites"
          class="rounded-full"
          size="icon-sm"
          variant="ghost"
          :aria-label="t('common.actions.refresh')"
          @click.stop="refreshLocalWorldFavorites"
          ><RefreshCcw
        /></Button>
        <Button v-else size="icon-sm" variant="ghost" @click.stop="cancelLocalWorldRefresh">
          <RefreshCcw />
          {{ t("view.favorite.worlds.cancel_refresh") }}
        </Button>
      </div>
      <div class="flex flex-col gap-2">
        <template v-if="localWorldFavoriteGroups.length">
          <div
            v-for="group in localWorldFavoriteGroups"
            :key="group"
            :class="['group-item x-hover-card hover:shadow-sm', { 'is-active': !hasSearchInput && isGroupActive('local', group) }]"
            @click="handleGroupClick('local', group)"
          >
            <div class="flex items-start justify-between mb-1 text-[13px]">
              <span class="font-semibold">{{ group }}</span>
              <div class="flex items-center flex-col">
                <span class="text-xs">{{ localWorldFavGroupLength(group) }}</span>
                <div class="flex items-center justify-between gap-2">
                  <DropdownMenu :open="activeGroupMenu === localGroupMenuKey(group)" @update:open="handleGroupMenuVisible(localGroupMenuKey(group), $event)">
                    <DropdownMenuTrigger as-child>
                      <Button class="rounded-full" size="icon-sm" variant="ghost" @click.stop><Ellipsis /></Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent side="right" class="w-50">
                      <DropdownMenuItem @click="handleLocalRename(group)">
                        <span>{{ t("view.favorite.rename_tooltip") }}</span>
                      </DropdownMenuItem>
                      <DropdownMenuItem variant="destructive" @click="handleLocalDelete(group)">
                        <span>{{ t("view.favorite.delete_tooltip") }}</span>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </div>
          </div>
        </template>
        <div v-else class="text-center text-xs py-3">
          <DataTableEmpty type="nodata" />
        </div>
        <div
          v-if="!isCreatingLocalGroup"
          class="group-item x-hover-card hover:shadow-sm border-dashed flex items-center justify-center gap-2 text-sm"
          @click="startLocalGroupCreation"
        >
          <Plus />
          <span>{{ t("view.favorite.worlds.new_group") }}</span>
        </div>
        <InputGroupField
          v-else
          :ref="newLocalGroupInput"
          v-model="newLocalGroupName"
          size="sm"
          class="w-full"
          :placeholder="t('view.favorite.worlds.new_group')"
          @keyup.enter="handleLocalGroupCreationConfirm"
          @keyup.esc="cancelLocalGroupCreation"
          @blur="cancelLocalGroupCreation"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Ellipsis, MoreHorizontal, Plus, RefreshCcw, RefreshCw } from "lucide-vue-next";
import Button from "@/components/ui/button/Button.vue";
import DataTableEmpty from "@/components/ui/data-table/DataTableEmpty.vue";
import InputGroupField from "@/components/ui/input-group/InputGroupField.vue";
import Spinner from "@/components/ui/spinner/Spinner.vue";
import { storeToRefs } from "pinia";
import { useI18n } from "vue-i18n";
import { DropdownMenuPortal } from "reka-ui";
import type { Ref } from "vue";
import DropdownMenu from "../../../components/ui/dropdown-menu/DropdownMenu.vue";
import DropdownMenuCheckboxItem from "../../../components/ui/dropdown-menu/DropdownMenuCheckboxItem.vue";
import DropdownMenuContent from "../../../components/ui/dropdown-menu/DropdownMenuContent.vue";
import DropdownMenuItem from "../../../components/ui/dropdown-menu/DropdownMenuItem.vue";
import DropdownMenuSub from "../../../components/ui/dropdown-menu/DropdownMenuSub.vue";
import DropdownMenuSubContent from "../../../components/ui/dropdown-menu/DropdownMenuSubContent.vue";
import DropdownMenuSubTrigger from "../../../components/ui/dropdown-menu/DropdownMenuSubTrigger.vue";
import DropdownMenuTrigger from "../../../components/ui/dropdown-menu/DropdownMenuTrigger.vue";
import { useFavoriteStore } from "../../../stores/favorite";
import type { FavoriteGroupSlot } from "../../../stores/favorite-types";
import { worldGroupVisibilityOptions } from "../world-favorite-entries";
import type { WorldGroupVisibility } from "../world-favorite-entries";

const { t } = useI18n();
const favoriteStore = useFavoriteStore();
const { favoriteWorldGroups, isFavoriteLoading, localWorldFavoriteGroups } = storeToRefs(favoriteStore);
const { localWorldFavGroupLength } = favoriteStore;

const {
  hasSearchInput,
  isGroupActive,
  handleGroupClick,
  worldGroupPlaceholders,
  activeGroupMenu,
  remoteGroupMenuKey,
  handleGroupMenuVisible,
  handleVisibilitySelection,
  handleRemoteRename,
  handleRemoteClear,
  handleRefreshFavorites,
  isRefreshingLocalFavorites,
  refreshLocalWorldFavorites,
  cancelLocalWorldRefresh,
  localGroupMenuKey,
  handleLocalRename,
  handleLocalDelete,
  isCreatingLocalGroup,
  startLocalGroupCreation,
  newLocalGroupInput,
  handleLocalGroupCreationConfirm,
  cancelLocalGroupCreation,
} = defineProps<{
  hasSearchInput: boolean;
  isGroupActive: (type: string, key: string) => boolean;
  handleGroupClick: (type: string, key: string) => void;
  worldGroupPlaceholders: { key: string; displayName: string }[];
  activeGroupMenu: string | null;
  remoteGroupMenuKey: (key: string) => string;
  handleGroupMenuVisible: (key: string, isVisible: boolean) => void;
  handleVisibilitySelection: (group: FavoriteGroupSlot, visibility: WorldGroupVisibility) => void;
  handleRemoteRename: (group: FavoriteGroupSlot) => void;
  handleRemoteClear: (group: FavoriteGroupSlot) => void;
  handleRefreshFavorites: () => void;
  isRefreshingLocalFavorites: boolean;
  refreshLocalWorldFavorites: () => Promise<void>;
  cancelLocalWorldRefresh: () => void;
  localGroupMenuKey: (group: string) => string;
  handleLocalRename: (group: string) => void;
  handleLocalDelete: (group: string) => void;
  isCreatingLocalGroup: boolean;
  startLocalGroupCreation: () => void;
  newLocalGroupInput: Ref<unknown>;
  handleLocalGroupCreationConfirm: () => void;
  cancelLocalGroupCreation: () => void;
}>();

const newLocalGroupName = defineModel<string>("newLocalGroupName", { required: true });
</script>
