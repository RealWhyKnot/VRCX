import type Graph from "graphology";
import type Sigma from "sigma";
import type { NodeDisplayData } from "sigma/types";
import type { VrcxUser } from "../../../types/vrcx";

export type MutualNodeAttributes = {
  label: string;
  size: number;
  x?: number;
  y?: number;
  color?: string | undefined;
  community?: number | undefined;
  isOptedOut?: boolean;
  lastFetchedAt?: string | null;
};

export type MutualEdgeAttributes = {
  size: number;
  curvature?: number;
};

export type MutualGraph = Graph<MutualNodeAttributes, MutualEdgeAttributes>;

export type MutualNodeMeta = {
  lastFetchedAt: string | null;
  isOptedOut: boolean;
};

export type MutualMapEntry = {
  friend: { id: string; ref?: VrcxUser | undefined };
  mutuals: { id: string; displayName?: string | undefined }[];
};

export type MutualMap = Map<string, MutualMapEntry>;

export type PickerItem = {
  value: string;
  label: string;
  search: string;
};

export type LayoutPosition = { x: number; y: number };

export type LayoutPositions = Record<string, LayoutPosition>;

export type LayoutResolver = {
  resolve: (positions: LayoutPositions) => void;
  reject: (reason: unknown) => void;
};

export type LayoutMessage = {
  requestId: number;
  positions: LayoutPositions | undefined;
  error: string | undefined;
};

export type LayoutRequestBody = {
  nodes: { id: string; attributes: MutualNodeAttributes }[];
  edges: { key: string; source: string; target: string; attributes: MutualEdgeAttributes }[];
  settings: {
    layoutIterations: number;
    layoutSpacing: number;
    deltaSpacing: number;
    reinitialize: boolean;
  };
};

export type LayoutCommunity = {
  nodes: { node: string; x: number; y: number }[];
  cx: number;
  cy: number;
};

export type SigmaCameraState = ReturnType<ReturnType<Sigma["getCamera"]>["getState"]>;

export type NodeReducerResult = Partial<NodeDisplayData> & { borderColor?: string };
