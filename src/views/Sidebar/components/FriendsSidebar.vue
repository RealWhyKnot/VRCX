<template>
  <div class="relative h-full">
    <div ref="scrollViewportRef" class="h-full w-full overflow-auto overflow-x-hidden">
      <div class="px-1.5 py-2.5">
        <div v-if="virtualRows.length" class="relative w-full box-border h-[var(--virtual-height)]" :style="virtualContainerStyle">
          <template v-for="item in virtualItems" :key="String(item.virtualItem.key)">
            <div
              v-if="item.row"
              :ref="measureRowElement"
              class="absolute left-0 top-0 w-full box-border [transform:translateY(var(--row-start))] pb-[var(--row-padding-bottom,0px)]"
              :data-index="item.virtualItem.index"
              :style="rowStyle(item)"
            >
              <template v-if="item.row.type === 'toggle-header'">
                <div
                  class="flex cursor-pointer items-center text-xs [padding:var(--header-padding,1rem_0_0.375rem)]"
                  :style="item.row.headerPadding ? { '--header-padding': item.row.headerPadding } : undefined"
                  @click="item.row.onClick && item.row.onClick()"
                >
                  <ChevronDown class="transition-transform duration-200 ease-in-out" :class="{ '-rotate-90': !item.row.isExpanded }" />
                  <span class="ml-1.5">
                    {{ item.row.label }}
                    <template v-if="item.row.count !== null && item.row.count !== undefined"> &horbar; {{ item.row.count }} </template>
                  </span>
                </div>
              </template>

              <template v-else-if="item.row.type === 'me-item'">
                <ContextMenu>
                  <ContextMenuTrigger as-child>
                    <div
                      class="friend-row box-border flex items-center p-1.5 text-[13px] cursor-pointer hover:bg-muted/50 hover:rounded-lg"
                      @click="showUserDialog(currentUser.id)"
                    >
                      <div class="relative inline-block flex-none size-9 mr-2.5" :class="userStatusClass(currentUser)">
                        <Avatar class="size-full rounded-full">
                          <AvatarImage :src="userImage(currentUser)" class="object-cover" />
                          <AvatarFallback>
                            <User class="size-5 text-muted-foreground" />
                          </AvatarFallback>
                        </Avatar>
                        <IconFrame :enabled="sidebarCosmetics" :icon-frame="currentUser.iconFrame" />
                      </div>
                      <div class="flex-1 overflow-hidden h-9 flex flex-col justify-between">
                        <span
                          class="block truncate font-medium leading-[18px] [color:var(--user-colour,inherit)]"
                          :style="{ '--user-colour': currentUser.$userColour }"
                          >{{ currentUser.displayName }}</span
                        >
                        <Location
                          v-if="isGameRunning && !gameLogDisabled"
                          class="extra block truncate text-xs"
                          :location="lastLocation.location"
                          :traveling="lastLocationDestination"
                          :link="false"
                        />
                        <Location
                          v-else-if="isRealInstance(currentUser.$locationTag) || isRealInstance(currentUser.$travelingToLocation)"
                          class="extra block truncate text-xs"
                          :location="currentUser.$locationTag"
                          :traveling="currentUser.$travelingToLocation"
                          :link="false"
                        />

                        <span v-else class="extra block truncate text-xs">{{ currentUser.statusDescription }}</span>
                      </div>
                    </div>
                  </ContextMenuTrigger>
                  <ContextMenuContent>
                    <ContextMenuSub>
                      <ContextMenuSubTrigger>
                        {{ t("dialog.user.actions.edit_status") }}
                      </ContextMenuSubTrigger>
                      <ContextMenuSubContent>
                        <ContextMenuCheckboxItem
                          v-for="option in statusOptions"
                          :key="option.value"
                          :model-value="currentUser.status === option.value"
                          class="gap-2"
                          @click="changeStatus(option.value)"
                        >
                          <i class="x-user-status" :class="option.statusClass"></i>
                          {{ option.label }}
                        </ContextMenuCheckboxItem>
                      </ContextMenuSubContent>
                    </ContextMenuSub>
                    <ContextMenuSub>
                      <ContextMenuSubTrigger>
                        {{ t("dialog.social_status.history") }}
                      </ContextMenuSubTrigger>
                      <ContextMenuSubContent>
                        <ContextMenuCheckboxItem :model-value="!currentUser.statusDescription" @click="setStatusFromHistory('')">
                          {{ t("dialog.gallery_select.none") }}
                        </ContextMenuCheckboxItem>
                        <ContextMenuSeparator v-if="recentStatuses.length" />
                        <ContextMenuCheckboxItem
                          v-for="(status, idx) in recentStatuses"
                          :key="idx"
                          :model-value="currentUser.statusDescription === status"
                          @click="setStatusFromHistory(status)"
                        >
                          {{ status }}
                        </ContextMenuCheckboxItem>
                      </ContextMenuSubContent>
                    </ContextMenuSub>
                    <ContextMenuSub v-if="statusPresets.length">
                      <ContextMenuSubTrigger>
                        {{ t("dialog.social_status.presets") }}
                      </ContextMenuSubTrigger>
                      <ContextMenuSubContent>
                        <ContextMenuItem v-for="(preset, idx) in statusPresets" :key="idx" class="gap-2" @click="applyStatusPreset(preset)">
                          <i class="x-user-status" :class="presetStatusClass(preset.status)"></i>
                          <span class="truncate max-w-[180px]">{{ getPresetDisplayText(preset) }}</span>
                        </ContextMenuItem>
                      </ContextMenuSubContent>
                    </ContextMenuSub>
                    <ContextMenuItem @click="openEditProfileFromSidebar">
                      {{ t("dialog.user.actions.edit_profile") }}
                    </ContextMenuItem>
                  </ContextMenuContent>
                </ContextMenu>
              </template>

              <template v-else-if="item.row.type === 'instance-header'">
                <div class="mb-1 flex items-center">
                  <Location class="inline text-xs" :location="item.row.location ?? ''" />
                  <span class="text-xs ml-1.5">{{ `(${item.row.count})` }}</span>
                </div>
              </template>

              <template v-else-if="item.row.type === 'friend-item'">
                <ContextMenu>
                  <ContextMenuTrigger as-child>
                    <FriendItem
                      :friend="item.row.friend"
                      :style="item.row.itemStyle"
                      :is-group-by-instance="item.row.isGroupByInstance"
                      :is-favorite="selectedFavoriteGroupIds.has(item.row.friend.id)"
                    />
                  </ContextMenuTrigger>
                  <ContextMenuContent>
                    <ContextMenuItem v-if="item.row.friend.state === 'online'" @click="friendRequestInvite(item.row.friend)">
                      {{ t("dialog.user.actions.request_invite") }}
                      <ContextMenuShortcut v-if="isActionRecent(item.row.friend.id, 'Request Invite')">
                        <Clock class="size-3.5 text-muted-foreground" />
                      </ContextMenuShortcut>
                    </ContextMenuItem>
                    <ContextMenuItem v-if="isGameRunning" :disabled="!canInviteToMyLocation" @click="friendInvite(item.row.friend)">
                      {{ t("dialog.user.actions.invite") }}
                      <ContextMenuShortcut v-if="isActionRecent(item.row.friend.id, 'Invite')">
                        <Clock class="size-3.5 text-muted-foreground" />
                      </ContextMenuShortcut>
                    </ContextMenuItem>
                    <ContextMenuItem :disabled="!currentUser.isBoopingEnabled" @click="friendSendBoop(item.row.friend)">
                      {{ t("dialog.user.actions.send_boop") }}
                    </ContextMenuItem>
                    <ContextMenuSeparator v-if="item.row.friend.state === 'online' && hasFriendLocation(item.row.friend)" />
                    <ContextMenuItem
                      v-if="item.row.friend.state === 'online' && hasFriendLocation(item.row.friend)"
                      :disabled="!canJoinFriend(item.row.friend)"
                      @click="friendJoin(item.row.friend)"
                    >
                      {{ t("dialog.user.info.launch_invite_tooltip") }}
                    </ContextMenuItem>
                    <ContextMenuItem
                      v-if="item.row.friend.state === 'online' && hasFriendLocation(item.row.friend)"
                      :disabled="!canJoinFriend(item.row.friend)"
                      @click="friendInviteSelf(item.row.friend)"
                    >
                      {{ t("dialog.user.info.self_invite_tooltip") }}
                    </ContextMenuItem>
                  </ContextMenuContent>
                </ContextMenu>
              </template>
            </div>
          </template>
        </div>
      </div>
    </div>
    <BackToTop :virtualizer="virtualizer" :target="scrollViewportRef ?? ''" :tooltip="false" />
    <EditProfileDialog :edit-profile-dialog="editProfileDialog" />
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, reactive, ref, watch } from "vue";
import type { CSSProperties } from "vue";
import { ChevronDown, Clock, User } from "lucide-vue-next";
import { storeToRefs } from "pinia";
import { useI18n } from "vue-i18n";
import { useVirtualizer } from "@tanstack/vue-virtual";
import type { VirtualItem } from "@tanstack/vue-virtual";

