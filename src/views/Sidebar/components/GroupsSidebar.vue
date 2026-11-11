<template>
  <div ref="scrollRootRef" class="relative h-full">
    <div ref="scrollViewportRef" class="h-full w-full overflow-auto">
      <div class="px-1.5 py-2.5">
        <div v-if="virtualRows.length" class="relative w-full box-border" :style="virtualContainerStyle">
          <template v-for="item in virtualItems" :key="String(item.virtualItem.key)">
            <div
              v-if="item.row"
              :ref="virtualizer.measureElement"
              class="absolute left-0 top-0 w-full box-border"
              :data-index="item.virtualItem.index"
              :style="rowStyle(item)"
            >
              <template v-if="item.row.type === 'group-header'">
                <div class="cursor-pointer pt-4 pb-1.5 text-xs" :style="item.row.headerPaddingTop ? { paddingTop: item.row.headerPaddingTop } : undefined">
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
    <BackToTop :virtualizer="virtualizer" :target="scrollViewportRef" :tooltip="false" />
  </div>
</template>

<script setup>
import { computed, nextTick, onMounted, ref, watch } from "vue";
import { ChevronDown, Users } from "lucide-vue-next";
import Avatar from "@/components/ui/avatar/Avatar.vue";
import AvatarFallback from "@/components/ui/avatar/AvatarFallback.vue";
import AvatarImage from "@/components/ui/avatar/AvatarImage.vue";
import { storeToRefs } from "pinia";
import { toast } from "vue-sonner";
import { useI18n } from "vue-i18n";
import { useVirtualizer } from "@tanstack/vue-virtual";

import ContextMenu from "../../../components/ui/context-menu/ContextMenu.vue";
import ContextMenuContent from "../../../components/ui/context-menu/ContextMenuContent.vue";
import ContextMenuItem from "../../../components/ui/context-menu/ContextMenuItem.vue";
import ContextMenuTrigger from "../../../components/ui/context-menu/ContextMenuTrigger.vue";
import { buildGroupHeaderRow, buildGroupItemRow, estimateGroupRowSize, getGroupId } from "../groups-sidebar-utils";
import { convertFileUrlToImageUrl } from "../../../shared/utils/common";
import { parseLocation } from "../../../shared/utils/location-parser";
import { useInviteChecks } from "../../../composables/use-invite-checks";
import { useAppearanceSettingsStore } from "../../../stores/settings/appearance";
import { useGroupStore } from "../../../stores/group";
import { useLaunchStore } from "../../../stores/launch";
import { showGroupDialog } from "../../../coordinators/group-coordinator";
import { instanceRequest } from "../../../api/instance";

import BackToTop from "../../../components/BackToTop.vue";
import Location from "../../../components/Location.vue";

const { t } = useI18n();

const launchStore = useLaunchStore();
const { isAgeGatedInstancesVisible } = storeToRefs(useAppearanceSettingsStore());
const { sortGroupInstancesByInGame } = useGroupStore();
const { groupInstances } = storeToRefs(useGroupStore());
const { checkCanInviteSelf } = useInviteChecks();

const groupInstancesCfg = ref({});
const scrollViewportRef = ref(null);
const scrollRootRef = ref(null);

const groupedGroupInstances = computed(() => {
  const groupMap = new Map();

  groupInstances.value.forEach((ref) => {
    const groupId = ref.group.groupId;
    if (!groupMap.has(groupId)) {
      groupMap.set(groupId, []);
    }
    groupMap.get(groupId).push(ref);

    if (!groupInstancesCfg.value[ref.group?.groupId]) {
      groupInstancesCfg.value = {
        [ref.group.groupId]: {
          isCollapsed: false,
        },
        ...groupInstancesCfg.value,
      };
    }
  });
  return Array.from(groupMap.values()).sort(sortGroupInstancesByInGame);
});

const buildGroupHeaderRowLocal = (group, index) => buildGroupHeaderRow(group, index, groupInstancesCfg.value);

const buildGroupItemRowLocal = (ref, index, groupId) => buildGroupItemRow(ref, index, groupId, isAgeGatedInstancesVisible.value);

const virtualRows = computed(() => {
  const rows = [];
  groupedGroupInstances.value.forEach((group, index) => {
    if (!group?.length) return;
    const groupId = getGroupId(group);
    rows.push(buildGroupHeaderRowLocal(group, index));
    if (!groupInstancesCfg.value[groupId]?.isCollapsed) {
      group.forEach((ref, idx) => {
        rows.push(buildGroupItemRowLocal(ref, idx, groupId));
      });
    }
  });
  return rows;
});

const estimateRowSize = (row) => estimateGroupRowSize(row);

const virtualizer = useVirtualizer(
  computed(() => ({
    count: virtualRows.value.length,
    getScrollElement: () => scrollViewportRef.value,
    estimateSize: (index) => estimateRowSize(virtualRows.value[index]),
    getItemKey: (index) => virtualRows.value[index]?.key ?? index,
    overscan: 6,
  }))
);

const virtualItems = computed(() => {
  const items = virtualizer.value?.getVirtualItems?.() ?? [];
  return items.map((virtualItem) => ({
    virtualItem,
    row: virtualRows.value[virtualItem.index],
  }));
});

const virtualContainerStyle = computed(() => ({
  height: `${virtualizer.value?.getTotalSize?.() ?? 0}px`,
  width: "100%",
}));

const rowStyle = (item) => ({
  transform: `translateY(${item.virtualItem.start}px)`,
});

function getSmallGroupIconUrl(url) {
  return convertFileUrlToImageUrl(url);
}

function toggleGroupSidebarCollapse(groupId) {
  groupInstancesCfg.value[groupId].isCollapsed = !groupInstancesCfg.value[groupId].isCollapsed;
}

function groupInstanceLaunch(location) {
  if (!location) return;
  launchStore.showLaunchDialog(location);
}

function groupInstanceSelfInvite(location) {
  if (!location) return;
  const L = parseLocation(location);
  if (!L.isRealInstance) return;
  instanceRequest
    .selfInvite({
      instanceId: L.instanceId,
      worldId: L.worldId,
    })
    .then(() => {
      toast.success(t("message.invite.self_sent"));
    });
}

onMounted(() => {
  nextTick(() => {
    virtualizer.value?.measure?.();
  });
});

watch(virtualRows, () => {
  nextTick(() => {
    virtualizer.value?.measure?.();
  });
});
</script>
