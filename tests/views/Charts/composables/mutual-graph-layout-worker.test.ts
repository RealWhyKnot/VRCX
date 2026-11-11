import { beforeEach, describe, expect, it, vi } from "vitest";

type Listener = (event: unknown) => void;

const { workers, FakeWorker } = vi.hoisted(() => {
  class FakeWorkerClass {
    readonly listeners = new Map<string, Set<Listener>>();
    readonly posted: unknown[] = [];
    isTerminated = false;

    addEventListener(type: string, listener: Listener) {
      const set = this.listeners.get(type) ?? new Set<Listener>();
      set.add(listener);
      this.listeners.set(type, set);
    }

    removeEventListener(type: string, listener: Listener) {
      this.listeners.get(type)?.delete(listener);
    }

    postMessage(message: unknown) {
      this.posted.push(message);
    }

    terminate() {
      this.isTerminated = true;
    }

    emit(type: string, event: unknown) {
      for (const listener of this.listeners.get(type) ?? []) {
        listener(event);
      }
    }

    listenerCount() {
      let count = 0;
      for (const set of this.listeners.values()) {
        count += set.size;
      }
      return count;
    }
  }

  const created: FakeWorkerClass[] = [];

  return {
    workers: created,
    FakeWorker: class extends FakeWorkerClass {
      constructor() {
        super();
        created.push(this);
      }
    },
  };
});

vi.mock("../../../../src/views/Charts/graph-layout-worker.ts?worker&inline", () => ({ default: FakeWorker }));

import { createMutualGraphLayoutWorker } from "../../../../src/views/Charts/composables/mutual-graph-layout-worker";

const body = {
  nodes: [],
  edges: [],
  settings: { layoutIterations: 1, layoutSpacing: 1, deltaSpacing: 1, reinitialize: false },
};

function lastWorker() {
  const worker = workers.at(-1);
  if (!worker) throw new Error("no worker was created");
  return worker;
}

describe("createMutualGraphLayoutWorker", () => {
  beforeEach(() => {
    workers.length = 0;
  });

  it("resolves a request with the positions the worker sends back", async () => {
    const client = createMutualGraphLayoutWorker();
    const pending = client.request(body);
    lastWorker().emit("message", { data: { requestId: 1, positions: { a: { x: 1, y: 2 } } } });
    await expect(pending).resolves.toEqual({ a: { x: 1, y: 2 } });
    expect(workers).toHaveLength(1);
  });

  it("stops the worker after an error and starts a new one for the next request", async () => {
    const client = createMutualGraphLayoutWorker();
    const failed = client.request(body);
    const broken = lastWorker();
    const failure = new Error("worker crashed");
    broken.emit("error", failure);
    await expect(failed).rejects.toBe(failure);
    expect(broken.isTerminated).toBe(true);
    expect(broken.listenerCount()).toBe(0);

    const retried = client.request(body);
    expect(workers).toHaveLength(2);
    lastWorker().emit("message", { data: { requestId: 2, positions: {} } });
    await expect(retried).resolves.toEqual({});
  });

  it("rejects pending requests and stops the worker on dispose", async () => {
    const client = createMutualGraphLayoutWorker();
    const pending = client.request(body);
    const worker = lastWorker();
    client.dispose();
    await expect(pending).rejects.toThrow("Component unmounted");
    expect(worker.isTerminated).toBe(true);
    expect(worker.listenerCount()).toBe(0);
  });

  it("refuses requests after dispose without starting a worker", async () => {
    const client = createMutualGraphLayoutWorker();
    client.dispose();
    await expect(client.request(body)).rejects.toThrow("Component unmounted");
    expect(workers).toHaveLength(0);
  });
});
