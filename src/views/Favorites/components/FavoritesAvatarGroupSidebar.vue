<template>
  <div class="h-full pr-2 overflow-auto flex flex-col gap-3">
    <div class="flex flex-col gap-2">
      <div class="flex items-center justify-between font-semibold text-sm mb-[9px]">
        <span>{{ t("view.favorite.avatars.vrchat_favorites") }}</span>
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
        <template v-if="favoriteAvatarGroups.length">
          <div
            v-for="group in favoriteAvatarGroups"
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
                <DropdownMenuContent side="right" class="w-55">
                  <DropdownMenuItem @click="handleRemoteRename(group)">
                    <span>{{ t("view.favorite.rename_tooltip") }}</span>
                  </DropdownMenuItem>
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger>
                      <span>{{ t("view.favorite.visibility_tooltip") }}</span>
                    </DropdownMenuSubTrigger>
                    <DropdownMenuPortal>
                      <DropdownMenuSubContent side="right" align="start" class="w-45">
                        <DropdownMenuCheckboxItem
                          v-for="visibility in avatarGroupVisibilityOptions"
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
            v-for="group in avatarGroupPlaceholders"
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
        <template v-if="!isRefreshingLocalFavorites">
          <Button class="rounded-full" size="icon" variant="ghost" :aria-label="t('common.actions.refresh')" @click.stop="refreshLocalAvatarFavorites"
            ><RefreshCcw
          /></Button>
        </template>
        <Button v-else size="sm" variant="ghost" @click.stop="cancelLocalRefresh">
          <Loader />

          {{ t("view.favorite.avatars.cancel_refresh") }}
        </Button>
      </div>
      <div class="flex flex-col gap-2">
        <template v-if="localAvatarFavoriteGroups.length">
          <div
            v-for="group in localAvatarFavoriteGroups"
            :key="group"
            :class="['group-item x-hover-card hover:shadow-sm', { 'is-active': !hasSearchInput && isGroupActive('local', group) }]"
            @click="handleGroupClick('local', group)"
          >
            <div class="flex items-start justify-between mb-1 text-[13px]">
              <span class="font-semibold">{{ group }}</span>
              <div class="flex items-center flex-col">
                <span class="text-xs">{{ localAvatarFavGroupLength(group) }}</span>
                <DropdownMenu :open="activeGroupMenu === localGroupMenuKey(group)" @update:open="handleGroupMenuVisible(localGroupMenuKey(group), $event)">
                  <DropdownMenuTrigger as-child>
                    <Button class="rounded-full" size="icon-sm" variant="ghost" @click.stop><Ellipsis /></Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent side="right" class="w-50">
                    <DropdownMenuItem @click="handleLocalRename(group)">
                      <span>{{ t("view.favorite.rename_tooltip") }}</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem @click="handleCheckInvalidAvatars(group)">
                      <span>{{ t("view.favorite.avatars.check_invalid") }}</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem variant="destructive" @click="handleLocalDelete(group)">
                      <span>{{ t("view.favorite.delete_tooltip") }}</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </div>
        </template>
        <div v-else class="text-center text-xs py-3">
          <DataTableEmpty type="nodata" />
        </div>
        <TooltipWrapper v-if="!isCreatingLocalGroup" :content="t('view.favorite.worlds.local_favorites')">
          <div
            :class="['group-item x-hover-card hover:shadow-sm', 'border-dashed flex items-center justify-center gap-2 text-sm']"
            @click="startLocalGroupCreation"
          >
            <Plus />
            <span>{{ t("view.favorite.avatars.new_group") }}</span>
          </div>
        </TooltipWrapper>
        <InputGroupField
          v-else
          :ref="newLocalGroupInput"
          v-model="newLocalGroupName"
          size="sm"
          class="w-full"
          :placeholder="t('view.favorite.avatars.new_group')"
          @keyup.enter="handleLocalGroupCreationConfirm"
          @keyup.esc="cancelLocalGroupCreation"
          @blur="cancelLocalGroupCreation"
        />
      </div>
    </div>
    <div class="flex flex-col gap-2">
      <div class="flex items-center justify-between font-semibold text-sm mb-[9px]">
        <span>{{ t("view.favorite.avatars.local_history") }}</span>
        <DropdownMenu :open="activeGroupMenu === historyGroupMenuKey" @update:open="handleGroupMenuVisible(historyGroupMenuKey, $event)">
          <DropdownMenuTrigger as-child>
            <Button class="rounded-full" size="icon-sm" variant="ghost" @click.stop><Ellipsis /></Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="right" class="w-45">
            <DropdownMenuItem variant="destructive" @click="handleHistoryClear">
              <span>{{ t("view.favorite.clear_tooltip") }}</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div class="flex flex-col gap-2">
        <div
          :class="['group-item x-hover-card hover:shadow-sm', { 'is-active': !hasSearchInput && isGroupActive('history', historyGroupKey) }]"
          @click="handleGroupClick('history', historyGroupKey)"
        >
          <div class="flex items-start justify-between mb-1 text-[13px]">
            <span class="font-semibold">{{ t("view.favorite.avatars.local_history") }}</span>
            <span class="text-xs">{{ avatarHistory.length }}/100</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Ellipsis, Loader, MoreHorizontal, Plus, RefreshCcw, RefreshCw } from "lucide-vue-next";
