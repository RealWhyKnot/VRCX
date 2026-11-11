export type ActivitySession = {
  start: number;
  end: number;
  isOpenTail?: boolean;
  sourceRevision?: string;
};

export type ActivityEvent = {
  created_at: string;
  type: string;
};

export type GamelogSessionRow = {
  created_at: string;
  time?: number | null;
};

export type ActivityNormalizeConfig = {
  floorPercentile?: number;
  capPercentile?: number;
  rankWeight?: number;
  targetCoverage?: number;
  targetVolume?: number;
  rangeDays?: number;
};

export type ActivityExcludeHours = {
  startHour: number;
  endHour: number;
};

export type ActivityHeatmapView = {
  rangeDays: number;
  rawBuckets: number[];
  normalizedBuckets: number[];
  filteredEventCount: number;
  peakDay: string;
  peakTime: string;
};

export type ActivityOverlapView = {
  rangeDays: number;
  rawBuckets: number[];
  normalizedBuckets: number[];
  overlapPercent: number;
  bestOverlapTime: string;
};

export type ActivityDailyTotal = {
  date: string;
  totalMs: number;
};
