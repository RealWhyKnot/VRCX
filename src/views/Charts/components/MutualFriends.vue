<template>
  <div id="chart" class="x-container">
    <div ref="mutualGraphRef" class="mt-0 flex min-h-[calc(100vh-140px)] flex-col items-center justify-betweenpt-12">
      <div class="flex items-center w-full">
        <div class="options-container flex items-center gap-3 bg-transparent pb-3 shadow-none">
          <div>
            <TooltipWrapper v-if="isFetching" :content="t('view.charts.mutual_friend.actions.stop_fetching')" side="top">
              <Button variant="destructive" :disabled="status.cancelRequested" @click="cancelFetch">
                <Spinner />
                {{ t("view.charts.mutual_friend.actions.stop") }}
              </Button>
            </TooltipWrapper>

            <TooltipWrapper v-else :content="fetchButtonLabel" side="top">
              <Button :disabled="fetchButtonDisabled" @click="startFetch">
                {{ fetchButtonLabel }}
              </Button>
            </TooltipWrapper>
          </div>
          <VirtualCombobox
            v-if="graphReady"
            class="min-w-60"
            :model-value="selectedFriendId"
            :groups="excludePickerGroups"
            :placeholder="t('view.charts.mutual_friend.actions.go_to_friend')"
            :search-placeholder="t('view.charts.mutual_friend.actions.go_to_friend')"
            :close-on-select="true"
            :deselect-on-reselect="true"
            @update:model-value="navigateToFriend"
          >
            <template #item="{ item, selected }">
              <div class="flex w-full items-center p-1.5 text-[13px]">
                <template v-for="user in pickerUsers(item)" :key="user.id">
                  <div class="relative inline-block flex-none size-9 mr-2.5" :class="userStatusClass(user)">
                    <img class="size-full rounded-full object-cover" :src="userImage(user)" loading="lazy" />
                  </div>
                  <div class="flex-1 overflow-hidden">
                    <span class="block truncate font-medium leading-[18px] [color:var(--user-colour,inherit)]" :style="{ '--user-colour': user.$userColour }">{{
                      user.displayName
                    }}</span>
                  </div>
                </template>
                <template v-if="pickerUsers(item).length === 0">
                  <span>{{ item.label }}</span>
                </template>
                <CheckIcon :class="['ml-auto size-4', selected ? 'opacity-100' : 'opacity-0']" />
              </div>
            </template>
          </VirtualCombobox>
        </div>
        <div class="ml-auto flex items-center gap-2">
          <Sheet>
            <SheetTrigger as-child>
              <div>
                <TooltipWrapper :content="t('view.charts.mutual_friend.settings.title')" side="top">
                  <Button class="rounded-full" size="icon" variant="ghost">
                    <Settings />
                  </Button>
                </TooltipWrapper>
              </div>
            </SheetTrigger>
            <SheetContent side="right" class="w-90">
              <SheetHeader>
                <SheetTitle>{{ t("view.charts.mutual_friend.settings.title") }}</SheetTitle>
              </SheetHeader>

              <FieldGroup class="mt-4 gap-4 p-4">
                <Field>
                  <FieldLabel>{{ t("view.charts.mutual_friend.settings.layout_iterations") }}</FieldLabel>
                  <FieldContent>
                    <div class="flex items-center gap-3">
                      <Slider v-model="layoutIterationsModel" :min="LAYOUT_ITERATIONS_MIN" :max="LAYOUT_ITERATIONS_MAX" :step="100" />
                      <span class="min-w-12 text-right text-sm text-muted-foreground tabular-nums">
                        {{ layoutSettings.layoutIterations }}
                      </span>
                    </div>
                    <p class="mt-1 text-xs text-muted-foreground">
                      {{ t("view.charts.mutual_friend.settings.layout_iterations_help") }}
                    </p>
                  </FieldContent>
                </Field>

                <Field>
                  <FieldLabel>{{ t("view.charts.mutual_friend.settings.layout_spacing") }}</FieldLabel>
                  <FieldContent>
                    <div class="flex items-center gap-3">
                      <Slider v-model="layoutSpacingModel" :min="LAYOUT_SPACING_MIN" :max="LAYOUT_SPACING_MAX" :step="1" />
                      <span class="min-w-12 text-right text-sm text-muted-foreground tabular-nums">
                        {{ layoutSettings.layoutSpacing }}
                      </span>
                    </div>
                    <p class="mt-1 text-xs text-muted-foreground">
                      {{ t("view.charts.mutual_friend.settings.layout_spacing_help") }}
                    </p>
                  </FieldContent>
                </Field>

                <Field>
                  <FieldLabel>{{ t("view.charts.mutual_friend.settings.edge_curvature") }}</FieldLabel>
                  <FieldContent>
                    <div class="flex items-center gap-3">
                      <Slider v-model="edgeCurvatureModel" :min="EDGE_CURVATURE_MIN" :max="EDGE_CURVATURE_MAX" :step="0.01" />
                      <span class="min-w-12 text-right text-sm text-muted-foreground tabular-nums">
                        {{ edgeCurvatureLabel }}
                      </span>
                    </div>
                    <p class="mt-1 text-xs text-muted-foreground">
                      {{ t("view.charts.mutual_friend.settings.edge_curvature_help") }}
                    </p>
                  </FieldContent>
                </Field>

                <Field>
                  <FieldLabel>{{ t("view.charts.mutual_friend.settings.community_separation") }}</FieldLabel>
                  <FieldContent>
                    <div class="flex items-center gap-3">
                      <Slider v-model="communitySeparationModel" :min="COMMUNITY_SEPARATION_MIN" :max="COMMUNITY_SEPARATION_MAX" :step="0.1" />
                      <span class="min-w-12 text-right text-sm text-muted-foreground tabular-nums">
                        {{ communitySeparationLabel }}
                      </span>
                    </div>
                    <p class="mt-1 text-xs text-muted-foreground">
                      {{ t("view.charts.mutual_friend.settings.community_separation_help") }}
                    </p>
                  </FieldContent>
                </Field>
              </FieldGroup>

              <FieldGroup class="gap-4 p-4">
                <Field>
                  <FieldLabel>{{ t("view.charts.mutual_friend.settings.exclude_friends") }}</FieldLabel>
                  <FieldContent>
                    <VirtualCombobox
                      v-model="excludedFriendIds"
                      :groups="excludePickerGroups"
                      :placeholder="t('view.charts.mutual_friend.settings.exclude_friends_placeholder')"
                      :search-placeholder="t('view.charts.mutual_friend.actions.go_to_friend')"
                      :multiple="true"
                    >
                      <template #item="{ item, selected }">
                        <div class="flex w-full items-center p-1.5 text-[13px]">
                          <template v-for="user in pickerUsers(item)" :key="user.id">
                            <div class="relative inline-block flex-none size-9 mr-2.5" :class="userStatusClass(user)">
                              <img class="size-full rounded-full object-cover" :src="userImage(user)" loading="lazy" />
                            </div>
                            <div class="flex-1 overflow-hidden">
                              <span
                                class="block truncate font-medium leading-[18px] [color:var(--user-colour,inherit)]"
                                :style="{ '--user-colour': user.$userColour }"
                                >{{ user.displayName }}</span
                              >
                            </div>
                          </template>
                          <template v-if="pickerUsers(item).length === 0">
                            <span>{{ item.label }}</span>
                          </template>
                          <CheckIcon :class="['ml-auto size-4', selected ? 'opacity-100' : 'opacity-0']" />
                        </div>
                      </template>
                    </VirtualCombobox>
                    <p class="mt-1 text-xs text-muted-foreground">
                      {{ t("view.charts.mutual_friend.settings.exclude_friends_help") }}
                    </p>
                  </FieldContent>
                </Field>
              </FieldGroup>

              <div class="p-4 pt-0">
                <Button variant="outline" size="sm" class="w-full" @click="resetLayoutSettings">
                  {{ t("view.charts.mutual_friend.settings.reset_defaults") }}
                </Button>
              </div>
            </SheetContent>
          </Sheet>

          <div v-if="isFetching" class="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] items-center rounded-md bg-transparent p-3 w-70">
            <div class="flex justify-between text-sm mb-1">
              <span class="mr-1">{{ t("view.charts.mutual_friend.progress.friends_processed") }}</span>
              <strong>{{ fetchState.processedFriends }} / {{ totalFriends }}</strong>
            </div>
            <Progress :model-value="progressPercent" class="h-3" />
          </div>
        </div>
      </div>

      <ContextMenu @update:open="onNodeMenuOpenChange">
        <ContextMenuTrigger as-child>
          <div
            v-show="!(hasFetched && !isFetching && !graphReady)"
            ref="graphContainerRef"
            class="mt-3 h-[calc(100vh-260px)] min-h-[520px] w-full flex-1 rounded-lg bg-transparent"
          ></div>
        </ContextMenuTrigger>
        <ContextMenuContent v-if="contextMenuNodeId" class="min-w-40">
          <ContextMenuItem @click="handleNodeMenuViewDetails">
            <UserIcon class="size-4" />
            {{ t("view.charts.mutual_friend.context_menu.view_details") }}
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem @click="handleNodeMenuRefresh">
            <RefreshCwIcon class="size-4" />
            {{ t("view.charts.mutual_friend.context_menu.refresh_mutuals") }}
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem @click="handleNodeMenuHide">
            <EyeOffIcon class="size-4" />
            {{ t("view.charts.mutual_friend.context_menu.hide_friend") }}
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>

      <Empty v-if="hasFetched && !isFetching && !graphReady" class="mt-3 w-full flex-1">
        <EmptyHeader>
          <EmptyDescription>
            {{ t("view.charts.mutual_friend.progress.no_relationships_discovered") }}
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    </div>
    <BackToTop target="#chart" :right="30" :bottom="30" />
  </div>
