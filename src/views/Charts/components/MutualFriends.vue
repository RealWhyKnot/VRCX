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
                    <span class="block truncate font-medium leading-[18px]" :style="{ color: user.$userColour }">{{ user.displayName }}</span>
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
                              <span class="block truncate font-medium leading-[18px]" :style="{ color: user.$userColour }">{{ user.displayName }}</span>
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
            :style="{ backgroundColor: canvasBackground }"
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
defineOptions({ name: "ChartsMutual" });

import { useLocalStorage } from "@vueuse/core";
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from "vue";
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
import { layerBorder } from "@sigma/node-border";
import { pathCurved } from "sigma/rendering";
import type { NodeDisplayData } from "sigma/types";
import { storeToRefs } from "pinia";
import { toast } from "vue-sonner";
import { useI18n } from "vue-i18n";

import BackToTop from "@/components/BackToTop.vue";
import dayjs from "dayjs";
import Graph from "graphology";
import Sigma from "sigma";
import louvain from "graphology-communities-louvain";

import GraphLayoutWorker from "../graph-layout-worker.ts?worker&inline";

import { useAppearanceSettingsStore } from "../../../stores/settings/appearance";
import { useChartsStore } from "../../../stores/charts";
import { useFriendStore } from "../../../stores/friend";
import { useModalStore } from "../../../stores/modal";
import { useUserStore } from "../../../stores/user";
import { useUserDisplay } from "../../../composables/use-user-display";
import { showUserDialog } from "../../../coordinators/user-coordinator";
import { database } from "../../../services/database";
import { watchState } from "../../../services/watch-state";
import type { VrcxUser } from "../../../types/vrcx";
import { logFailure } from "@/stores/log-failure";

import { configRepository } from "../../../services/config";

type MutualNodeAttributes = {
  label: string;
  size: number;
  x?: number;
  y?: number;
  color?: string | undefined;
  community?: number | undefined;
  isOptedOut?: boolean;
  lastFetchedAt?: string | null;
};

type MutualEdgeAttributes = {
  size: number;
  curvature?: number;
};

type MutualGraph = Graph<MutualNodeAttributes, MutualEdgeAttributes>;

type MutualNodeMeta = {
  lastFetchedAt: string | null;
  isOptedOut: boolean;
};

type MutualMapEntry = {
  friend: { id: string; ref?: VrcxUser | undefined };
  mutuals: { id: string; displayName?: string | undefined }[];
};

type MutualMap = Map<string, MutualMapEntry>;

type PickerItem = {
  value: string;
  label: string;
  search: string;
};

type LayoutPosition = { x: number; y: number };

type LayoutPositions = Record<string, LayoutPosition>;

type LayoutResolver = {
  resolve: (positions: LayoutPositions) => void;
  reject: (reason: unknown) => void;
};

type LayoutMessage = {
  requestId: number;
  positions: LayoutPositions | undefined;
  error: string | undefined;
};

type LayoutCommunity = {
  nodes: { node: string; x: number; y: number }[];
  cx: number;
  cy: number;
};

type SigmaCameraState = ReturnType<ReturnType<Sigma["getCamera"]>["getState"]>;

type NodeReducerResult = Partial<NodeDisplayData> & { borderColor?: string };

const { userImage, userStatusClass } = useUserDisplay();
const { t } = useI18n();
const friendStore = useFriendStore();
const userStore = useUserStore();
const modalStore = useModalStore();
const chartsStore = useChartsStore();
const appearanceStore = useAppearanceSettingsStore();
const { friends } = storeToRefs(friendStore);
const { currentUser } = storeToRefs(userStore);
const { isDarkMode } = storeToRefs(appearanceStore);
const cachedUsers = userStore.cachedUsers;

const fetchState = chartsStore.mutualGraphFetchState;
const status = chartsStore.mutualGraphStatus;

const MAX_LABEL_NAME_LENGTH = 20;

const COLORS_PALETTE = ["#5470c6", "#91cc75", "#fac858", "#ee6666", "#73c0de", "#3ba272", "#fc8452", "#9a60b4", "#ea7ccc"];

const NODE_BORDER_LAYER = layerBorder({
  borders: [
    { size: 0.1, color: "#f2f2f2", mode: "relative" },
    { size: 0, color: { attribute: "color" }, fill: true },
  ],
});

