import { computed, reactive, type Ref } from "vue";
import { configRepository } from "../../../services/config";
import { logFailure } from "@/stores/log-failure";

export const LAYOUT_ITERATIONS_MIN = 300;
export const LAYOUT_ITERATIONS_MAX = 1500;
export const LAYOUT_SPACING_MIN = 8;
export const LAYOUT_SPACING_MAX = 240;
export const EDGE_CURVATURE_MIN = 0;
export const EDGE_CURVATURE_MAX = 0.2;
export const COMMUNITY_SEPARATION_MIN = 0;
export const COMMUNITY_SEPARATION_MAX = 3;

export const LAYOUT_DEFAULTS = {
  layoutIterations: 800,
  layoutSpacing: 60,
  edgeCurvature: 0.1,
  communitySeparation: 0,
};

export type MutualGraphLayoutSettings = typeof LAYOUT_DEFAULTS;

export function clampNumber(value: number, min: number, max: number) {
  const normalized = Number.isFinite(value) ? value : min;
  return Math.min(max, Math.max(min, normalized));
}

export function useMutualGraphLayoutSettings(excludedFriendIds: Ref<string[]>) {
  const layoutSettings = reactive<MutualGraphLayoutSettings>({ ...LAYOUT_DEFAULTS });

  const layoutIterationsModel = computed({
    get: () => [layoutSettings.layoutIterations],
    set: (value: number[] | undefined) => {
      layoutSettings.layoutIterations = clampNumber(Math.round(value?.[0] ?? layoutSettings.layoutIterations), LAYOUT_ITERATIONS_MIN, LAYOUT_ITERATIONS_MAX);
    },
  });

  const layoutSpacingModel = computed({
    get: () => [layoutSettings.layoutSpacing],
    set: (value: number[] | undefined) => {
      layoutSettings.layoutSpacing = clampNumber(Math.round(value?.[0] ?? layoutSettings.layoutSpacing), LAYOUT_SPACING_MIN, LAYOUT_SPACING_MAX);
    },
  });

  const edgeCurvatureModel = computed({
    get: () => [layoutSettings.edgeCurvature],
    set: (value: number[] | undefined) => {
      const next = clampNumber(value?.[0] ?? layoutSettings.edgeCurvature, EDGE_CURVATURE_MIN, EDGE_CURVATURE_MAX);
      layoutSettings.edgeCurvature = Number(next.toFixed(2));
    },
  });

  const edgeCurvatureLabel = computed(() => layoutSettings.edgeCurvature.toFixed(2));

  const communitySeparationModel = computed({
    get: () => [layoutSettings.communitySeparation],
    set: (value: number[] | undefined) => {
      const next = clampNumber(value?.[0] ?? layoutSettings.communitySeparation, COMMUNITY_SEPARATION_MIN, COMMUNITY_SEPARATION_MAX);
      layoutSettings.communitySeparation = Number(next.toFixed(1));
    },
  });
  const communitySeparationLabel = computed(() => layoutSettings.communitySeparation.toFixed(1));

  let lastLayoutSpacing = layoutSettings.layoutSpacing;

  function takeLayoutSpacingDelta() {
    const spacing = clampNumber(layoutSettings.layoutSpacing, LAYOUT_SPACING_MIN, LAYOUT_SPACING_MAX);
    const deltaSpacing = spacing - lastLayoutSpacing;
    lastLayoutSpacing = spacing;
    return { spacing, deltaSpacing };
  }

  async function loadLayoutSettings() {
    const [iterations, spacing, curvature, separation] = await Promise.all([
      configRepository.getInt("VRCX_MutualGraphLayoutIterations", LAYOUT_DEFAULTS.layoutIterations),
      configRepository.getInt("VRCX_MutualGraphLayoutSpacing", LAYOUT_DEFAULTS.layoutSpacing),
      configRepository.getFloat("VRCX_MutualGraphEdgeCurvature", LAYOUT_DEFAULTS.edgeCurvature),
      configRepository.getFloat("VRCX_MutualGraphCommunitySeparation", LAYOUT_DEFAULTS.communitySeparation),
    ]);
    layoutSettings.layoutIterations = clampNumber(iterations, LAYOUT_ITERATIONS_MIN, LAYOUT_ITERATIONS_MAX);
    layoutSettings.layoutSpacing = clampNumber(spacing, LAYOUT_SPACING_MIN, LAYOUT_SPACING_MAX);
    layoutSettings.edgeCurvature = clampNumber(curvature, EDGE_CURVATURE_MIN, EDGE_CURVATURE_MAX);
    layoutSettings.communitySeparation = clampNumber(separation, COMMUNITY_SEPARATION_MIN, COMMUNITY_SEPARATION_MAX);
    lastLayoutSpacing = layoutSettings.layoutSpacing;
  }

  function persistLayoutSettings() {
    const saveFailed = logFailure("Saving mutual graph layout settings failed:");
    void configRepository.setInt("VRCX_MutualGraphLayoutIterations", layoutSettings.layoutIterations).catch(saveFailed);
    void configRepository.setInt("VRCX_MutualGraphLayoutSpacing", layoutSettings.layoutSpacing).catch(saveFailed);
    void configRepository.setFloat("VRCX_MutualGraphEdgeCurvature", layoutSettings.edgeCurvature).catch(saveFailed);
    void configRepository.setFloat("VRCX_MutualGraphCommunitySeparation", layoutSettings.communitySeparation).catch(saveFailed);
  }

  function resetLayoutSettings() {
    Object.assign(layoutSettings, LAYOUT_DEFAULTS);
    excludedFriendIds.value = [];
    persistLayoutSettings();
  }

  return {
    layoutSettings,
    layoutIterationsModel,
    layoutSpacingModel,
    edgeCurvatureModel,
    edgeCurvatureLabel,
    communitySeparationModel,
    communitySeparationLabel,
    takeLayoutSpacingDelta,
    loadLayoutSettings,
    persistLayoutSettings,
    resetLayoutSettings,
  };
}