</template>

<script setup lang="ts">
import { useLocalStorage } from "@vueuse/core";
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import Sheet from "@/components/ui/sheet/Sheet.vue";
import SheetContent from "@/components/ui/sheet/SheetContent.vue";
import SheetHeader from "@/components/ui/sheet/SheetHeader.vue";
import SheetTitle from "@/components/ui/sheet/SheetTitle.vue";
import SheetTrigger from "@/components/ui/sheet/SheetTrigger.vue";
import Field from "@/components/ui/field/Field.vue";
import FieldContent from "@/components/ui/field/FieldContent.vue";
import FieldGroup from "@/components/ui/field/FieldGroup.vue";
import FieldLabel from "@/components/ui/field/FieldLabel.vue";
import Empty from "@/components/ui/empty/Empty.vue";
import EmptyDescription from "@/components/ui/empty/EmptyDescription.vue";
import EmptyHeader from "@/components/ui/empty/EmptyHeader.vue";
import ContextMenu from "@/components/ui/context-menu/ContextMenu.vue";
import ContextMenuContent from "@/components/ui/context-menu/ContextMenuContent.vue";
import ContextMenuItem from "@/components/ui/context-menu/ContextMenuItem.vue";
import ContextMenuSeparator from "@/components/ui/context-menu/ContextMenuSeparator.vue";
import ContextMenuTrigger from "@/components/ui/context-menu/ContextMenuTrigger.vue";
import { Check as CheckIcon, EyeOff as EyeOffIcon, RefreshCw as RefreshCwIcon, Settings, User as UserIcon } from "lucide-vue-next";
import Button from "@/components/ui/button/Button.vue";
import Progress from "@/components/ui/progress/Progress.vue";
import Slider from "@/components/ui/slider/Slider.vue";
import Spinner from "@/components/ui/spinner/Spinner.vue";
import VirtualCombobox from "@/components/ui/virtual-combobox/VirtualCombobox.vue";
import { storeToRefs } from "pinia";
import { useI18n } from "vue-i18n";

