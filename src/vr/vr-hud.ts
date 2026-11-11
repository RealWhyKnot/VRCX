import { removeFromArray } from "../shared/utils/base/array";

import { createVrLoop } from "./vr-loop";
import { isRecord, isVrFeedItem, isVrHudTimeoutList, parseVrPayload } from "./vr-payload";
import type { VrHudItem, VrState } from "./vr-types";

type VrHudTagUpdate = {
  userId?: string;
  colour?: string;
};

function isVrHudTagUpdate(value: unknown): value is VrHudTagUpdate {
  return isRecord(value);
}

export type VrHudFeed = {
  addEntry: (json: string) => void;
  updateTag: (json: string) => void;
  updateTimeout: (json: string) => void;
  clean: () => void;
  cleanLoop: () => void;
  stop: () => void;
};

export function createHudFeed(vrState: VrState): VrHudFeed {
  const cleanLoop = createVrLoop(() => {
    if (!vrState.cleanHudFeedLoopStatus) {
      return false;
    }
    cleanHudFeed();
    if (vrState.hudFeed.length === 0) {
      vrState.cleanHudFeedLoopStatus = false;
      return false;
    }
    return true;
  }, 500);

  function cleanHudFeed(): void {
    const now = Date.now();
    const timeout = vrState.config.photonOverlayMessageTimeout;
    vrState.hudFeed.forEach((item) => {
      if (timeout !== undefined && item.time + timeout < now) {
        removeFromArray(vrState.hudFeed, item);
      }
    });
    if (vrState.hudFeed.length > 10) {
      vrState.hudFeed.length = 10;
    }
    if (!vrState.cleanHudFeedLoopStatus) {
      vrState.cleanHudFeedLoopStatus = true;
      cleanLoop.start();
    }
  }

  function addEntry(json: string): void {
    const data = parseVrPayload(json, "HUD feed entry", isVrFeedItem);
    let combo = 1;
    vrState.hudFeed.forEach((item) => {
      if (item.displayName === data.displayName && item.text === data.text) {
        combo = item.combo + 1;
        removeFromArray(vrState.hudFeed, item);
      }
    });
    const entry: VrHudItem = {
      time: Date.now(),
      combo,
      ...data,
    };
    vrState.hudFeed.unshift(entry);
    cleanHudFeed();
  }

  function updateTag(json: string): void {
    const ref = parseVrPayload(json, "HUD tag update", isVrHudTagUpdate);
    vrState.hudFeed.forEach((item) => {
      if (item.userId === ref.userId) {
        item.colour = ref.colour;
      }
    });
  }

  function updateTimeout(json: string): void {
    vrState.hudTimeout = parseVrPayload(json, "HUD timeout list", isVrHudTimeoutList);
  }

  return {
    addEntry,
    updateTag,
    updateTimeout,
    clean: cleanHudFeed,
    cleanLoop: cleanLoop.start,
    stop: cleanLoop.stop,
  };
}