function renderLastFetchedAttachment({ attributes, pixelRatio }: { attributes: Record<string, unknown>; pixelRatio: number }) {
  const lastFetchedAt = attributes["lastFetchedAt"];
  if (typeof lastFetchedAt !== "string" || !lastFetchedAt) return null;

  const text = `${t("view.charts.mutual_friend.context_menu.last_fetched")}: ${dayjs(lastFetchedAt).format("YYYY-MM-DD HH:mm")}`;
  const fontSize = 10;
  const font = `${fontSize}px sans-serif`;
  const paddingX = 6;
  const paddingY = 3;

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.font = font;
  const width = Math.ceil(ctx.measureText(text).width) + paddingX * 2;
  const height = fontSize + paddingY * 2;

  canvas.width = width * pixelRatio;
  canvas.height = height * pixelRatio;
  ctx.scale(pixelRatio, pixelRatio);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  ctx.font = font;
  ctx.textBaseline = "middle";
  ctx.fillStyle = attributes["isOptedOut"] === true ? "#dc2626" : "#6b7280";
  ctx.fillText(text, paddingX, height / 2);

  const content: { type: "canvas"; canvas: HTMLCanvasElement } = { type: "canvas", canvas };
  return content;
}

const graphContainerRef = ref<HTMLDivElement | null>(null);
const mutualGraphRef = ref<HTMLDivElement | null>(null);

let sigmaInstance: Sigma<MutualNodeAttributes, MutualEdgeAttributes> | null = null;
let currentGraph: MutualGraph | null = null;
let hoveredNode: string | null = null;
let hoveredNeighbors = new Set<string>();
let resizeObserver: ResizeObserver | null = null;
let mutualGraphResizeObserver: ResizeObserver | null = null;
let pendingRender: number | null = null;
let pendingLayoutUpdate: ReturnType<typeof setTimeout> | null = null;
let lastMutualMap: MutualMap | null = null;
let layoutWorker: Worker | null = null;
let layoutRequestId = 0;
const layoutResolvers = new Map<number, LayoutResolver>();
let layoutQueue: Promise<void> = Promise.resolve();

function getLayoutWorker() {
  if (!layoutWorker) {
    layoutWorker = new GraphLayoutWorker();
    layoutWorker.addEventListener("message", handleLayoutMessage);
    layoutWorker.addEventListener("error", handleLayoutError);
  }
  return layoutWorker;
}

function isLayoutPosition(value: unknown): value is LayoutPosition {
  return typeof value === "object" && value !== null && "x" in value && "y" in value && typeof value.x === "number" && typeof value.y === "number";
}

function isLayoutPositions(value: unknown): value is LayoutPositions {
  return typeof value === "object" && value !== null && Object.values(value).every(isLayoutPosition);
}

function readLayoutMessage(value: unknown): LayoutMessage | null {
  if (typeof value !== "object" || value === null) return null;
  if (!("requestId" in value) || typeof value.requestId !== "number") return null;
  const positions = "positions" in value ? value.positions : undefined;
  const error = "error" in value ? value.error : undefined;
  if (positions !== undefined && !isLayoutPositions(positions)) return null;
  if (error !== undefined && typeof error !== "string") return null;
  return { requestId: value.requestId, positions, error };
}

function handleLayoutMessage(event: MessageEvent<unknown>) {
  const message = readLayoutMessage(event.data);
  if (!message) return;
  const resolver = layoutResolvers.get(message.requestId);
  if (!resolver) return;
  layoutResolvers.delete(message.requestId);
  if (message.error) {
    resolver.reject(new Error(message.error));
  } else {
    resolver.resolve(message.positions ?? {});
  }
}

function handleLayoutError(err: ErrorEvent) {
  for (const [id, resolver] of layoutResolvers) {
    resolver.reject(err);
    layoutResolvers.delete(id);
  }
}

const LAYOUT_ITERATIONS_MIN = 300;
const LAYOUT_ITERATIONS_MAX = 1500;
const LAYOUT_SPACING_MIN = 8;
const LAYOUT_SPACING_MAX = 240;
const EDGE_CURVATURE_MIN = 0;
const EDGE_CURVATURE_MAX = 0.2;
const COMMUNITY_SEPARATION_MIN = 0;
const COMMUNITY_SEPARATION_MAX = 3;

const LAYOUT_DEFAULTS = {
  layoutIterations: 800,
  layoutSpacing: 60,
  edgeCurvature: 0.1,
  communitySeparation: 0,
};

const layoutSettings = reactive({ ...LAYOUT_DEFAULTS });

const layoutIterationsModel = computed({
  get: () => [layoutSettings.layoutIterations],
  set: (value: number[] | undefined) => {
    layoutSettings.layoutIterations = clampNumber(Math.round(value?.[0] ?? layoutSettings.layoutIterations), LAYOUT_ITERATIONS_MIN, LAYOUT_ITERATIONS_MAX);
  },
});