import ContextMenu from "../../../components/ui/context-menu/ContextMenu.vue";
import ContextMenuCheckboxItem from "../../../components/ui/context-menu/ContextMenuCheckboxItem.vue";
import ContextMenuContent from "../../../components/ui/context-menu/ContextMenuContent.vue";
import ContextMenuItem from "../../../components/ui/context-menu/ContextMenuItem.vue";
import ContextMenuSeparator from "../../../components/ui/context-menu/ContextMenuSeparator.vue";
import ContextMenuShortcut from "../../../components/ui/context-menu/ContextMenuShortcut.vue";
import ContextMenuSub from "../../../components/ui/context-menu/ContextMenuSub.vue";
import ContextMenuSubContent from "../../../components/ui/context-menu/ContextMenuSubContent.vue";
import ContextMenuSubTrigger from "../../../components/ui/context-menu/ContextMenuSubTrigger.vue";
import ContextMenuTrigger from "../../../components/ui/context-menu/ContextMenuTrigger.vue";
import Avatar from "../../../components/ui/avatar/Avatar.vue";
import AvatarFallback from "../../../components/ui/avatar/AvatarFallback.vue";
import AvatarImage from "../../../components/ui/avatar/AvatarImage.vue";
import IconFrame from "../../../components/IconFrame.vue";
import { useAdvancedSettingsStore } from "../../../stores/settings/advanced";
import { useAppearanceSettingsStore } from "../../../stores/settings/appearance";
import { useFavoriteStore } from "../../../stores/favorite";
import { useFriendStore } from "../../../stores/friend";
import type { FriendContext } from "../../../stores/friend-types";
import { useGameStore } from "../../../stores/game";
import { useLaunchStore } from "../../../stores/launch";
import { useLocationStore } from "../../../stores/location";
import { logFailure } from "../../../stores/log-failure";
import { useUserStore } from "../../../stores/user";
import type { FriendRow, InstanceHeaderRow, MeRow, ToggleRow } from "../friends-sidebar-utils";
import { buildFriendRow, buildInstanceHeaderRow, buildToggleRow, estimateRowSize } from "../friends-sidebar-utils";
import { getFriendsSortFunction } from "../../../shared/utils/friend";
import { isRealInstance } from "../../../shared/utils/instance";
import { useInviteChecks } from "../../../composables/use-invite-checks";
import { isActionRecent } from "../../../composables/use-recent-actions";
import { useUserDisplay } from "../../../composables/use-user-display";
import { getFriendsLocations } from "../../../shared/utils/location.ts";