import BackToTop from "@/components/BackToTop.vue";

import { useAppearanceSettingsStore } from "../../../stores/settings/appearance";
import { useUserStore } from "../../../stores/user";
import { useUserDisplay } from "../../../composables/use-user-display";
import { showUserDialog } from "../../../coordinators/user-coordinator";
import { watchState } from "../../../services/watch-state";
import type { VrcxUser } from "../../../types/vrcx";
import { logFailure } from "@/stores/log-failure";
import { firstNonEmpty } from "../composables/mutual-graph-labels";
import type { MutualNodeMeta, PickerItem } from "../composables/mutual-graph-types";
import {
  COMMUNITY_SEPARATION_MAX,
  COMMUNITY_SEPARATION_MIN,
  EDGE_CURVATURE_MAX,
  EDGE_CURVATURE_MIN,
  LAYOUT_ITERATIONS_MAX,
  LAYOUT_ITERATIONS_MIN,
  LAYOUT_SPACING_MAX,
  LAYOUT_SPACING_MIN,
  useMutualGraphLayoutSettings,
} from "../composables/use-mutual-graph-layout-settings";
import { useMutualGraph } from "../composables/use-mutual-graph";
import { useMutualGraphData } from "../composables/use-mutual-graph-data";

const { userImage, userStatusClass } = useUserDisplay();
const { t } = useI18n();
const userStore = useUserStore();
const appearanceStore = useAppearanceSettingsStore();
const { currentUser } = storeToRefs(userStore);
const { isDarkMode } = storeToRefs(appearanceStore);
const cachedUsers = userStore.cachedUsers;

