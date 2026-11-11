import type { FriendContext } from "../../../stores/friend-types";

export type FriendEntry = {
  id: string;
  friend: FriendContext;
  instanceId: string | undefined;
  section?: "same-instance" | "online";
};

export type SameInstanceGroup = {
  instanceId: string;
  friends: FriendContext[];
};

export type CardItem = {
  key: string;
  friend: FriendContext;
  displayInstanceInfo: boolean;
};

export type CardsRow = {
  type: "cards";
  key: string;
  items: CardItem[];
};

export type VirtualRow =
  | { type: "header"; key: string; instanceId: string; count: number }
  | { type: "group-header"; key: string; label: string; count: number; groupKey: string; collapsed: boolean }
  | { type: "divider"; key: string }
  | CardsRow;

export type GridLayoutOptions = {
  preferredColumns?: number;
  shouldForceStretch?: boolean;
  shouldDisableAutoStretch?: boolean;
  shouldMatchMaxColumnWidth?: boolean;
};