import BackToTop from "../../../components/BackToTop.vue";
import FriendItem from "./FriendItem.vue";
import Location from "../../../components/Location.vue";
import EditProfileDialog from "../../../components/dialogs/UserDialog/EditProfileDialog.vue";
import { useStatusPresets } from "../../../components/dialogs/UserDialog/composables/use-status-presets";
import { useFriendsGroupStates } from "../composables/use-friends-group-states";
import { useFriendSidebarStatus } from "../composables/use-friend-sidebar-status";
import type { StatusPreset } from "../composables/use-friend-sidebar-status";
import { useFriendSidebarActions } from "../composables/use-friend-sidebar-actions";
import { useFriendFavoriteGroups } from "../composables/use-friend-favorite-groups";

import "@/styles/status-icon.css";
import { showUserDialog } from "../../../coordinators/user-coordinator";

type SidebarRow = ToggleRow | MeRow | FriendRow<FriendContext> | InstanceHeaderRow;
type VirtualRowItem = { virtualItem: VirtualItem; row: SidebarRow | undefined };
type FavoriteFriendEntry = FriendContext & { groupName: string; key: string };

const { t } = useI18n();

const friendStore = useFriendStore();
const { vipFriends, onlineFriends, activeFriends, offlineFriends, friendsInSameInstance } = storeToRefs(friendStore);
const appearanceSettingsStore = useAppearanceSettingsStore();
const {
  isSidebarGroupByInstance,
  isHideFriendsInSameInstance,
  isSameInstanceAboveFavorites,
  isSidebarDivideByFriendGroup,
  sidebarFavoriteGroups,
  sidebarFavoriteGroupOrder,
  sidebarSortMethods,
  sidebarCosmetics,
} = storeToRefs(appearanceSettingsStore);
const { gameLogDisabled } = storeToRefs(useAdvancedSettingsStore());
const userStore = useUserStore();
const { showSendBoopDialog, showEditProfileDialog } = userStore;
const launchStore = useLaunchStore();
const favoriteStore = useFavoriteStore();
const { lastLocation, lastLocationDestination } = storeToRefs(useLocationStore());
const { isGameRunning } = storeToRefs(useGameStore());
const { currentUser, editProfileDialog } = storeToRefs(userStore);
const { checkCanInvite, checkCanInviteSelf } = useInviteChecks();
const { userImage, userStatusClass } = useUserDisplay();
const { presets, getStatusClass: presetStatusClass } = useStatusPresets();
const statusPresets = computed<StatusPreset[]>(() => presets.value);

