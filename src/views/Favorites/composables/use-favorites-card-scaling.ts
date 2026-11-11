import { computed, nextTick, onBeforeMount, ref, watch } from "vue";
import { useResizeObserver } from "@vueuse/core";

import { configRepository } from "../../../services/config.ts";

type CardScalingOptions = {
  min?: number;
  max?: number;
  step?: number;
  spacingMin?: number;
  spacingMax?: number;
  spacingStep?: number;
  baseWidth?: number;
  baseGap?: number;
  gapStep?: number;
  configKey?: string;
  spacingConfigKey?: string;
  basePaddingY?: number;
  basePaddingX?: number;
  baseContentGap?: number;
  baseActionGap?: number;
  baseActionGroupGap?: number;
  baseActionMargin?: number;
  baseCheckboxMargin?: number;
  minGap?: number;
  minPadding?: number;
  defaultSpacing?: number;
};

type GridLayoutOptions = {
  preferredColumns?: number;
  forceStretch?: boolean;
  disableAutoStretch?: boolean;
  matchMaxColumnWidth?: boolean;
};

const LEADING_FLOAT_PATTERN = /^\s*[+-]?(?:Infinity|\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/;

function clamp(value: number, min: number, max: number) {
  if (Number.isNaN(value)) {
    return min;
  }
  if (value < min) {
    return min;
  }
  if (value > max) {
    return max;
  }
  return value;
}

function parseLeadingFloat(value: string): number {
  const match = LEADING_FLOAT_PATTERN.exec(value);
  return match ? Number(match[0]) : Number.NaN;
}

export function useFavoritesCardScaling(options: CardScalingOptions = {}) {
  const slider = {
    min: options.min ?? 0.6,
    max: options.max ?? 1,
    step: options.step ?? 0.01,
  };
  const spacingSlider = {
    min: options.spacingMin ?? 0.5,
    max: options.spacingMax ?? 1.5,
    step: options.spacingStep ?? 0.05,
  };
  const baseWidth = options.baseWidth ?? 260;
  const baseGap = options.baseGap ?? 12;
  const gapStep = options.gapStep ?? 8;
  const configKey = options.configKey ?? "";
  const spacingConfigKey = options.spacingConfigKey ?? "";
  const basePaddingY = options.basePaddingY ?? 8;
  const basePaddingX = options.basePaddingX ?? 10;
  const baseContentGap = options.baseContentGap ?? 10;
  const baseActionGap = options.baseActionGap ?? 8;
  const baseActionGroupGap = options.baseActionGroupGap ?? 6;
  const baseActionMargin = options.baseActionMargin ?? 8;
  const baseCheckboxMargin = options.baseCheckboxMargin ?? 10;
  const minGap = options.minGap ?? 4;
  const minPadding = options.minPadding ?? 4;
  const defaultSpacing = clamp(options.defaultSpacing ?? 1, spacingSlider.min, spacingSlider.max);

  const cardScaleBase = ref(1);
  const cardSpacingBase = ref(defaultSpacing);
  const containerRef = ref<HTMLElement | null>(null);
  const containerWidth = ref(0);

  const updateContainerWidth = (element: HTMLElement | null = containerRef.value) => {
    if (!element) {
      containerWidth.value = 0;
      return;
    }
    containerWidth.value = Math.max(element.clientWidth, 0);
  };

  const cardScale = computed({
    get: () => cardScaleBase.value,
    set: (value: number) => {
      const nextValue = clamp(value || 1, slider.min, slider.max);
      cardScaleBase.value = nextValue;
      if (configKey) {
        void configRepository.setString(configKey, String(nextValue)).catch((error: unknown) => console.error(error));
      }
    },
  });

  const cardSpacing = computed({
    get: () => cardSpacingBase.value,
    set: (value: number) => {
      const nextValue = clamp(value || 1, spacingSlider.min, spacingSlider.max);
      cardSpacingBase.value = nextValue;
      if (spacingConfigKey) {
        void configRepository.setString(spacingConfigKey, String(nextValue)).catch((error: unknown) => console.error(error));
      }
    },
  });

  const gridStyle = computed(() => {
    const minWidth = baseWidth * cardScale.value;
    const spacing = cardSpacing.value;
    const adjustedGapBase = baseGap + (cardScale.value - 1) * gapStep;
    const gap = Math.max(minGap, adjustedGapBase * spacing);
    const paddingY = Math.max(minPadding, basePaddingY * cardScale.value * spacing);
    const paddingX = Math.max(minPadding, basePaddingX * cardScale.value * spacing);
    const contentGap = Math.max(minPadding, baseContentGap * cardScale.value * spacing);
    const actionsGap = Math.max(minPadding, baseActionGap * cardScale.value * spacing);
    const actionsGroupGap = Math.max(minPadding, baseActionGroupGap * cardScale.value * spacing);
    const actionsMargin = Math.max(0, baseActionMargin * cardScale.value * spacing);
    const checkboxMargin = Math.max(0, baseCheckboxMargin * cardScale.value * spacing);

    return (count = 1, layoutOptions: GridLayoutOptions = {}) => {
      const width = Math.max(containerWidth.value, 0);
      const itemCount = Math.max(count || 0, 0);
      const safeCount = itemCount > 0 ? itemCount : 1;
      const maxColumns = width > 0 ? Math.max(1, Math.floor((width + gap) / (minWidth + gap)) || 1) : 1;
      const preferredColumns = layoutOptions.preferredColumns;
      const requestedColumns = preferredColumns ? Math.max(1, Math.min(Math.round(preferredColumns), maxColumns)) : maxColumns;
      const columns = Math.max(1, Math.min(safeCount, requestedColumns));
      const shouldForceStretch = Boolean(layoutOptions.forceStretch);
      const shouldDisableAutoStretch = Boolean(layoutOptions.disableAutoStretch);
      const shouldMatchMaxColumnWidth = Boolean(layoutOptions.matchMaxColumnWidth);
      const shouldStretch = !shouldDisableAutoStretch && (shouldForceStretch || itemCount >= maxColumns);

      let cardWidth = minWidth;
      const maxColumnWidth = maxColumns > 0 ? (width - gap * (maxColumns - 1)) / maxColumns : minWidth;

      if (shouldStretch && columns > 0) {
        const columnsWidth = width - gap * (columns - 1);
        const rawWidth = columnsWidth > 0 ? columnsWidth / columns : minWidth;
        if (Number.isFinite(rawWidth) && rawWidth > 0) {
          cardWidth = Math.max(minWidth, rawWidth);
        }
      } else if (shouldMatchMaxColumnWidth && Number.isFinite(maxColumnWidth) && maxColumnWidth > 0) {
        cardWidth = Math.max(minWidth, maxColumnWidth);
      }

      return {
        "--favorites-card-min-width": `${Math.round(minWidth)}px`,
        "--favorites-card-gap": `${Math.round(gap)}px`,
        "--favorites-card-target-width": `${Math.round(cardWidth)}px`,
        "--favorites-grid-columns": `${columns}`,
        "--favorites-card-scale": cardScale.value.toFixed(2),
        "--favorites-card-padding-y": `${Math.round(paddingY)}px`,
        "--favorites-card-padding-x": `${Math.round(paddingX)}px`,
        "--favorites-card-content-gap": `${Math.round(contentGap)}px`,
        "--favorites-card-action-gap": `${Math.round(actionsGap)}px`,
        "--favorites-card-action-group-gap": `${Math.round(actionsGroupGap)}px`,
        "--favorites-card-action-margin": `${Math.round(actionsMargin)}px`,
        "--favorites-card-checkbox-margin": `${Math.round(checkboxMargin)}px`,
        "--favorites-card-spacing-scale": cardSpacing.value.toFixed(2),
      };
    };
  });

  watch(
    containerRef,
    (element) => {
      if (!element) {
        containerWidth.value = 0;
        return;
      }

      void nextTick(() => updateContainerWidth(element)).catch((error: unknown) => console.error(error));
    },
    { immediate: true }
  );

  useResizeObserver(containerRef, (entries) => {
    const [entry] = entries;
    const width = entry?.contentRect.width ?? containerRef.value?.clientWidth ?? 0;
    containerWidth.value = Math.max(width, 0);
  });

  async function loadCardPreferences() {
    if (configKey) {
      const storedScale = await configRepository.getString(configKey, "1");
      const parsedScale = parseLeadingFloat(storedScale);
      if (!Number.isNaN(parsedScale)) {
        cardScaleBase.value = clamp(parsedScale, slider.min, slider.max);
      }
    }

    if (spacingConfigKey) {
      const storedSpacing = await configRepository.getString(spacingConfigKey, String(defaultSpacing));
      const parsedSpacing = parseLeadingFloat(storedSpacing);
      if (!Number.isNaN(parsedSpacing)) {
        cardSpacingBase.value = clamp(parsedSpacing, spacingSlider.min, spacingSlider.max);
      }
    }
  }

  onBeforeMount(() => {
    void loadCardPreferences().catch((error: unknown) => console.error("Failed to load favorites card preferences", error));
  });

  return {
    cardScale,
    cardSpacing,
    slider,
    spacingSlider,
    containerRef,
    gridStyle,
  };
}
