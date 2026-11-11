import type { ActivityNormalizeConfig } from "../types/activity.ts";

const DEFAULT_ACTIVITY_NORMALIZE: ActivityNormalizeConfig = {
  floorPercentile: 15,
  capPercentile: 85,
  rankWeight: 0.2,
  targetCoverage: 0.25,
  targetVolume: 60,
};

const ACTIVITY_NORMALIZE_BY_RANGE = new Map<number, ActivityNormalizeConfig>([
  [
    7,
    {
      floorPercentile: 10,
      capPercentile: 80,
      rankWeight: 0.15,
      targetCoverage: 0.12,
      targetVolume: 40,
    },
  ],
  [
    30,
    {
      floorPercentile: 15,
      capPercentile: 85,
      rankWeight: 0.2,
      targetCoverage: 0.25,
      targetVolume: 60,
    },
  ],
  [
    90,
    {
      floorPercentile: 15,
      capPercentile: 85,
      rankWeight: 0.2,
      targetCoverage: 0.3,
      targetVolume: 50,
    },
  ],
]);

const DEFAULT_OVERLAP_NORMALIZE: ActivityNormalizeConfig = {
  floorPercentile: 15,
  capPercentile: 85,
  rankWeight: 0.2,
  targetCoverage: 0.15,
  targetVolume: 25,
};

const OVERLAP_NORMALIZE_BY_RANGE = new Map<number, ActivityNormalizeConfig>([
  [
    7,
    {
      floorPercentile: 10,
      capPercentile: 80,
      rankWeight: 0.15,
      targetCoverage: 0.08,
      targetVolume: 15,
    },
  ],
  [
    30,
    {
      floorPercentile: 15,
      capPercentile: 85,
      rankWeight: 0.2,
      targetCoverage: 0.15,
      targetVolume: 25,
    },
  ],
  [
    90,
    {
      floorPercentile: 15,
      capPercentile: 85,
      rankWeight: 0.2,
      targetCoverage: 0.18,
      targetVolume: 20,
    },
  ],
]);

export function pickActivityNormalizeConfig(rangeDays: number): ActivityNormalizeConfig {
  return ACTIVITY_NORMALIZE_BY_RANGE.get(rangeDays) ?? DEFAULT_ACTIVITY_NORMALIZE;
}

export function pickOverlapNormalizeConfig(rangeDays: number): ActivityNormalizeConfig {
  return OVERLAP_NORMALIZE_BY_RANGE.get(rangeDays) ?? DEFAULT_OVERLAP_NORMALIZE;
}