const layoutSpacingModel = computed({
  get: () => [layoutSettings.layoutSpacing],
  set: (value: number[] | undefined) => {
    layoutSettings.layoutSpacing = clampNumber(Math.round(value?.[0] ?? layoutSettings.layoutSpacing), LAYOUT_SPACING_MIN, LAYOUT_SPACING_MAX);
  },
});

const edgeCurvatureModel = computed({
  get: () => [layoutSettings.edgeCurvature],
  set: (value: number[] | undefined) => {
    const next = clampNumber(value?.[0] ?? layoutSettings.edgeCurvature, EDGE_CURVATURE_MIN, EDGE_CURVATURE_MAX);
    layoutSettings.edgeCurvature = Number(next.toFixed(2));
  },
});

const edgeCurvatureLabel = computed(() => layoutSettings.edgeCurvature.toFixed(2));

const communitySeparationModel = computed({
  get: () => [layoutSettings.communitySeparation],
  set: (value: number[] | undefined) => {
    const next = clampNumber(value?.[0] ?? layoutSettings.communitySeparation, COMMUNITY_SEPARATION_MIN, COMMUNITY_SEPARATION_MAX);
    layoutSettings.communitySeparation = Number(next.toFixed(1));
  },
});
const communitySeparationLabel = computed(() => layoutSettings.communitySeparation.toFixed(1));

let lastLayoutSpacing = layoutSettings.layoutSpacing;

watch(isDarkMode, () => {
  if (!currentGraph) return;
  renderGraph(currentGraph, true);
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

async function loadLayoutSettings() {
  const [iterations, spacing, curvature, separation] = await Promise.all([
    configRepository.getInt("VRCX_MutualGraphLayoutIterations", LAYOUT_DEFAULTS.layoutIterations),
    configRepository.getInt("VRCX_MutualGraphLayoutSpacing", LAYOUT_DEFAULTS.layoutSpacing),
    configRepository.getFloat("VRCX_MutualGraphEdgeCurvature", LAYOUT_DEFAULTS.edgeCurvature),
    configRepository.getFloat("VRCX_MutualGraphCommunitySeparation", LAYOUT_DEFAULTS.communitySeparation),
  ]);
  layoutSettings.layoutIterations = clampNumber(iterations, LAYOUT_ITERATIONS_MIN, LAYOUT_ITERATIONS_MAX);
  layoutSettings.layoutSpacing = clampNumber(spacing, LAYOUT_SPACING_MIN, LAYOUT_SPACING_MAX);
  layoutSettings.edgeCurvature = clampNumber(curvature, EDGE_CURVATURE_MIN, EDGE_CURVATURE_MAX);
  layoutSettings.communitySeparation = clampNumber(separation, COMMUNITY_SEPARATION_MIN, COMMUNITY_SEPARATION_MAX);
  lastLayoutSpacing = layoutSettings.layoutSpacing;
}

function persistLayoutSettings() {
  const saveFailed = logFailure("Saving mutual graph layout settings failed:");
  void configRepository.setInt("VRCX_MutualGraphLayoutIterations", layoutSettings.layoutIterations).catch(saveFailed);
  void configRepository.setInt("VRCX_MutualGraphLayoutSpacing", layoutSettings.layoutSpacing).catch(saveFailed);
  void configRepository.setFloat("VRCX_MutualGraphEdgeCurvature", layoutSettings.edgeCurvature).catch(saveFailed);
  void configRepository.setFloat("VRCX_MutualGraphCommunitySeparation", layoutSettings.communitySeparation).catch(saveFailed);
}

function resetLayoutSettings() {
  Object.assign(layoutSettings, LAYOUT_DEFAULTS);
  excludedFriendIds.value = [];
  persistLayoutSettings();
}

const isFetching = computed({
  get: () => status.isFetching,
  set: (isActive: boolean) => {
    status.isFetching = isActive;
  },
});
const hasFetched = computed({
  get: () => status.hasFetched,
  set: (isLoaded: boolean) => {
    status.hasFetched = isLoaded;
  },
});

const graphNodeCount = ref(0);
const isLoadingSnapshot = ref(false);
const totalFriends = computed(() => friends.value.size);
const isOptOut = computed(() => currentUser.value.hasSharedConnectionsOptOut);
const graphReady = computed(() => graphNodeCount.value > 0);
const fetchButtonDisabled = computed(() => isFetching.value || isOptOut.value || totalFriends.value === 0 || isLoadingSnapshot.value);
const fetchButtonLabel = computed(() =>
  hasFetched.value ? t("view.charts.mutual_friend.actions.fetch_again") : t("view.charts.mutual_friend.actions.start_fetch")
);
const progressPercent = computed(() => (totalFriends.value ? Math.min(100, Math.round((fetchState.processedFriends / totalFriends.value) * 100)) : 0));

const canvasBackground = computed(() => "transparent");

const selectedFriendId = ref<string | null>(null);

const contextMenuNodeId = ref<string | null>(null);
const graphMeta = ref<Map<string, MutualNodeMeta>>(new Map());
const isRefreshingNode = ref(false);

const EXCLUDED_FRIENDS_KEY = "VRCX_MutualGraphExcludedFriends";
const excludedFriendIds = useLocalStorage<string[]>(EXCLUDED_FRIENDS_KEY, []);

watch(excludedFriendIds, async () => {
  if (lastMutualMap) {
    try {
      await applyGraph(lastMutualMap);
    } catch (err) {
      console.error("[MutualNetworkGraph] Failed to apply graph after exclude change", err);
    }
  }
});

const excludePickerGroups = computed(() => {
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
  if (!friendId || !currentGraph || !sigmaInstance) return;
  if (!currentGraph.hasNode(friendId)) return;
  const nodeDisplayData = sigmaInstance.getNodeDisplayData(friendId);
  if (!nodeDisplayData) return;
  const camera = sigmaInstance.getCamera();
  void camera
    .animate({ x: nodeDisplayData.x, y: nodeDisplayData.y, ratio: 0.15 }, { duration: 300 })
    .catch(logFailure("Animating the mutual graph camera failed:"));
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

    resizeObserver = new ResizeObserver(() => {
      sigmaInstance?.refresh();
    });
    resizeObserver.observe(graphContainer);
    mutualGraphResizeObserver = new ResizeObserver(() => setMutualGraphHeight());
    mutualGraphResizeObserver.observe(mutualGraph);
    setMutualGraphHeight();

    if (currentGraph) renderGraph(currentGraph);
  }).catch(logFailure("Mounting mutual graph failed:"));
});

