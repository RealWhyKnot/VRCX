import type { ActivityExcludeHours, ActivityNormalizeConfig, ActivitySession } from "../types/activity.ts";

export type ActivityExcludeHoursOption = ActivityExcludeHours & { enabled: boolean };

export type ActivitySnapshotSync = {
  userId: string;
  updatedAt: string;
  isSelf: boolean;
  sourceLastCreatedAt: string;
  pendingSessionStartAt: number | null;
  cachedRangeDays: number;
};

export type ActivityViewBody = {
  rawBuckets: number[];
  normalizedBuckets: number[];
  peakDay: string;
  peakTime: string;
  filteredEventCount: number;
};

export type ActivityOverlapBody = {
  rawBuckets: number[];
  normalizedBuckets: number[];
  overlapPercent: number;
  bestOverlapTime: string;
};

export type CachedActivityView = ActivityViewBody & {
  builtFromCursor: string;
  builtAt: string;
};

export type CachedOverlapView = ActivityOverlapBody & {
  builtFromCursor: string;
  builtAt: string;
};

export type SessionsSnapshotResult = {
  sessions: ActivitySession[];
  pendingSessionStartAt: number | null;
};

export type ActivitySnapshot = {
  userId: string;
  isSelf: boolean;
  sync: ActivitySnapshotSync;
  sessions: ActivitySession[];
  activityViews: Map<string, CachedActivityView>;
  overlapViews: Map<string, CachedOverlapView>;
};

export type UserActivityState = {
  lastLoadedUserId: string;
  activeRequestId: number;
  activeOverlapRequestId: number;
  activeTopWorldsRequestId: number;
};

export type ActivityCache = {
  userId: string;
  isSelf: boolean;
  updatedAt: string;
  sourceLastCreatedAt: string;
  pendingSessionStartAt: number | null;
  cachedRangeDays: number;
  sessions: ActivitySession[];
};

export type ActivityResponse = {
  userId: string;
  isSelf: boolean;
  cachedRangeDays: number;
  sessions: ActivitySession[];
  view: CachedActivityView;
};

export type ActivityLoadOptions = {
  isSelf?: boolean;
  rangeDays?: number;
  normalizeConfig: ActivityNormalizeConfig;
  dayLabels: string[];
  forceRefresh?: boolean;
};

export type ActivityOverlapOptions = {
  rangeDays?: number;
  dayLabels: string[];
  normalizeConfig: ActivityNormalizeConfig;
  excludeHours?: ActivityExcludeHoursOption | undefined;
  forceRefresh?: boolean;
};

export type ActivityViewRequest = {
  userId: string;
  isSelf?: boolean;
  rangeDays?: number;
  dayLabels: string[];
  forceRefresh?: boolean;
};

export type ActivityOverlapViewRequest = {
  currentUserId: string;
  targetUserId: string;
  rangeDays?: number;
  dayLabels: string[];
  excludeHours?: ActivityExcludeHoursOption | undefined;
  forceRefresh?: boolean;
};

export type TopWorldsOptions = {
  rangeDays?: number;
  limit?: number;
  sortBy?: string;
  excludeWorldId?: string;
};

export type TopWorldsRequest = TopWorldsOptions & {
  userId: string;
};

export type ActivityViewSummary = {
  hasAnyData: boolean;
  filteredEventCount: number;
  peakDay: string;
  peakTime: string;
  rawBuckets: number[];
  normalizedBuckets: number[];
};

export type OverlapViewSummary = {
  hasOverlapData: boolean;
  overlapPercent: number;
  bestOverlapTime: string;
  rawBuckets: number[];
  normalizedBuckets: number[];
};