const {
  isFriendsGroupMe,
  isVIPFriends,
  isOnlineFriends,
  isActiveFriends,
  isOfflineFriends,
  isSidebarGroupByInstanceCollapsed,
  loadFriendsGroupStates,
  toggleSwitchGroupByInstanceCollapsed,
  toggleFriendsGroupMe,
  toggleVIPFriends,
  toggleOnlineFriends,
  toggleActiveFriends,
  toggleOfflineFriends,
} = useFriendsGroupStates();
const collapsedFavGroups = reactive(new Set<string | number>());
const scrollViewportRef = ref<HTMLDivElement | null>(null);

void loadFriendsGroupStates().catch(logFailure("load friends group states"));

const sameInstanceFriendId = computed(() => {
  const ids = new Set<string>();
  for (const item of friendsInSameInstance.value) {
    for (const friend of item) {
      if (isRealInstance(friend.ref?.$location.tag) || lastLocation.value.friendList.has(friend.id)) {
        ids.add(friend.id);
      }
    }
  }
  return ids;
});

const shouldHideSameInstance = computed(() => isSidebarGroupByInstance.value && isHideFriendsInSameInstance.value);

const { selectedFavoriteGroups, selectedFavoriteGroupIds } = useFriendFavoriteGroups({ favoriteStore, sidebarFavoriteGroups });
const allOnlineFriends = computed(() => [...vipFriends.value, ...onlineFriends.value].sort(getFriendsSortFunction(sidebarSortMethods.value)));

const visibleFavoriteOnlineFriends = computed(() => {
  const selectedIds = selectedFavoriteGroupIds.value;
  return excludeSameInstance(allOnlineFriends.value.filter((f) => selectedIds.has(f.id)));
});

function excludeSameInstance(list: FriendContext[]): FriendContext[] {
  if (!shouldHideSameInstance.value) {
    return list;
  }
  return list.filter((item) => !sameInstanceFriendId.value.has(item.id));
}

const onlineFriendsByGroupStatus = computed(() => {
  const selectedIds = selectedFavoriteGroupIds.value;
  return excludeSameInstance(allOnlineFriends.value.filter((f) => !selectedIds.has(f.id)));
});

function indexOfFavoriteGroupKey(order: readonly string[], key: string | undefined): number {
  return key === undefined ? -1 : order.indexOf(key);
}

