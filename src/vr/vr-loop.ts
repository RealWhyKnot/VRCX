import * as workerTimers from "worker-timers";

export type VrLoop = {
  start: () => void;
  stop: () => void;
};

export function logVrError(err: unknown): void {
  console.error(err);
}

export function createVrLoop(step: () => boolean | Promise<boolean>, intervalMs: number): VrLoop {
  let timeoutId: number | null = null;
  let isStopped = false;

  async function tick(): Promise<void> {
    const shouldContinue = await step();
    if (!shouldContinue || isStopped) {
      return;
    }
    timeoutId = workerTimers.setTimeout(() => {
      tick().catch(logVrError);
    }, intervalMs);
  }

  return {
    start() {
      tick().catch(logVrError);
    },
    stop() {
      isStopped = true;
      if (timeoutId !== null) {
        workerTimers.clearTimeout(timeoutId);
        timeoutId = null;
      }
    },
  };
}
