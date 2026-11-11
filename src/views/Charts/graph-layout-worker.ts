import forceAtlas2 from "graphology-layout-forceatlas2";
import noverlap from "graphology-layout-noverlap";
import Graph from "graphology";

type LayoutNodeAttributes = { x?: number; y?: number };
type LayoutEdgeAttributes = Record<string, unknown>;

type LayoutNode = { id: string; attributes: LayoutNodeAttributes };
type LayoutEdge = { key: string; source: string; target: string; attributes: LayoutEdgeAttributes };
type LayoutSettings = {
  layoutIterations?: number;
  layoutSpacing?: number;
  deltaSpacing?: number;
  reinitialize?: boolean;
};
type LayoutRequest = { requestId: number; nodes: LayoutNode[]; edges: LayoutEdge[]; settings: LayoutSettings };
type LayoutPositions = Record<string, { x?: number | undefined; y?: number | undefined }>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isOptionalNumber(value: unknown): value is number | undefined {
  return value === undefined || typeof value === "number";
}

function isArrayOf<T>(value: unknown, isItem: (item: unknown) => item is T): value is T[] {
  return Array.isArray(value) && value.every(isItem);
}

function isNodeAttributes(value: unknown): value is LayoutNodeAttributes {
  return isRecord(value) && isOptionalNumber(value["x"]) && isOptionalNumber(value["y"]);
}

function isLayoutNode(value: unknown): value is LayoutNode {
  return isRecord(value) && typeof value["id"] === "string" && isNodeAttributes(value["attributes"]);
}

function isLayoutEdge(value: unknown): value is LayoutEdge {
  return (
    isRecord(value) &&
    typeof value["key"] === "string" &&
    typeof value["source"] === "string" &&
    typeof value["target"] === "string" &&
    isRecord(value["attributes"])
  );
}

function isLayoutSettings(value: unknown): value is LayoutSettings {
  return (
    isRecord(value) &&
    isOptionalNumber(value["layoutIterations"]) &&
    isOptionalNumber(value["layoutSpacing"]) &&
    isOptionalNumber(value["deltaSpacing"]) &&
    (value["reinitialize"] === undefined || typeof value["reinitialize"] === "boolean")
  );
}

function isLayoutRequest(value: unknown): value is LayoutRequest {
  return (
    isRecord(value) &&
    typeof value["requestId"] === "number" &&
    isArrayOf(value["nodes"], isLayoutNode) &&
    isArrayOf(value["edges"], isLayoutEdge) &&
    isLayoutSettings(value["settings"])
  );
}

function clampNumber(value: number | undefined, min: number, max: number) {
  const normalized = isFiniteNumber(value) ? value : min;
  return Math.min(max, Math.max(min, normalized));
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function jitterPositions(graph: Graph<LayoutNodeAttributes, LayoutEdgeAttributes>, magnitude: number) {
  graph.forEachNode((node, attrs) => {
    if (!isFiniteNumber(attrs.x) || !isFiniteNumber(attrs.y)) return;
    graph.mergeNodeAttributes(node, {
      x: attrs.x + (Math.random() - 0.5) * magnitude,
      y: attrs.y + (Math.random() - 0.5) * magnitude,
    });
  });
}

function initPositions(graph: Graph<LayoutNodeAttributes, LayoutEdgeAttributes>) {
  const n = graph.order;
  const radius = Math.max(50, Math.sqrt(n) * 30);
  graph.forEachNode((node) => {
    const a = Math.random() * Math.PI * 2;
    const r = Math.sqrt(Math.random()) * radius;
    graph.mergeNodeAttributes(node, {
      x: Math.cos(a) * r,
      y: Math.sin(a) * r,
    });
  });
}

const LAYOUT_SPACING_MIN = 8;
const LAYOUT_SPACING_MAX = 240;
const LAYOUT_ITERATIONS_MIN = 300;
const LAYOUT_ITERATIONS_MAX = 1500;

function runLayout(data: LayoutRequest): LayoutPositions {
  const { nodes, edges, settings } = data;

  const graph = new Graph<LayoutNodeAttributes, LayoutEdgeAttributes>({
    type: "undirected",
    multi: false,
    allowSelfLoops: false,
  });

  for (const node of nodes) {
    graph.addNode(node.id, node.attributes);
  }
  for (const edge of edges) {
    graph.addEdgeWithKey(edge.key, edge.source, edge.target, edge.attributes);
  }

  const shouldReinitialize = settings.reinitialize ?? false;
  if (shouldReinitialize) {
    initPositions(graph);
  }

  const iterations = clampNumber(settings.layoutIterations, LAYOUT_ITERATIONS_MIN, LAYOUT_ITERATIONS_MAX);
  const spacing = clampNumber(settings.layoutSpacing, LAYOUT_SPACING_MIN, LAYOUT_SPACING_MAX);
  const t = (spacing - LAYOUT_SPACING_MIN) / (LAYOUT_SPACING_MAX - LAYOUT_SPACING_MIN);
  const clampedT = clampNumber(t, 0, 1);
  const deltaSpacing = settings.deltaSpacing ?? 0;

  const inferred = forceAtlas2.inferSettings(graph);
  const fa2Settings = {
    ...inferred,
    barnesHutOptimize: true,
    barnesHutTheta: 0.8,
    strongGravityMode: true,
    gravity: lerp(1.6, 0.6, clampedT),
    scalingRatio: spacing,
    slowDown: 2,
  };

  if (Math.abs(deltaSpacing) >= 8) {
    jitterPositions(graph, lerp(0.5, 2.0, clampedT));
  }

  forceAtlas2.assign(graph, { iterations, settings: fa2Settings });

  const noverlapIterations = clampNumber(Math.round(Math.sqrt(graph.order) * 6), 200, 600);
  noverlap.assign(graph, {
    maxIterations: noverlapIterations,
    settings: {
      ratio: lerp(1.05, 1.35, clampedT),
      margin: lerp(1, 8, clampedT),
    },
  });

  const positions: LayoutPositions = {};
  graph.forEachNode((node, attrs) => {
    positions[node] = { x: attrs.x, y: attrs.y };
  });

  return positions;
}

self.addEventListener("message", (event: MessageEvent<unknown>) => {
  const request = event.data;
  if (!isLayoutRequest(request)) {
    if (isRecord(request) && typeof request["requestId"] === "number") {
      self.postMessage({ requestId: request["requestId"], error: "invalid layout request" });
    }
    return;
  }
  try {
    const positions = runLayout(request);
    self.postMessage({ requestId: request.requestId, positions });
  } catch (err) {
    self.postMessage({ requestId: request.requestId, error: err instanceof Error ? err.message : String(err) });
  }
});