const graphContainerRef = ref<HTMLDivElement | null>(null);
const mutualGraphRef = ref<HTMLDivElement | null>(null);
const contextMenuNodeId = ref<string | null>(null);
const graphMeta = ref<Map<string, MutualNodeMeta>>(new Map());

const EXCLUDED_FRIENDS_KEY = "VRCX_MutualGraphExcludedFriends";
const excludedFriendIds = useLocalStorage<string[]>(EXCLUDED_FRIENDS_KEY, []);

const {
  layoutSettings,
  layoutIterationsModel,
  layoutSpacingModel,
  edgeCurvatureModel,
  edgeCurvatureLabel,
  communitySeparationModel,
  communitySeparationLabel,
  takeLayoutSpacingDelta,
  loadLayoutSettings,
  persistLayoutSettings,
  resetLayoutSettings,
} = useMutualGraphLayoutSettings(excludedFriendIds);

const {
  graphNodeCount,
  hasCurrentGraph,
  getLastMutualMap,
  applyGraph,
  renderCurrentGraph,
  scheduleLayoutUpdate,
  focusNode,
  observeGraphContainers,
  dispose: disposeGraph,
} = useMutualGraph({
  t,
  layoutSettings,
  takeLayoutSpacingDelta,
  excludedFriendIds,
  graphContainerRef,
  isDarkMode,
  contextMenuNodeId,
  cachedUsers,
  graphMeta,
});

watch(isDarkMode, () => {
  renderCurrentGraph(true);
});

watch(
  () => [layoutSettings.layoutIterations, layoutSettings.layoutSpacing],
  () => {
    scheduleLayoutUpdate({ runLayout: true });
    persistLayoutSettings();
  }
);

watch(
  () => layoutSettings.edgeCurvature,
  () => {
    scheduleLayoutUpdate({ runLayout: false });
    persistLayoutSettings();
  }
);

watch(
  () => layoutSettings.communitySeparation,
  () => {
    scheduleLayoutUpdate({ runLayout: true });
    persistLayoutSettings();
  }
);

