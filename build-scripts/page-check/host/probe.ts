import type { ProbeSnapshot } from "../contract.ts";

const BUG_ERRORS = new Set(["TypeError", "ReferenceError", "RangeError", "SyntaxError", "InternalError"]);
const MESSAGE_LIMIT = 400;
const LIST_LIMIT = 50;
const TOP_MUTATIONS = 6;
const HOLDER_SELECTOR = "[data-panel-key], [data-testid], [aria-label], section, main, aside";

function describe(value: unknown): string {
  if (value instanceof Error) {
    return `${value.name}: ${value.message}\n${(value.stack ?? "").split("\n").slice(1, 4).join("\n")}`.slice(0, MESSAGE_LIMIT);
  }
  if (typeof value === "string") {
    return value.slice(0, MESSAGE_LIMIT);
  }
  try {
    return JSON.stringify(value).slice(0, MESSAGE_LIMIT);
  } catch {
    return String(value).slice(0, MESSAGE_LIMIT);
  }
}

function elementKey(node: Node): string {
  const element = node instanceof Element ? node : node.parentElement;
  if (element === null) {
    return "#document";
  }
  const classes = [...element.classList].slice(0, 2).join(".");
  const holder = element.parentElement?.closest(HOLDER_SELECTOR) ?? null;
  const holderName =
    holder === null ? "" : (holder.getAttribute("data-panel-key") ?? holder.getAttribute("data-testid") ?? holder.getAttribute("aria-label") ?? "");
  const where = holder === null ? "" : ` in ${holder.tagName.toLowerCase()}${holderName === "" ? "" : `[${holderName}]`}`;
  return `${element.tagName.toLowerCase()}${classes === "" ? "" : `.${classes}`}${where}`;
}

function nodeLabel(node: Node | undefined): string {
  if (node === undefined) {
    return "";
  }
  if (node instanceof Element) {
    const classes = [...node.classList].slice(0, 2).join(".");
    return `${node.tagName.toLowerCase()}${classes === "" ? "" : `.${classes}`}`;
  }
  return node.nodeType === Node.COMMENT_NODE ? `<!--${(node.textContent ?? "").slice(0, 24)}-->` : node.nodeName;
}

function childrenDetail(record: MutationRecord): string {
  const added = record.addedNodes[0];
  return added === undefined ? `-${nodeLabel(record.removedNodes[0])}` : `+${nodeLabel(added)}`;
}

function mutationKey(record: MutationRecord): string {
  const detail = record.type === "attributes" ? `@${record.attributeName ?? ""}` : record.type === "characterData" ? "text" : childrenDetail(record);
  return `${elementKey(record.target)} ${detail}`;
}

function hasThrownValue(event: ErrorEvent): boolean {
  return event.error !== null;
}

function push(list: string[], message: string): void {
  if (list.length < LIST_LIMIT) {
    list.push(message);
  }
}

function createProbe() {
  let longTasks: { start: number; duration: number }[] = [];
  let errors: string[] = [];
  let mutations = 0;
  const mutationTargets = new Map<string, number>();
  let events = 0;
  let pendingBridgeCalls = 0;
  let lastBridgeActivity = 0;
  const bridgeCalls = new Map<string, number>();
  const unknownEndpoints = new Set<string>();
  const apiCalls = new Map<string, number>();

  new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      longTasks.push({ start: entry.startTime, duration: entry.duration });
    }
  }).observe({ type: "longtask", buffered: true });

  window.addEventListener("error", (event) => {
    if (!hasThrownValue(event)) {
      return;
    }
    push(errors, `uncaught ${describe(event.error)}`);
  });
  window.addEventListener("unhandledrejection", (event) => {
    push(errors, `unhandled rejection ${describe(event.reason)}`);
  });

  const consoleError = console.error.bind(console);
  console.error = (...args: unknown[]) => {
    const bug = args.find((arg): arg is Error => arg instanceof Error && BUG_ERRORS.has(arg.name));
    if (bug) {
      push(errors, `logged ${describe(bug)}`);
    }
    consoleError(...args);
  };

  new MutationObserver((records) => {
    mutations += records.length;
    for (const record of records) {
      const key = mutationKey(record);
      mutationTargets.set(key, (mutationTargets.get(key) ?? 0) + 1);
    }
  }).observe(document, { subtree: true, childList: true, attributes: true, characterData: true });

  return {
    bridgeStarted(bridge: string, method: string): void {
      pendingBridgeCalls += 1;
      lastBridgeActivity = performance.now();
      const key = `${bridge}.${method}`;
      bridgeCalls.set(key, (bridgeCalls.get(key) ?? 0) + 1);
    },
    bridgeFinished(): void {
      pendingBridgeCalls -= 1;
      lastBridgeActivity = performance.now();
    },
    apiRequest(endpoint: string, isKnown: boolean): void {
      apiCalls.set(endpoint, (apiCalls.get(endpoint) ?? 0) + 1);
      if (!isKnown) {
        unknownEndpoints.add(endpoint);
      }
    },
    eventDelivered(): void {
      events += 1;
    },
    reset(): void {
      longTasks = [];
      errors = [];
      mutations = 0;
      mutationTargets.clear();
      events = 0;
      bridgeCalls.clear();
    },
    snapshot(): ProbeSnapshot {
      return {
        now: performance.now(),
        longTasks: [...longTasks],
        errors: [...errors],
        mutations,
        topMutations: [...mutationTargets.entries()]
          .sort((left, right) => right[1] - left[1])
          .slice(0, TOP_MUTATIONS)
          .map(([target, count]) => ({ target, count })),
        pendingBridgeCalls,
        lastBridgeActivity,
        bridgeCalls: [...bridgeCalls.entries()].map(([key, count]) => {
          const [bridge = "", method = ""] = key.split(".");
          return { bridge, method, count };
        }),
        unknownEndpoints: [...unknownEndpoints],
        apiCalls: [...apiCalls.entries()].map(([endpoint, count]) => ({ endpoint, count })),
        events,
        domNodes: document.getElementsByTagName("*").length,
      };
    },
  };
}

type Probe = ReturnType<typeof createProbe>;

export { createProbe };
export type { Probe };
