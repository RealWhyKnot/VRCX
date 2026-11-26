import type { BridgeSurface, HostConfig } from "../contract.ts";
import { currentRoute, listRoutes, navigate } from "./app-router.ts";
import { createBridges, type BridgeHandlers } from "./bridges.ts";
import { createDatabaseHandlers, nextInsertId, type Handler } from "./database.ts";
import { createDataset } from "./fixtures.ts";
import { installPipelineSocket, startEventPump } from "./pipeline.ts";
import { createProbe } from "./probe.ts";
import { createRandom } from "./random.ts";
import { createVrchatApi } from "./vrchat-api.ts";

const VRCHAT_DATA = "C:\\Users\\PageCheck\\AppData\\LocalLow\\VRChat\\VRChat";
const PICTURES = "C:\\Users\\PageCheck\\Pictures\\VRChat";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isSurface(value: unknown): value is BridgeSurface {
  return Array.isArray(value) && value.every((entry) => isRecord(entry) && typeof entry["bridge"] === "string" && Array.isArray(entry["methods"]));
}

function readConfig(): HostConfig {
  const value: unknown = Reflect.get(window, "pageCheckConfig");
  if (
    !isRecord(value) ||
    !isSurface(value["surface"]) ||
    (value["profile"] !== "real" && value["profile"] !== "stress") ||
    typeof value["seed"] !== "number" ||
    typeof value["eventsPerSecond"] !== "number" ||
    typeof value["dashboardId"] !== "string"
  ) {
    throw new TypeError("page-check host config is missing or malformed");
  }
  return {
    surface: value["surface"],
    profile: value["profile"],
    seed: value["seed"],
    eventsPerSecond: value["eventsPerSecond"],
    dashboardId: value["dashboardId"],
  };
}

function createStorageHandlers(): Map<string, Handler> {
  const storage = new Map<string, string>();
  const text = (value: unknown): string => (typeof value === "string" ? value : "");
  const handlers: [string, Handler][] = [
    ["Get", (key) => storage.get(text(key)) ?? ""],
    [
      "Set",
      (key, value) => {
        storage.set(text(key), text(value));
      },
    ],
    ["Remove", (key) => storage.delete(text(key))],
    ["GetAll", () => JSON.stringify(Object.fromEntries(storage))],
    ["GetArray", (key): unknown => JSON.parse(storage.get(text(key)) ?? "[]")],
    [
      "SetArray",
      (key, value) => {
        storage.set(text(key), JSON.stringify(value));
      },
    ],
    ["GetObject", (key): unknown => JSON.parse(storage.get(text(key)) ?? "{}")],
    [
      "SetObject",
      (key, value) => {
        storage.set(text(key), JSON.stringify(value));
      },
    ],
  ];
  return new Map(handlers);
}

function createAppHandlers(): Map<string, Handler> {
  const handlers: [string, Handler][] = [
    ["GetVersion", () => "2026.11.26.0"],
    ["CurrentCulture", () => "en-US"],
    ["CurrentLanguage", () => "en"],
    ["GetLaunchCommand", () => null],
    ["ReadConfigFile", () => "{}"],
    ["ReadConfigFileSafe", () => "{}"],
    ["GetVRChatRegistryJson", () => "{}"],
    ["GetVRChatAppDataLocation", () => VRCHAT_DATA],
    ["GetVRChatCacheLocation", () => `${VRCHAT_DATA}\\Cache-WindowsPlayer`],
    ["GetVRChatPhotosLocation", () => PICTURES],
    ["GetVRChatScreenshotsLocation", () => PICTURES],
    ["GetUGCPhotoLocation", () => PICTURES],
    ["GetZoom", () => 0],
    ["VrcClosedGracefully", () => true],
  ];
  return new Map(handlers);
}

function install(): void {
  const config = readConfig();
  const probe = createProbe();
  const data = createDataset(config.profile, config.seed, config.dashboardId);
  const handlers: BridgeHandlers = new Map([
    ["DatabaseApi", createDatabaseHandlers(data)],
    ["WebApi", new Map<string, Handler>([["Execute", createVrchatApi(data, (endpoint, isKnown) => probe.apiRequest(endpoint, isKnown))]])],
    ["VRCXStorage", createStorageHandlers()],
    ["AppApi", createAppHandlers()],
    ["AssetBundleManager", new Map<string, Handler>([["CheckVRChatCache", () => ({ Item1: -1, Item2: false, Item3: "" })]])],
  ]);
  const bridges = createBridges(config.surface, handlers, probe, nextInsertId());
  installPipelineSocket();
  const pump = startEventPump(data, createRandom(config.seed + 1), () => probe.eventDelivered());
  pump.setRate(config.eventsPerSecond);
  Object.assign(window, {
    isHostWindows: true,
    isHostLinux: false,
    CefSharp: {
      BindObjectAsync: (...names: string[]) => {
        for (const bridgeName of names) {
          Object.assign(window, { [bridgeName]: bridges.get(bridgeName) ?? {} });
        }
        return Promise.resolve();
      },
      BindObject: () => undefined,
      PostMessage: () => undefined,
      ExecuteScriptAsync: () => Promise.resolve(undefined),
      ExecuteScript: () => undefined,
    },
    pageCheck: {
      snapshot: () => probe.snapshot(),
      reset: () => probe.reset(),
      setEventRate: (rate: number) => pump.setRate(rate),
      sizes: () => data.sizes,
      sockets: () => pump.sockets(),
      routes: listRoutes,
      navigate,
      currentRoute,
    },
  });
}

install();
