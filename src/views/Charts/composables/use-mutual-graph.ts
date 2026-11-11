import { layerBorder } from "@sigma/node-border";
import { pathCurved } from "sigma/rendering";
import dayjs from "dayjs";
import Graph from "graphology";
import Sigma from "sigma";
import louvain from "graphology-communities-louvain";
import { ref, type Ref } from "vue";
import type { ComposerTranslation } from "vue-i18n";
import { logFailure } from "@/stores/log-failure";
import { showUserDialog } from "../../../coordinators/user-coordinator";
import type { VrcxUser } from "../../../types/vrcx";
import { createMutualGraphLayoutWorker } from "./mutual-graph-layout-worker";
import { firstNonEmpty, truncateLabelText } from "./mutual-graph-labels";
import { EDGE_CURVATURE_MAX, EDGE_CURVATURE_MIN, clampNumber, type MutualGraphLayoutSettings } from "./use-mutual-graph-layout-settings";
import type {
  LayoutCommunity,
  MutualEdgeAttributes,
  MutualGraph,
  MutualMap,
  MutualNodeAttributes,
  MutualNodeMeta,
  NodeReducerResult,
  SigmaCameraState,
} from "./mutual-graph-types";

type MutualGraphOptions = {
  t: ComposerTranslation;
  layoutSettings: MutualGraphLayoutSettings;
  takeLayoutSpacingDelta: () => { spacing: number; deltaSpacing: number };
  excludedFriendIds: Ref<string[]>;
  graphContainerRef: Ref<HTMLDivElement | null>;
  isDarkMode: Ref<boolean>;
  contextMenuNodeId: Ref<string | null>;
  cachedUsers: Map<string, VrcxUser>;
  graphMeta: Ref<Map<string, MutualNodeMeta>>;
};

export function useMutualGraph({
  t,
  layoutSettings,
  takeLayoutSpacingDelta,
  excludedFriendIds,
  graphContainerRef,
  isDarkMode,
  contextMenuNodeId,
  cachedUsers,
  graphMeta,
}: MutualGraphOptions) {
  const graphNodeCount = ref(0);
  const layoutClient = createMutualGraphLayoutWorker();

  const colorsPalette = ["#5470c6", "#91cc75", "#fac858", "#ee6666", "#73c0de", "#3ba272", "#fc8452", "#9a60b4", "#ea7ccc"];

  const nodeBorderLayer = layerBorder({
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

  let sigmaInstance: Sigma<MutualNodeAttributes, MutualEdgeAttributes> | null = null;
  let currentGraph: MutualGraph | null = null;
  let hoveredNode: string | null = null;
  let hoveredNeighbors = new Set<string>();
  let resizeObserver: ResizeObserver | null = null;
  let mutualGraphResizeObserver: ResizeObserver | null = null;
  let applySequence = 0;
  let pendingRender: number | null = null;
  let pendingLayoutUpdate: ReturnType<typeof setTimeout> | null = null;
  let lastMutualMap: MutualMap | null = null;
  let layoutQueue: Promise<void> = Promise.resolve();

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
    const { spacing, deltaSpacing } = takeLayoutSpacingDelta();

    const { nodes, edges } = serializeGraph(graph);

    const task = layoutQueue.then(async () => {
      const positions = await layoutClient.request({
        nodes,
        edges,
        settings: {
          layoutIterations: layoutSettings.layoutIterations,
          layoutSpacing: spacing,
          deltaSpacing,
          reinitialize: reinitialize ?? false,
        },
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
      if (currentGraph !== graph) return;
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
      graph.setNodeAttribute(node, "color", colorsPalette[idx % colorsPalette.length]);
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
        if (currentGraph !== graph) return;
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
          layers: [nodeBorderLayer],
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
    const sequence = ++applySequence;
    lastMutualMap = mutualMap;
    const graph = await buildGraphFromMutualMap(mutualMap, graphMeta.value);
    if (sequence !== applySequence) return;
    currentGraph = graph;
    renderGraph(graph);
  }

  function focusNode(friendId: string | null) {
    if (!friendId || !currentGraph || !sigmaInstance) return;
    if (!currentGraph.hasNode(friendId)) return;
    const nodeDisplayData = sigmaInstance.getNodeDisplayData(friendId);
    if (!nodeDisplayData) return;
    const camera = sigmaInstance.getCamera();
    void camera
      .animate({ x: nodeDisplayData.x, y: nodeDisplayData.y, ratio: 0.15 }, { duration: 300 })
      .catch(logFailure("Animating the mutual graph camera failed:"));
  }

  function observeGraphContainers(graphContainer: HTMLDivElement, pageContainer: HTMLDivElement, onPageResize: () => void) {
    resizeObserver = new ResizeObserver(() => {
      sigmaInstance?.refresh();
    });
    resizeObserver.observe(graphContainer);
    mutualGraphResizeObserver = new ResizeObserver(() => onPageResize());
    mutualGraphResizeObserver.observe(pageContainer);
  }

  function renderCurrentGraph(shouldRecreate = false) {
    if (!currentGraph) return;
    renderGraph(currentGraph, shouldRecreate);
  }

  function dispose() {
    applySequence++;
    if (pendingLayoutUpdate) {
      clearTimeout(pendingLayoutUpdate);
      pendingLayoutUpdate = null;
    }
    if (pendingRender !== null) {
      cancelAnimationFrame(pendingRender);
      pendingRender = null;
    }
    if (resizeObserver) {
      resizeObserver.disconnect();
      resizeObserver = null;
    }
    if (sigmaInstance) {
      sigmaInstance.kill();
      sigmaInstance = null;
    }
    currentGraph = null;
    layoutClient.dispose();
    if (mutualGraphResizeObserver) {
      mutualGraphResizeObserver.disconnect();
      mutualGraphResizeObserver = null;
    }
  }

  return {
    graphNodeCount,
    hasCurrentGraph: () => currentGraph !== null,
    getLastMutualMap: () => lastMutualMap,
    applyGraph,
    renderCurrentGraph,
    scheduleLayoutUpdate,
    focusNode,
    observeGraphContainers,
    dispose,
  };
}