onBeforeUnmount(() => {
  if (resizeObserver) {
    resizeObserver.disconnect();
    resizeObserver = null;
  }
  if (sigmaInstance) {
    sigmaInstance.kill();
    sigmaInstance = null;
  }
  currentGraph = null;
  if (layoutWorker) {
    for (const [id, resolver] of layoutResolvers) {
      resolver.reject(new Error("Component unmounted"));
      layoutResolvers.delete(id);
    }
    layoutWorker.terminate();
    layoutWorker = null;
  }
  if (mutualGraphResizeObserver) {
    mutualGraphResizeObserver.disconnect();
    mutualGraphResizeObserver = null;
  }
});

watch(
  () => watchState.isFriendsLoaded,
  (isFriendsLoaded) => {
    if (isFriendsLoaded) void loadGraphFromDatabase().catch(logFailure("Loading the mutual graph from the database failed:"));
  },
  { immediate: true }
);

function showStatusMessage(message: string, type: "info" | "success" | "warning" | "error" = "info") {
  if (!message) return;
  toast[type](message, { duration: 4000 });
}

function truncateLabelText(text: string) {
  if (!text) return "Unknown";
  return text.length > MAX_LABEL_NAME_LENGTH ? `${text.slice(0, MAX_LABEL_NAME_LENGTH)}…` : text;
}

function firstNonEmpty(values: (string | null | undefined)[], fallback: string) {
  for (const value of values) {
    if (value) return value;
  }
  return fallback;
}

function clampNumber(value: number, min: number, max: number) {
  const normalized = Number.isFinite(value) ? value : min;
  return Math.min(max, Math.max(min, normalized));
}

function serializeGraph(graph: MutualGraph) {
  const nodes: { id: string; attributes: MutualNodeAttributes }[] = [];
  graph.forEachNode((id, attributes) => {
    nodes.push({ id, attributes: { ...attributes } });
  });
  const edges: { key: string; source: string; target: string; attributes: MutualEdgeAttributes }[] = [];
  graph.forEachEdge((key, attributes, source, target) => {
    edges.push({ key, source, target, attributes: { ...attributes } });
  });
  return { nodes, edges };
}

