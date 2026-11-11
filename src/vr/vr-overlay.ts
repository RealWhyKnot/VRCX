import { createVrLoop, logVrError } from "./vr-loop";
import type { VrLoop } from "./vr-loop";
import { isVrOverlayHandler } from "./vr-payload";

export function createOverlayQueueLoop(): VrLoop {
  return createVrLoop(async () => {
    try {
      const overlayQueue = await AppApiVr.GetExecuteVrOverlayFunctionQueue();
      for (const [fullFunctionName, jsonArg] of overlayQueue) {
        const handler: unknown = window.$vr?.[fullFunctionName];
        if (isVrOverlayHandler(handler)) {
          handler(jsonArg);
        } else {
          console.error(`$vr.${fullFunctionName} is not defined or is not a function`);
        }
      }
    } catch (err) {
      logVrError(err);
    }
    return true;
  }, 500);
}
