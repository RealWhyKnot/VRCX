import GraphLayoutWorker from "../graph-layout-worker.ts?worker&inline";
import type { LayoutMessage, LayoutPosition, LayoutPositions, LayoutRequestBody, LayoutResolver } from "./mutual-graph-types";

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

export function createMutualGraphLayoutWorker() {
  let worker: Worker | null = null;
  let requestId = 0;
  let isDisposed = false;
  const resolvers = new Map<number, LayoutResolver>();

  function handleMessage(event: MessageEvent<unknown>) {
    const message = readLayoutMessage(event.data);
    if (!message) return;
    const resolver = resolvers.get(message.requestId);
    if (!resolver) return;
    resolvers.delete(message.requestId);
    if (message.error) {
      resolver.reject(new Error(message.error));
    } else {
      resolver.resolve(message.positions ?? {});
    }
  }

  function rejectPending(reason: unknown) {
    for (const [id, resolver] of resolvers) {
      resolver.reject(reason);
      resolvers.delete(id);
    }
  }

  function stopWorker() {
    if (!worker) return;
    worker.removeEventListener("message", handleMessage);
    worker.removeEventListener("error", handleError);
    worker.terminate();
    worker = null;
  }

  function handleError(err: ErrorEvent) {
    rejectPending(err);
    stopWorker();
  }

  function getWorker() {
    if (!worker) {
      worker = new GraphLayoutWorker();
      worker.addEventListener("message", handleMessage);
      worker.addEventListener("error", handleError);
    }
    return worker;
  }

  function request(body: LayoutRequestBody) {
    if (isDisposed) return Promise.reject<LayoutPositions>(new Error("Component unmounted"));
    const activeWorker = getWorker();
    const id = ++requestId;
    return new Promise<LayoutPositions>((resolve, reject) => {
      resolvers.set(id, { resolve, reject });
      activeWorker.postMessage({ requestId: id, ...body });
    });
  }

  function dispose() {
    isDisposed = true;
    rejectPending(new Error("Component unmounted"));
    stopWorker();
  }

  return { request, dispose };
}
