import type { ActivityBridge } from "./bridge-activity.ts";
import type { EntitiesBridge } from "./bridge-entities.ts";
import type { FeedBridge } from "./bridge-feed.ts";
import type { GameLogBridge } from "./bridge-game-log.ts";
import type { TablesBridge } from "./bridge-tables.ts";

type CoreBridge = {
  SetUser(userId: string): Promise<void>;
  BeginTransaction(): Promise<void>;
  CommitTransaction(): Promise<void>;
  CreateConfigTable(): Promise<void>;
  GetConfigValue(key: string): Promise<string>;
  SetConfigValue(key: string, value: string): Promise<void>;
  RemoveConfigValue(key: string): Promise<void>;
};

type DatabaseBridge = CoreBridge & ActivityBridge & EntitiesBridge & FeedBridge & GameLogBridge & TablesBridge;

export type { DatabaseBridge };
