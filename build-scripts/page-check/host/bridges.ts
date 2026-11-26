import type { BridgeSurface, ReturnKind } from "../contract.ts";
import type { Handler } from "./database.ts";
import type { Probe } from "./probe.ts";

type BridgeHandlers = Map<string, Map<string, Handler>>;

function defaultValue(bridge: string, method: string, kind: ReturnKind, nextInsertId: () => number): unknown {
  switch (kind) {
    case "void":
      return undefined;
    case "number":
      return method.startsWith("Add") ? nextInsertId() : 0;
    case "boolean":
      return false;
    case "string":
      return bridge === "DatabaseApi" ? "[]" : "";
    case "null":
      return null;
    case "array":
      return [];
    case "object":
      return {};
    default:
      return kind satisfies never;
  }
}

function settleLater(): Promise<void> {
  return new Promise((resolve) => {
    const channel = new MessageChannel();
    channel.port1.onmessage = () => {
      channel.port1.close();
      resolve();
    };
    channel.port2.postMessage(null);
  });
}

function createBridges(surface: BridgeSurface, handlers: BridgeHandlers, probe: Probe, nextInsertId: () => number): Map<string, Record<string, Handler>> {
  const bridges = new Map<string, Record<string, Handler>>();
  for (const { bridge, methods } of surface) {
    const custom = handlers.get(bridge) ?? new Map<string, Handler>();
    const kinds = new Map(methods.map((method) => [method.name, method.kind]));
    const names = new Set([...kinds.keys(), ...custom.keys()]);
    const entries = [...names].map((methodName): [string, Handler] => {
      const handler = custom.get(methodName);
      const kind = kinds.get(methodName) ?? "void";
      const call = async (...args: unknown[]): Promise<unknown> => {
        probe.bridgeStarted(bridge, methodName);
        try {
          await settleLater();
          return handler ? await handler(...args) : defaultValue(bridge, methodName, kind, nextInsertId);
        } finally {
          probe.bridgeFinished();
        }
      };
      return [methodName, call];
    });
    bridges.set(bridge, Object.fromEntries(entries));
  }
  return bridges;
}

export { createBridges };
export type { BridgeHandlers };
