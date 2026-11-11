import { beforeEach, describe, expect, test, vi } from "vitest";

type FakeAttributes = Record<string, unknown>;

type WorkerResponse = {
  requestId: number;
  positions?: Record<string, { x?: number; y?: number }>;
  error?: string;
};

type MessageListener = (event: { data: unknown }) => void;

class FakeGraph {
  private readonly nodes = new Map<string, FakeAttributes>();
  private readonly edges: { key: string; source: string; target: string; attrs: FakeAttributes }[] = [];

  addNode(id: string, attrs: FakeAttributes = {}) {
    this.nodes.set(id, { ...attrs });
  }

  addEdgeWithKey(key: string, source: string, target: string, attrs: FakeAttributes = {}) {
    if (!this.nodes.has(source) || !this.nodes.has(target)) {
      throw new Error("missing node");
    }
    this.edges.push({ key, source, target, attrs: { ...attrs } });
  }

  get order() {
    return this.nodes.size;
  }

  forEachNode(cb: (id: string, attrs: FakeAttributes) => void) {
    for (const [id, attrs] of this.nodes.entries()) cb(id, attrs);
  }

  mergeNodeAttributes(node: string, attrs: FakeAttributes) {
    this.nodes.set(node, { ...this.nodes.get(node), ...attrs });
  }
}

vi.mock("graphology", () => ({ default: FakeGraph }));
vi.mock("graphology-layout-forceatlas2", () => ({
  default: {
    inferSettings: vi.fn(() => ({ gravity: 1 })),
    assign: vi.fn((graph: FakeGraph) => {
      graph.forEachNode((id, attrs) => {
        graph.mergeNodeAttributes(id, {
          x: typeof attrs["x"] === "number" && Number.isFinite(attrs["x"]) ? attrs["x"] + 1 : 1,
          y: typeof attrs["y"] === "number" && Number.isFinite(attrs["y"]) ? attrs["y"] + 1 : 1,
        });
      });
    }),
  },
}));
vi.mock("graphology-layout-noverlap", () => ({
  default: {
    assign: vi.fn(),
  },
}));

function setupWorkerHarness() {
  const sent: WorkerResponse[] = [];
  let handler: MessageListener | null = null;

  vi.stubGlobal("self", {
    addEventListener: vi.fn((event: string, cb: MessageListener) => {
      if (event === "message") handler = cb;
    }),
    postMessage: vi.fn((payload: WorkerResponse) => {
      sent.push(payload);
    }),
  });

  return {
    sent,
    dispatch: (data: unknown) => handler?.({ data }),
  };
}

describe("graphLayoutWorker message protocol", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllGlobals();
  });

  test("returns positions with the same requestId on success", async () => {
    const harness = setupWorkerHarness();
    await import("../../../src/views/Charts/graph-layout-worker.ts");

    harness.dispatch({
      requestId: 11,
      nodes: [
        { id: "n1", attributes: { x: 0, y: 0 } },
        { id: "n2", attributes: { x: 2, y: 2 } },
      ],
      edges: [{ key: "n1__n2", source: "n1", target: "n2", attributes: {} }],
      settings: {
        layoutIterations: 300,
        layoutSpacing: 60,
        deltaSpacing: 0,
        reinitialize: false,
      },
    });

    expect(harness.sent).toHaveLength(1);
    expect(harness.sent[0]?.requestId).toBe(11);
    expect(harness.sent[0]?.positions?.["n1"]).toBeTruthy();
    expect(harness.sent[0]?.positions?.["n2"]).toBeTruthy();
  });

  test("returns error with requestId when layout throws", async () => {
    const harness = setupWorkerHarness();
    await import("../../../src/views/Charts/graph-layout-worker.ts");

    harness.dispatch({
      requestId: 12,
      nodes: [{ id: "n1", attributes: { x: 0, y: 0 } }],
      edges: [{ key: "n1__n2", source: "n1", target: "n2", attributes: {} }],
      settings: {
        layoutIterations: 300,
        layoutSpacing: 60,
        deltaSpacing: 0,
        reinitialize: false,
      },
    });

    expect(harness.sent).toHaveLength(1);
    expect(harness.sent[0]?.requestId).toBe(12);
    expect(harness.sent[0]?.error).toContain("missing node");
  });
});
