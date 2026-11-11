<template>
  <div class="relative h-full">
    <div ref="scrollViewportRef" class="h-full w-full overflow-auto">
      <div class="px-1.5 py-2.5">
        <div v-if="virtualRows.length" class="relative w-full box-border h-[var(--virtual-height)]" :style="virtualContainerStyle">
          <template v-for="item in virtualItems" :key="String(item.virtualItem.key)">
            <div
              v-if="item.row"
              :ref="measureRowElement"
              class="absolute left-0 top-0 w-full box-border [transform:translateY(var(--row-start))]"
              :data-index="item.virtualItem.index"
              :style="rowStyle(item)"
            >
              <template v-if="item.row.type === 'group-header'">
                <div
                  class="cursor-pointer pb-1.5 text-xs [padding-top:var(--header-padding-top,1rem)]"
                  :style="item.row.headerPaddingTop ? { '--header-padding-top': item.row.headerPaddingTop } : undefined"
                >
                  <div class="flex items-center" @click="toggleGroupSidebarCollapse(item.row.groupId)">
                    <ChevronDown class="transition-transform duration-200 ease-in-out" :class="{ '-rotate-90': item.row.isCollapsed }" />
                    <span class="ml-1.5"> {{ item.row.label }} – {{ item.row.count }} </span>
                  </div>
                </div>
              </template>

              <template v-else-if="item.row.type === 'group-item'">
                <ContextMenu>
                  <ContextMenuTrigger as-child>
                    <div
                      class="box-border flex items-center p-1.5 text-[13px] cursor-pointer hover:bg-muted/50 hover:rounded-lg"
                      @click="showGroupDialog(item.row.ownerId)"
                    >
                      <template v-if="item.row.isVisible">
                        <div class="relative inline-block flex-none size-9 mr-2.5">
                          <Avatar class="size-9">
                            <AvatarImage :src="getSmallGroupIconUrl(item.row.iconUrl)" class="object-cover" />
                            <AvatarFallback>
                              <Users class="size-4 text-muted-foreground" />
                            </AvatarFallback>
                          </Avatar>
                        </div>
                        <div class="flex-1 overflow-hidden">
                          <span class="block truncate font-medium leading-[18px]">
                            <span v-text="item.row.name"></span>
                            <span class="ml-1.5 font-normal"> ({{ item.row.userCount }}/{{ item.row.capacity }}) </span>
                          </span>
                          <Location class="text-xs" :location="item.row.location" :link="false" />
                        </div>
                      </template>
                    </div>
                  </ContextMenuTrigger>
                  <ContextMenuContent>
                    <ContextMenuItem :disabled="!checkCanInviteSelf(item.row.location)" @click="groupInstanceLaunch(item.row.location)">
                      {{ t("dialog.user.info.launch_invite_tooltip") }}
                    </ContextMenuItem>
                    <ContextMenuItem :disabled="!checkCanInviteSelf(item.row.location)" @click="groupInstanceSelfInvite(item.row.location)">
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
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from "vue";
import type { CSSProperties } from "vue";
import { ChevronDown, Users } from "lucide-vue-next";
import Avatar from "@/components/ui/avatar/Avatar.vue";
import AvatarFallback from "@/components/ui/avatar/AvatarFallback.vue";
import AvatarImage from "@/components/ui/avatar/AvatarImage.vue";
import { storeToRefs } from "pinia";
import { toast } from "vue-sonner";
import { useI18n } from "vue-i18n";
import { useVirtualizer } from "@tanstack/vue-virtual";
import type { VirtualItem } from "@tanstack/vue-virtual";

import ContextMenu from "../../../components/ui/context-menu/ContextMenu.vue";
import ContextMenuContent from "../../../components/ui/context-menu/ContextMenuContent.vue";
import ContextMenuItem from "../../../components/ui/context-menu/ContextMenuItem.vue";
import ContextMenuTrigger from "../../../components/ui/context-menu/ContextMenuTrigger.vue";
import type { GroupCollapseConfig, GroupSidebarRow } from "../groups-sidebar-utils";
import { buildGroupHeaderRow, buildGroupItemRow, estimateGroupRowSize, getGroupId } from "../groups-sidebar-utils";
import { convertFileUrlToImageUrl } from "../../../shared/utils/common";
import { parseLocation } from "../../../shared/utils/location-parser";
import { useInviteChecks } from "../../../composables/use-invite-checks";
import { useAppearanceSettingsStore } from "../../../stores/settings/appearance";
import type { GroupInstanceEntry } from "../../../stores/group-types";
import { useGroupStore } from "../../../stores/group";
import { useLaunchStore } from "../../../stores/launch";
import { logFailure } from "../../../stores/log-failure";
import { showGroupDialog } from "../../../coordinators/group-dialog-coordinator";
import { instanceRequest } from "../../../api/instance";