const vipFriendsDivideByGroup = computed(() => {
  const result: FavoriteFriendEntry[][] = [];
  for (const { key, groupName, memberIds } of selectedFavoriteGroups.value) {
    const filteredFriends = visibleFavoriteOnlineFriends.value.filter((friend) => memberIds.has(friend.id));
    if (filteredFriends.length > 0) {
      result.push(filteredFriends.map((item) => ({ groupName, key, ...item })));
    }
  }

  const order = sidebarFavoriteGroupOrder.value;
  return result.sort((a, b) => {
    const idxA = indexOfFavoriteGroupKey(order, a[0]?.key);
    const idxB = indexOfFavoriteGroupKey(order, b[0]?.key);
    if (idxA !== -1 && idxB !== -1) return idxA - idxB;
    if (idxA !== -1) return -1;
    if (idxB !== -1) return 1;
    return (a[0]?.key ?? "").localeCompare(b[0]?.key ?? "");
  });
});

function buildFavoriteRows(rows: SidebarRow[]) {
  const vipFriendCount = isSidebarDivideByFriendGroup.value
    ? vipFriendsDivideByGroup.value.reduce((sum, group) => sum + group.length, 0)
    : visibleFavoriteOnlineFriends.value.length;

  if (vipFriendCount) {
    rows.push(
      buildToggleRow({
        key: "vip-header",
        label: t("side_panel.favorite"),
        count: vipFriendCount,
        isExpanded: isVIPFriends.value,
        onClick: toggleVIPFriends,
      })
    );
  }

  if (isVIPFriends.value) {
    if (isSidebarDivideByFriendGroup.value) {
      vipFriendsDivideByGroup.value.forEach((group, groupIndex) => {
        const groupName = group[0]?.groupName ?? "";
        const groupKey = group[0]?.key ?? groupIndex;
        const isExpanded = !collapsedFavGroups.has(groupKey);
        if (groupName) {
          rows.push(
            buildToggleRow({
              key: `vip-subheader:${groupKey}`,
              label: groupName,
              count: group.length,
              isExpanded,
              headerPadding: "4px 0 4px 4px",
              onClick: () => {
                if (collapsedFavGroups.has(groupKey)) {
                  collapsedFavGroups.delete(groupKey);
                } else {
                  collapsedFavGroups.add(groupKey);
                }
              },
            })
          );
        }
        if (isExpanded) {
          group.forEach((friend, idx) => {
            rows.push(
              buildFriendRow(friend, `vip:${groupKey}:${friend.id}`, {
                paddingBottom: idx === group.length - 1 ? 10 : undefined,
              })
            );
          });
        }
      });
    } else {
      visibleFavoriteOnlineFriends.value.forEach((friend) => {
        rows.push(buildFriendRow(friend, `vip:${friend.id}`));
      });
    }
  }
}

function buildSameInstanceRows(rows: SidebarRow[]) {
  if (isSidebarGroupByInstance.value && friendsInSameInstance.value.length) {
    rows.push(
      buildToggleRow({
        key: "same-instance-header",
        label: t("side_panel.same_instance"),
        count: friendsInSameInstance.value.length,
        isExpanded: !isSidebarGroupByInstanceCollapsed.value,
        onClick: toggleSwitchGroupByInstanceCollapsed,
        paddingBottom: 4,
      })
    );

    if (!isSidebarGroupByInstanceCollapsed.value) {
      friendsInSameInstance.value.forEach((friendArr, groupIndex) => {
        if (!friendArr.length) return;
        const groupKey = friendArr[0]?.ref?.$location.tag ?? `group-${groupIndex}`;
        rows.push(buildInstanceHeaderRow(getFriendsLocations(friendArr, lastLocation.value), friendArr.length, `instance:${groupKey}`));
        friendArr.forEach((friend, idx) => {
          rows.push(
            buildFriendRow(friend, `instance:${groupKey}:${friend.id}`, {
              isGroupByInstance: true,
              paddingBottom: idx === friendArr.length - 1 ? 5 : undefined,
              itemStyle: idx === friendArr.length - 1 ? { marginBottom: "6px" } : undefined,
            })
          );
        });
      });
    }
  }
}