async function runLayout(graph: MutualGraph, { reinitialize }: { reinitialize?: boolean } = {}) {
  const spacing = clampNumber(layoutSettings.layoutSpacing, LAYOUT_SPACING_MIN, LAYOUT_SPACING_MAX);
  const deltaSpacing = spacing - lastLayoutSpacing;
  lastLayoutSpacing = spacing;

  const { nodes, edges } = serializeGraph(graph);
  const worker = getLayoutWorker();
  const id = ++layoutRequestId;

  const task = layoutQueue.then(async () => {
    const positions = await new Promise<LayoutPositions>((resolve, reject) => {
      layoutResolvers.set(id, { resolve, reject });
      worker.postMessage({
        requestId: id,
        nodes,
        edges,
        settings: {
          layoutIterations: layoutSettings.layoutIterations,
          layoutSpacing: spacing,
          deltaSpacing,
          reinitialize: reinitialize ?? false,
        },
      });
    });

    for (const [nodeId, pos] of Object.entries(positions)) {
      if (graph.hasNode(nodeId)) {
        graph.mergeNodeAttributes(nodeId, { x: pos.x, y: pos.y });
      }
    }
  });

  layoutQueue = task.catch(logFailure("Mutual graph layout failed:"));
  return task;
}

function applyEdgeCurvature(graph: MutualGraph) {
  const curvature = clampNumber(layoutSettings.edgeCurvature, EDGE_CURVATURE_MIN, EDGE_CURVATURE_MAX);

  graph.forEachEdge((edge) => {
    graph.mergeEdgeAttributes(edge, { curvature });
  });
}

function applyCommunitySeparation(graph: MutualGraph) {
  const separation = layoutSettings.communitySeparation;
  if (separation <= 0) return;

  const communities = new Map<number, LayoutCommunity>();
  graph.forEachNode((node, attrs) => {
    const cid = attrs.community;
    if (cid === undefined || attrs.x === undefined || attrs.y === undefined) return;
    let community = communities.get(cid);
    if (!community) {
      community = { nodes: [], cx: 0, cy: 0 };
      communities.set(cid, community);
    }
    community.nodes.push({ node, x: attrs.x, y: attrs.y });
  });

  for (const [, data] of communities) {
    let sx = 0;
    let sy = 0;
    for (const n of data.nodes) {
      sx += n.x;
      sy += n.y;
    }
    data.cx = sx / data.nodes.length;
    data.cy = sy / data.nodes.length;
  }

  let gcx = 0;
  let gcy = 0;
  let total = 0;
  for (const [, data] of communities) {
    gcx += data.cx * data.nodes.length;
    gcy += data.cy * data.nodes.length;
    total += data.nodes.length;
  }
  gcx /= total;
  gcy /= total;

  for (const [, data] of communities) {
    const dx = data.cx - gcx;
    const dy = data.cy - gcy;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
    const pushX = (dx / dist) * separation * 100;
    const pushY = (dy / dist) * separation * 100;
    for (const n of data.nodes) {
      graph.mergeNodeAttributes(n.node, {
        x: n.x + pushX,
        y: n.y + pushY,
      });
    }
  }
}

function scheduleLayoutUpdate({ runLayout: shouldRunLayout }: { runLayout: boolean }) {
  if (!currentGraph) return;
  if (pendingLayoutUpdate) clearTimeout(pendingLayoutUpdate);
  pendingLayoutUpdate = setTimeout(() => {
    pendingLayoutUpdate = null;
    void applyScheduledLayout(shouldRunLayout).catch(logFailure("[MutualNetworkGraph] Layout update failed"));
  }, 100);
}

async function applyScheduledLayout(shouldRunLayout: boolean) {
  const graph = currentGraph;
  if (!graph) return;
  applyEdgeCurvature(graph);
  if (shouldRunLayout) {
    await runLayout(graph, { reinitialize: false });
    applyCommunitySeparation(graph);
  }
  renderGraph(graph);
}

function assignCommunitiesAndColors(graph: MutualGraph) {
  const communities = louvain(graph);
  const ids = Array.from(new Set(Object.values(communities)));
  ids.sort((a, b) => String(a).localeCompare(String(b)));
  const idToIndex = new Map<number, number>(ids.map((id, i): [number, number] => [id, i]));

  graph.forEachNode((node) => {
    const communityId = communities[node];
    const idx = communityId === undefined ? 0 : (idToIndex.get(communityId) ?? 0);
    graph.setNodeAttribute(node, "community", communityId);
    graph.setNodeAttribute(node, "color", COLORS_PALETTE[idx % COLORS_PALETTE.length]);
  });
}