import { storeToRefs } from "pinia";
import { useI18n } from "vue-i18n";
import { DropdownMenuPortal } from "reka-ui";
import type { Ref } from "vue";
import Button from "@/components/ui/button/Button.vue";
import DataTableEmpty from "@/components/ui/data-table/DataTableEmpty.vue";
import InputGroupField from "@/components/ui/input-group/InputGroupField.vue";
import Spinner from "@/components/ui/spinner/Spinner.vue";
import DropdownMenu from "../../../components/ui/dropdown-menu/DropdownMenu.vue";
import DropdownMenuCheckboxItem from "../../../components/ui/dropdown-menu/DropdownMenuCheckboxItem.vue";
import DropdownMenuContent from "../../../components/ui/dropdown-menu/DropdownMenuContent.vue";
import DropdownMenuItem from "../../../components/ui/dropdown-menu/DropdownMenuItem.vue";
import DropdownMenuSub from "../../../components/ui/dropdown-menu/DropdownMenuSub.vue";
import DropdownMenuSubContent from "../../../components/ui/dropdown-menu/DropdownMenuSubContent.vue";
import DropdownMenuSubTrigger from "../../../components/ui/dropdown-menu/DropdownMenuSubTrigger.vue";
import DropdownMenuTrigger from "../../../components/ui/dropdown-menu/DropdownMenuTrigger.vue";
import { useAvatarStore } from "../../../stores/avatar";
import { useFavoriteStore } from "../../../stores/favorite";
import type { FavoriteGroupSlot } from "../../../stores/favorite-types";
import { avatarGroupVisibilityOptions } from "../avatar-favorite-entries";
import type { AvatarGroupVisibility } from "../avatar-favorite-entries";

const { t } = useI18n();
const favoriteStore = useFavoriteStore();
const { favoriteAvatarGroups, isFavoriteLoading, localAvatarFavoriteGroups } = storeToRefs(favoriteStore);
const { localAvatarFavGroupLength } = favoriteStore;
const { avatarHistory } = storeToRefs(useAvatarStore());

const {
  hasSearchInput,
  isGroupActive,
  handleGroupClick,
  avatarGroupPlaceholders,
  activeGroupMenu,
  remoteGroupMenuKey,
  handleGroupMenuVisible,
  handleVisibilitySelection,
  handleRemoteRename,
  handleRemoteClear,
  handleRefreshFavorites,
  isRefreshingLocalFavorites,
  refreshLocalAvatarFavorites,
  cancelLocalRefresh,
  localGroupMenuKey,
  handleLocalRename,
  handleCheckInvalidAvatars,
  handleLocalDelete,
  isCreatingLocalGroup,
  startLocalGroupCreation,
  newLocalGroupInput,
  handleLocalGroupCreationConfirm,
  cancelLocalGroupCreation,
  historyGroupMenuKey,
  historyGroupKey,
  handleHistoryClear,
} = defineProps<{
  hasSearchInput: boolean;
  isGroupActive: (type: string, key: string) => boolean;
  handleGroupClick: (type: string, key: string) => void;
  avatarGroupPlaceholders: { key: string; displayName: string }[];
  activeGroupMenu: string | null;
  remoteGroupMenuKey: (key: string) => string;
  handleGroupMenuVisible: (key: string, isVisible: boolean) => void;
  handleVisibilitySelection: (group: FavoriteGroupSlot, visibility: AvatarGroupVisibility) => void;
  handleRemoteRename: (group: FavoriteGroupSlot) => void;
  handleRemoteClear: (group: FavoriteGroupSlot) => void;
  handleRefreshFavorites: () => void;
  isRefreshingLocalFavorites: boolean;
  refreshLocalAvatarFavorites: () => Promise<void>;
  cancelLocalRefresh: () => void;
  localGroupMenuKey: (group: string) => string;
  handleLocalRename: (group: string) => void;
  handleCheckInvalidAvatars: (group: string) => Promise<void>;
  handleLocalDelete: (group: string) => void;
  isCreatingLocalGroup: boolean;
  startLocalGroupCreation: () => void;
  newLocalGroupInput: Ref<unknown>;
  handleLocalGroupCreationConfirm: () => void;
  cancelLocalGroupCreation: () => void;
  historyGroupMenuKey: string;
  historyGroupKey: string;
  handleHistoryClear: () => void;
}>();

const newLocalGroupName = defineModel<string>("newLocalGroupName", { required: true });
</script>