const virtualRows = computed(() => {
  const rows: SidebarRow[] = [];

  rows.push(
    buildToggleRow({
      key: "me-header",
      label: t("side_panel.me"),
      isExpanded: isFriendsGroupMe.value,
      headerPadding: "0 0 5px",
      onClick: toggleFriendsGroupMe,
    })
  );

  if (isFriendsGroupMe.value) {
    rows.push({ type: "me-item", key: `me:${currentUser.value.id}` });
  }

  if (isSameInstanceAboveFavorites.value) {
    buildSameInstanceRows(rows);
    buildFavoriteRows(rows);
  } else {
    buildFavoriteRows(rows);
    buildSameInstanceRows(rows);
  }

  if (onlineFriendsByGroupStatus.value.length) {
    rows.push(
      buildToggleRow({
        key: "online-header",
        label: t("side_panel.online"),
        count: onlineFriendsByGroupStatus.value.length,
        isExpanded: isOnlineFriends.value,
        onClick: toggleOnlineFriends,
      })
    );
  }

  if (isOnlineFriends.value) {
    onlineFriendsByGroupStatus.value.forEach((friend) => {
      rows.push(buildFriendRow(friend, `online:${friend.id}`));
    });
  }

  if (activeFriends.value.length) {
    rows.push(
      buildToggleRow({
        key: "active-header",
        label: t("side_panel.active"),
        count: activeFriends.value.length,
        isExpanded: isActiveFriends.value,
        onClick: toggleActiveFriends,
      })
    );
  }

  if (isActiveFriends.value) {
    activeFriends.value.forEach((friend) => {
      rows.push(buildFriendRow(friend, `active:${friend.id}`));
    });
  }

  if (offlineFriends.value.length) {
    rows.push(
      buildToggleRow({
        key: "offline-header",
        label: t("side_panel.offline"),
        count: offlineFriends.value.length,
        isExpanded: isOfflineFriends.value,
        onClick: toggleOfflineFriends,
      })
    );
  }

  if (isOfflineFriends.value) {
    offlineFriends.value.forEach((friend) => {
      rows.push(buildFriendRow(friend, `offline:${friend.id}`));
    });
  }

  return rows;
});

const virtualizer = useVirtualizer(
  computed(() => ({
    count: virtualRows.value.length,
    getScrollElement: () => scrollViewportRef.value,
    estimateSize: (index: number) => estimateRowSize(virtualRows.value[index]),
    getItemKey: (index: number) => virtualRows.value[index]?.key ?? index,
    overscan: 6,
  }))
);

function measureRowElement(node: unknown) {
  if (node === null || node instanceof Element) {
    virtualizer.value.measureElement(node);
  }
}

const virtualItems = computed(() =>
  virtualizer.value.getVirtualItems().map((virtualItem) => ({
    virtualItem,
    row: virtualRows.value[virtualItem.index],
  }))
);

const virtualContainerStyle = computed<CSSProperties>(() => ({
  "--virtual-height": `${virtualizer.value.getTotalSize()}px`,
}));

function rowStyle(item: VirtualRowItem): CSSProperties {
  const paddingBottom = item.row?.paddingBottom;
  return {
    "--row-start": `${item.virtualItem.start}px`,
    ...(paddingBottom ? { "--row-padding-bottom": `${paddingBottom}px` } : {}),
  };
}

function remeasureVirtualRows() {
  void nextTick(() => {
    virtualizer.value.measure();
  }).catch(logFailure("measure friend rows"));
}

onMounted(() => {
  remeasureVirtualRows();
});

const virtualRowCount = computed(() => virtualRows.value.length);
watch(virtualRowCount, () => {
  remeasureVirtualRows();
});

const { statusOptions, recentStatuses, changeStatus, setStatusFromHistory, getPresetDisplayText, applyStatusPreset, openEditProfileFromSidebar } =
  useFriendSidebarStatus({ t, currentUser, showEditProfileDialog });

const { canInviteToMyLocation, hasFriendLocation, canJoinFriend, friendRequestInvite, friendInvite, friendSendBoop, friendJoin, friendInviteSelf } =
  useFriendSidebarActions({ t, lastLocation, lastLocationDestination, checkCanInvite, checkCanInviteSelf, showSendBoopDialog, launchStore });
</script>