async function buildGraphFromMutualMap(mutualMap: MutualMap, meta: Map<string, MutualNodeMeta> | null = null): Promise<MutualGraph> {
  const graph: MutualGraph = new Graph<MutualNodeAttributes, MutualEdgeAttributes>({
    type: "undirected",
    multi: false,
    allowSelfLoops: false,
  });

  const excludeSet = new Set(excludedFriendIds.value);
  const nodeDegree = new Map<string, number>();
  const nodeNames = new Map<string, string>();

  function ensureNode(id: string, name: string | null | undefined) {
    if (!id || excludeSet.has(id)) return;
    if (!graph.hasNode(id)) {
      graph.addNode(id);
      nodeDegree.set(id, 0);
    }
    if (name && !nodeNames.get(id)) nodeNames.set(id, name);
  }

  function addEdge(source: string, target: string) {
    if (!source || !target || source === target) return;
    if (excludeSet.has(source) || excludeSet.has(target)) return;
    const [a, b]: [string, string] = source < target ? [source, target] : [target, source];
    const key = `${a}__${b}`;
    if (graph.hasEdge(key)) return;
    graph.addEdgeWithKey(key, a, b, { size: 0.75 });
    nodeDegree.set(a, (nodeDegree.get(a) ?? 0) + 1);
    nodeDegree.set(b, (nodeDegree.get(b) ?? 0) + 1);
  }

  for (const [friendId, { friend, mutuals }] of mutualMap.entries()) {
    const friendRef = friend.ref ?? cachedUsers.get(friendId);
    ensureNode(friendId, firstNonEmpty([friendRef?.displayName], friendId));

    for (const mutual of mutuals) {
      if (!mutual.id) continue;
      const label = firstNonEmpty([cachedUsers.get(mutual.id)?.displayName, mutual.displayName], mutual.id);
      ensureNode(mutual.id, label);
      addEdge(friendId, mutual.id);
    }
  }

  const nodeIds = graph.nodes();
  const maxDegree = nodeIds.reduce((max, id) => Math.max(max, nodeDegree.get(id) ?? 0), 0);

  nodeIds.forEach((id) => {
    const degree = nodeDegree.get(id) ?? 0;
    const size = 4 + (maxDegree ? (degree / maxDegree) * 18 : 0);
    const label = truncateLabelText(firstNonEmpty([nodeNames.get(id)], id));
    const attrs: Partial<MutualNodeAttributes> = { label, size };
    const nodeMeta = meta?.get(id);
    if (nodeMeta) {
      attrs.isOptedOut = nodeMeta.isOptedOut;
      attrs.lastFetchedAt = nodeMeta.lastFetchedAt;
    }
    graph.mergeNodeAttributes(id, attrs);
  });

  if (graph.order > 1) {
    await runLayout(graph, { reinitialize: true });
    assignCommunitiesAndColors(graph);
    applyCommunitySeparation(graph);
    applyEdgeCurvature(graph);
  }

  graphNodeCount.value = graph.order;
  return graph;
}

function markLabelsDirty(sigma: Sigma<MutualNodeAttributes, MutualEdgeAttributes>) {
  const labelRenderer: unknown = Reflect.get(sigma, "labelRenderer");
  if (typeof labelRenderer === "object" && labelRenderer !== null && "labelsDirty" in labelRenderer) {
    labelRenderer.labelsDirty = true;
  }
}