import BackToTop from "../../../components/BackToTop.vue";
import Location from "../../../components/Location.vue";

type VirtualRowItem = { virtualItem: VirtualItem; row: GroupSidebarRow | undefined };

const { t } = useI18n();

const launchStore = useLaunchStore();
const { isAgeGatedInstancesVisible } = storeToRefs(useAppearanceSettingsStore());
const { sortGroupInstancesByInGame } = useGroupStore();
const { groupInstances } = storeToRefs(useGroupStore());
const { checkCanInviteSelf } = useInviteChecks();

const groupInstancesCfg = ref<GroupCollapseConfig>({});
const scrollViewportRef = ref<HTMLDivElement | null>(null);

const groupedGroupInstances = computed(() => {
  const groupMap = new Map<string, GroupInstanceEntry[]>();

  groupInstances.value.forEach((entry) => {
    const groupId = entry.group.groupId;
    const entries = groupMap.get(groupId);
    if (entries) {
      entries.push(entry);
    } else {
      groupMap.set(groupId, [entry]);
    }

    if (!groupInstancesCfg.value[groupId]) {
      groupInstancesCfg.value = {
        [groupId]: {
          isCollapsed: false,
        },
        ...groupInstancesCfg.value,
      };
    }
  });
  return Array.from(groupMap.values()).sort((a, b) => {
    const first = a[0];
    const second = b[0];
    if (!first || !second) return 0;
    return sortGroupInstancesByInGame(first, second);
  });
});

const virtualRows = computed<GroupSidebarRow[]>(() => {
  const rows: GroupSidebarRow[] = [];
  groupedGroupInstances.value.forEach((group, index) => {
    if (!group.length) return;
    const groupId = getGroupId(group);
    rows.push(buildGroupHeaderRow(group, index, groupInstancesCfg.value));
    if (!groupInstancesCfg.value[groupId]?.isCollapsed) {
      group.forEach((entry, idx) => {
        rows.push(buildGroupItemRow(entry, idx, groupId, isAgeGatedInstancesVisible.value));
      });
    }
  });
  return rows;
});

const virtualizer = useVirtualizer(
  computed(() => ({
    count: virtualRows.value.length,
    getScrollElement: () => scrollViewportRef.value,
    estimateSize: (index: number) => estimateGroupRowSize(virtualRows.value[index]),
    getItemKey: (index: number) => virtualRows.value[index]?.key ?? index,
    overscan: 6,
  }))
);

function measureRowElement(node: unknown) {
  if (node === null || node instanceof Element) {
    virtualizer.value.measureElement(node);
  }
}

const virtualItems = computed<VirtualRowItem[]>(() =>
  virtualizer.value.getVirtualItems().map((virtualItem) => ({
    virtualItem,
    row: virtualRows.value[virtualItem.index],
  }))
);

const virtualContainerStyle = computed<CSSProperties>(() => ({
  "--virtual-height": `${virtualizer.value.getTotalSize()}px`,
}));

function rowStyle(item: VirtualRowItem): CSSProperties {
  return {
    "--row-start": `${item.virtualItem.start}px`,
  };
}

function getSmallGroupIconUrl(url: string) {
  return convertFileUrlToImageUrl(url);
}

function toggleGroupSidebarCollapse(groupId: string) {
  const entry = groupInstancesCfg.value[groupId];
  if (!entry) return;
  entry.isCollapsed = !entry.isCollapsed;
}

function groupInstanceLaunch(location: string | undefined) {
  if (!location) return;
  void launchStore.showLaunchDialog(location).catch(logFailure("show launch dialog"));
}

function groupInstanceSelfInvite(location: string | undefined) {
  if (!location) return;
  const L = parseLocation(location);
  if (!L.isRealInstance) return;
  void instanceRequest
    .selfInvite({
      instanceId: L.instanceId,
      worldId: L.worldId,
    })
    .then(() => {
      toast.success(t("message.invite.self_sent"));
    })
    .catch(logFailure("send self invite"));
}

function remeasureVirtualRows() {
  void nextTick(() => {
    virtualizer.value.measure();
  }).catch(logFailure("measure group rows"));
}

onMounted(() => {
  remeasureVirtualRows();
});

watch(virtualRows, () => {
  remeasureVirtualRows();
});
</script>
