type ReturnKind = "void" | "number" | "boolean" | "string" | "null" | "array" | "object";

type BridgeSurface = { bridge: string; methods: { name: string; kind: ReturnKind }[] }[];

type DataProfile = "real" | "stress";

type HostConfig = {
  surface: BridgeSurface;
  profile: DataProfile;
  seed: number;
  eventsPerSecond: number;
  dashboardId: string;
};

type BridgeCall = { bridge: string; method: string; count: number };

type ProbeSnapshot = {
  now: number;
  longTasks: { start: number; duration: number }[];
  errors: string[];
  mutations: number;
  topMutations: { target: string; count: number }[];
  pendingBridgeCalls: number;
  lastBridgeActivity: number;
  bridgeCalls: BridgeCall[];
  unknownEndpoints: string[];
  apiCalls: { endpoint: string; count: number }[];
  events: number;
  domNodes: number;
};

export type { BridgeCall, BridgeSurface, DataProfile, HostConfig, ProbeSnapshot, ReturnKind };