function renderGraph(graph: MutualGraph, shouldRecreate = false) {
  const container = graphContainerRef.value;
  if (!container) return;
  const { width, height } = container.getBoundingClientRect();
  if (!width || !height) {
    if (pendingRender !== null) return;
    pendingRender = requestAnimationFrame(() => {
      pendingRender = null;
      renderGraph(graph, shouldRecreate);
    });
    return;
  }

  const defaultLabelThreshold = 10;

  const labelColor = isDarkMode.value ? "#ffffff" : "#000000";
  const edgeBase = isDarkMode.value ? "#334155" : "#cbd5e1";
  const edgeActive = isDarkMode.value ? "#bac1c9" : "#475569";
  const nodeFaded = isDarkMode.value ? "rgba(148,163,184,0.04)" : "rgba(100,116,139,0.06)";
  const labelBackground = isDarkMode.value ? "rgba(10,10,10,0.65)" : "rgba(255,255,255,0.7)";

  let cameraState: SigmaCameraState | null = null;

  if (sigmaInstance && shouldRecreate) {
    try {
      cameraState = sigmaInstance.getCamera().getState();
    } catch (error: unknown) {
      console.warn("[MutualNetworkGraph] Could not read the camera state", error);
    }
    sigmaInstance.kill();
    sigmaInstance = null;
  }

  hoveredNode = null;
  hoveredNeighbors = new Set<string>();

  if (sigmaInstance) {
    sigmaInstance.setGraph(graph);
    sigmaInstance.refresh();
    return;
  }

  const sigma = new Sigma<MutualNodeAttributes, MutualEdgeAttributes>(graph, container, {
    primitives: {
      nodes: {
        layers: [NODE_BORDER_LAYER],
        label: {},
        backdrop: {},
        labelAttachments: { lastFetched: renderLastFetchedAttachment },
      },
      edges: {
        paths: [pathCurved()],
      },
    },
    settings: {
      allowInvalidContainer: true,
      renderLabels: true,
      itemSizesReference: "screen",
      labelRenderedSizeThreshold: defaultLabelThreshold,
    },
    nodeReducer: (node, data, attrs) => {
      const res: NodeReducerResult = {
        labelColor,
        labelBackgroundColor: labelBackground,
        labelBackgroundPadding: 2,
      };

      if (attrs.isOptedOut) {
        res.borderColor = "#9ca3af";
      }

      if (!hoveredNode) {
        res.color = attrs.isOptedOut ? "#d1d5db" : data.color;
        res.zIndex = 1;
        return res;
      }

      if (node === hoveredNode) {
        res.color = "#facc15";
        res.size = (attrs.size || 4) * 1.2;
        res.label = `${data.label} (${hoveredNeighbors.size})`;
        res.labelColor = "#111827";
        res.labelBackgroundColor = "";
        res.labelVisibility = "visible";
        res.labelAttachment = attrs.lastFetchedAt ? "lastFetched" : "";
        res.zIndex = 3;
        return res;
      }

      if (hoveredNeighbors.has(node)) {
        res.labelVisibility = "visible";
        res.zIndex = 2;
        return res;
      }

      res.color = nodeFaded;
      res.size = 0.7;
      res.labelVisibility = "hidden";
      res.zIndex = 0;
      return res;
    },
    edgeReducer: (edge, _data, _attrs, _state, _graphState, graphView) => {
      if (!hoveredNode) {
        return { color: edgeBase };
      }
      const [s, t] = graphView.extremities(edge);
      if (s === hoveredNode || t === hoveredNode) {
        return { color: edgeActive };
      }
      return { visibility: "hidden" };
    },
  });
  sigmaInstance = sigma;

  if (cameraState) {
    try {
      sigma.getCamera().setState(cameraState);
    } catch (error: unknown) {
      console.warn("[MutualNetworkGraph] Could not restore the camera state", error);
    }
  }

  sigma.on("beforeRender", () => {
    if (hoveredNode) markLabelsDirty(sigma);
  });

  sigma.on("enterNode", ({ node }) => {
    hoveredNode = node;
    hoveredNeighbors = new Set(sigma.getGraph().neighbors(node));
    sigma.refresh();
  });

  sigma.on("leaveNode", () => {
    hoveredNode = null;
    hoveredNeighbors = new Set<string>();
    sigma.refresh();
  });

  sigma.on("clickNode", ({ node }) => {
    if (node) showUserDialog(node);
  });

  sigma.on("rightClickNode", ({ node }) => {
    contextMenuNodeId.value = node;
  });

  sigma.on("rightClickStage", () => {
    contextMenuNodeId.value = null;
  });
}

async function applyGraph(mutualMap: MutualMap) {
  lastMutualMap = mutualMap;
  const graph = await buildGraphFromMutualMap(mutualMap, graphMeta.value);
  currentGraph = graph;
  renderGraph(graph);
}

function buildMutualMap(snapshot: Map<string, string[]>): MutualMap {
  const mutualMap: MutualMap = new Map();
  snapshot.forEach((mutualIds, friendId) => {
    if (!friendId) return;
    const friendEntry = friends.value.get(friendId);
    const fallbackRef = friendEntry?.ref ?? cachedUsers.get(friendId);
    const normalizedMutuals = mutualIds.filter((id) => id !== "usr_00000000-0000-0000-0000-000000000000");

    mutualMap.set(friendId, {
      friend: friendEntry ?? { id: friendId, ref: fallbackRef },
      mutuals: normalizedMutuals.map((id) => ({ id })),
    });
  });
  return mutualMap;
}

