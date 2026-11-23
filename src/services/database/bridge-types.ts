import type { ActivityBridge } from "./bridge-activity.ts";
import type { EntitiesBridge } from "./bridge-entities.ts";
import type { FeedBridge } from "./bridge-feed.ts";
import type { GameLogBridge } from "./bridge-game-log.ts";
import type { TablesBridge } from "./bridge-tables.ts";

type CoreBridge = {
  SetUser(userId: string): Promise<void>;
  InitializeAccount(userId: string): Promise<void>;
  CreateConfigTable(): Promise<void>;
  GetConfigValue(key: string): Promise<string>;
  SetConfigValue(key: string, value: string): Promise<void>;
  RemoveConfigValue(key: string): Promise<void>;
};

type RetainedEventBridge = {
  AppendRetainedEvents(userId: string, payload: string): Promise<void>;
  PruneRetainedEvents(): Promise<void>;
  GetPlayerAvatarHistory(userId: string, beforeId: number | null, limit: number): Promise<string>;
  GetFriendPlatformHistory(userId: string, beforeId: number | null, limit: number): Promise<string>;
  GetRetainedProfileBaselines(userId: string, subjects: string): Promise<string>;
  GetProfileHistory(userId: string, beforeId: number | null, limit: number): Promise<string>;
  GetFavoriteHistory(beforeId: number | null, limit: number): Promise<string>;
  GetBadgeHistory(beforeId: number | null, limit: number): Promise<string>;
  GetLatestBadgeById(badgeId: string): Promise<string>;
  GetBadgeHistoryAt(createdAt: string): Promise<string>;
};

type DatabaseBridge = CoreBridge & ActivityBridge & EntitiesBridge & FeedBridge & GameLogBridge & TablesBridge & RetainedEventBridge;

export type { DatabaseBridge };
