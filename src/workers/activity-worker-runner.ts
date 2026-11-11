import ActivityWorker from "./activity-worker.ts?worker&inline";

type WorkerCallback = {
  resolve: (payload: unknown) => void;
  reject: (error: Error) => void;
};

type WorkerResponse = {
  type: string;
  seq: number;
  payload: unknown;
};

type Row = Record<string, unknown>;

let worker: Worker | null = null;
let workerSeq = 0;
const pendingWorkerCallbacks = new Map<number, WorkerCallback>();

function isRow(value: unknown): value is Row {
  return typeof value === "object" && value !== null;
}

function isWorkerResponse(value: unknown): value is WorkerResponse {
  return isRow(value) && typeof value["type"] === "string" && typeof value["seq"] === "number";
}

function readErrorMessage(payload: unknown): string {
  if (isRow(payload) && typeof payload["message"] === "string") {
    return payload["message"];
  }
  return "";
}

function getWorker(): Worker {
  if (!worker) {
    worker = new ActivityWorker();
    worker.onmessage = (event: MessageEvent<unknown>) => {
      const data = event.data;
      if (!isWorkerResponse(data)) {
        return;
      }
      const callback = pendingWorkerCallbacks.get(data.seq);
      if (!callback) {
        return;
      }
      pendingWorkerCallbacks.delete(data.seq);
      if (data.type === "error") {
        callback.reject(new Error(readErrorMessage(data.payload)));
        return;
      }
      callback.resolve(data.payload);
    };
  }
  return worker;
}

export function runActivityWorkerTask(type: string, payload: unknown): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const seq = ++workerSeq;
    pendingWorkerCallbacks.set(seq, { resolve, reject });
    getWorker().postMessage({ type, seq, payload });
  });
}