async function loadGraphFromDatabase() {
  if (!watchState.isLoggedIn || !currentUser.value.id) return;
  if (!watchState.isFriendsLoaded) return;
  if (isFetching.value || isLoadingSnapshot.value) return;
  if (hasFetched.value && !status.needsRefetch && currentGraph) return;

  isLoadingSnapshot.value = true;

  try {
    const [snapshot, meta] = await Promise.all([database.getMutualGraphSnapshot(), database.getMutualGraphMeta()]);
    graphMeta.value = new Map(
      Array.from(meta, ([id, entry]): [string, MutualNodeMeta] => [id, { lastFetchedAt: entry.lastFetchedAt, isOptedOut: entry.optedOut }])
    );

    if (snapshot.size === 0) {
      if (totalFriends.value === 0) {
        showStatusMessage(t("view.charts.mutual_friend.status.no_friends_to_process"), "info");
        return;
      }
      if (isOptOut.value) {
        promptEnableMutualFriendsSharing();
        return;
      }
      promptInitialFetch();
      return;
    }

    const mutualMap = buildMutualMap(snapshot);

    if (!mutualMap.size) {
      promptInitialFetch();
      return;
    }

    await applyGraph(mutualMap);
    chartsStore.markMutualGraphLoaded({ notify: false });
    fetchState.processedFriends = Math.min(mutualMap.size, totalFriends.value || mutualMap.size);
    status.friendSignature = totalFriends.value;
    status.needsRefetch = false;
  } catch (err) {
    console.error("[MutualNetworkGraph] Failed to load cached mutual graph", err);
  } finally {
    isLoadingSnapshot.value = false;
  }
}

function promptInitialFetch() {
  if (isFetching.value || hasFetched.value || !totalFriends.value) return;

  void modalStore
    .confirm({
      description: t("view.charts.mutual_friend.prompt.message"),
      title: t("view.charts.mutual_friend.prompt.title"),
      confirmText: t("view.charts.mutual_friend.prompt.confirm"),
      cancelText: t("view.charts.mutual_friend.prompt.cancel"),
    })
    .then(async ({ ok }) => {
      if (!ok) return;
      await startFetch();
    })
    .catch(logFailure("Showing the mutual friends prompt failed:"));
}

function promptEnableMutualFriendsSharing() {
  void modalStore
    .confirm({
      description: t("view.charts.mutual_friend.enable_sharing_prompt.message"),
      title: t("view.charts.mutual_friend.enable_sharing_prompt.title"),
      confirmText: t("view.charts.mutual_friend.enable_sharing_prompt.confirm"),
      cancelText: t("view.charts.mutual_friend.enable_sharing_prompt.cancel"),
    })
    .then(({ ok }) => {
      if (!ok) return;
      void userStore.toggleSharedConnectionsOptOut().catch(logFailure("Toggling the shared connections opt-out failed:"));
      promptInitialFetch();
    })
    .catch(logFailure("Showing the mutual friends sharing prompt failed:"));
}

async function startFetch() {
  if (isFetching.value || isOptOut.value) return;
  const mutualMap = await chartsStore.fetchMutualGraph();
  if (!mutualMap) return;
  try {
    await applyGraph(mutualMap);
  } catch (err) {
    console.error("[MutualNetworkGraph] Failed to apply graph after fetch", err);
  }
}

function cancelFetch() {
  chartsStore.requestMutualGraphCancel();
}

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

async function handleNodeMenuRefresh() {
  const nodeId = contextMenuNodeId.value;
  contextMenuNodeId.value = null;
  if (!nodeId || isRefreshingNode.value) return;

  const isFriend = friends.value.has(nodeId);

  if (!isFriend) {
    try {
      const { ok } = await modalStore.confirm({
        title: t("view.charts.mutual_friend.context_menu.confirm_non_friend_title"),
        description: t("view.charts.mutual_friend.context_menu.confirm_non_friend_message"),
        confirmText: t("common.actions.confirm"),
        cancelText: t("common.actions.cancel"),
      });
      if (!ok) return;
    } catch {
      return;
    }
  }

  isRefreshingNode.value = true;
  try {
    const result = await chartsStore.fetchSingleFriendMutuals(nodeId);

    if (result.optedOut) {
      toast.warning(t("view.charts.mutual_friend.context_menu.user_opted_out"), { duration: 5000 });
      graphMeta.value.set(nodeId, {
        lastFetchedAt: new Date().toISOString(),
        isOptedOut: true,
      });
    } else if (result.success) {
      const name = firstNonEmpty([cachedUsers.get(nodeId)?.displayName], nodeId);
      toast.success(t("view.charts.mutual_friend.context_menu.refresh_success", { name }), {
        duration: 3000,
      });
      graphMeta.value.set(nodeId, {
        lastFetchedAt: new Date().toISOString(),
        isOptedOut: false,
      });
    } else {
      toast.error(t("view.charts.mutual_friend.context_menu.refresh_error"), { duration: 4000 });
      return;
    }

    const snapshot = await database.getMutualGraphSnapshot();
    if (snapshot.size > 0) {
      await applyGraph(buildMutualMap(snapshot));
    }
  } catch (err) {
    console.error("[MutualNetworkGraph] Refresh node error", err);
    toast.error(t("view.charts.mutual_friend.context_menu.refresh_error"), { duration: 4000 });
  } finally {
    isRefreshingNode.value = false;
  }
}
</script>