const {
  status,
  fetchState,
  isFetching,
  hasFetched,
  totalFriends,
  fetchButtonDisabled,
  fetchButtonLabel,
  progressPercent,
  startFetch,
  cancelFetch,
  loadGraphFromDatabase,
  handleNodeMenuRefresh,
} = useMutualGraphData({ t, graphMeta, contextMenuNodeId, applyGraph, hasCurrentGraph });

const graphReady = computed(() => graphNodeCount.value > 0);

const selectedFriendId = ref<string | null>(null);

watch(excludedFriendIds, async () => {
  const lastMutualMap = getLastMutualMap();
  if (lastMutualMap) {
    try {
      await applyGraph(lastMutualMap);
    } catch (err) {
      console.error("[MutualNetworkGraph] Failed to apply graph after exclude change", err);
    }
  }
});

const excludePickerGroups = computed(() => {
  const lastMutualMap = getLastMutualMap();
  if (!lastMutualMap) return [];
  const currentUserId = currentUser.value.id;
  const seen = new Set<string>();
  const items: PickerItem[] = [];
  for (const [friendId, { mutuals }] of lastMutualMap.entries()) {
    if (friendId === currentUserId || seen.has(friendId)) continue;
    seen.add(friendId);
    const displayName = firstNonEmpty([cachedUsers.get(friendId)?.displayName], friendId);
    items.push({ value: friendId, label: displayName, search: displayName });
    for (const mutual of mutuals) {
      if (!mutual.id || mutual.id === currentUserId || seen.has(mutual.id)) continue;
      seen.add(mutual.id);
      const mutualName = firstNonEmpty([cachedUsers.get(mutual.id)?.displayName, mutual.displayName], mutual.id);
      items.push({ value: mutual.id, label: mutualName, search: mutualName });
    }
  }
  items.sort((a, b) => a.label.localeCompare(b.label));
  return [{ key: "friends", label: t("side_panel.friends"), items }];
});

function pickerUsers(item: { value: string | number }): VrcxUser[] {
  const user = cachedUsers.get(String(item.value));
  return user ? [user] : [];
}

function navigateToFriend(friendValue: unknown) {
  const friendId = typeof friendValue === "string" && friendValue ? friendValue : null;
  selectedFriendId.value = friendId;
  focusNode(friendId);
}

function setMutualGraphHeight() {
  if (mutualGraphRef.value) {
    const availableHeight = window.innerHeight - 100;
    mutualGraphRef.value.style.height = `${availableHeight}px`;
    mutualGraphRef.value.style.overflowY = "auto";
  }
}

onMounted(() => {
  void loadLayoutSettings().catch(logFailure("Loading mutual graph layout settings failed:"));
  void nextTick(() => {
    const graphContainer = graphContainerRef.value;
    const mutualGraph = mutualGraphRef.value;
    if (!graphContainer || !mutualGraph) return;

    observeGraphContainers(graphContainer, mutualGraph, setMutualGraphHeight);
    setMutualGraphHeight();

    renderCurrentGraph();
  }).catch(logFailure("Mounting mutual graph failed:"));
});

onBeforeUnmount(() => {
  disposeGraph();
});

watch(
  () => watchState.isFriendsLoaded,
  (isFriendsLoaded) => {
    if (isFriendsLoaded) void loadGraphFromDatabase().catch(logFailure("Loading the mutual graph from the database failed:"));
  },
  { immediate: true }
);

function onNodeMenuOpenChange(isOpen: boolean) {
  if (!isOpen) {
    contextMenuNodeId.value = null;
  }
}

function handleNodeMenuViewDetails() {
  if (contextMenuNodeId.value) {
    showUserDialog(contextMenuNodeId.value);
  }
  contextMenuNodeId.value = null;
}

function handleNodeMenuHide() {
  if (contextMenuNodeId.value) {
    if (!excludedFriendIds.value.includes(contextMenuNodeId.value)) {
      excludedFriendIds.value = [...excludedFriendIds.value, contextMenuNodeId.value];
    }
  }
  contextMenuNodeId.value = null;
}
</script>
