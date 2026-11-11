import { computed, nextTick, onBeforeMount, ref, watch } from "vue";
import { useResizeObserver } from "@vueuse/core";

import { configRepository } from "../../../services/config.ts";
import { logFailure } from "../../../stores/log-failure.ts";

export type AvatarCardGridOptions = {
  scaleMin?: number;
  scaleMax?: number;
  scaleStep?: number;
  spacingMin?: number;
  spacingMax?: number;
  spacingStep?: number;
  baseCardWidth?: number;
  baseGap?: number;
  baseCardHeight?: number;
  scaleConfigKey?: string;
  spacingConfigKey?: string;
};

export type GridRow<T> = { key: string; items: T[] };

type GridMetrics = { minWidth: number; gap: number; columns: number; cardWidth: number };

function clamp(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function parseStoredNumber(value: string): number {
  if (value.trim() === "") return Number.NaN;
  return Number(value);
}

function isItemList(items: unknown): items is unknown[] {
  return Array.isArray(items);
}

export function useAvatarCardGrid(options: AvatarCardGridOptions = {}) {
  const scaleSlider = {
    min: options.scaleMin ?? 0.3,
    max: options.scaleMax ?? 0.9,
    step: options.scaleStep ?? 0.01,
  };
  const spacingSlider = {
    min: options.spacingMin ?? 0.5,
    max: options.spacingMax ?? 1.5,
    step: options.spacingStep ?? 0.05,
  };

  const baseCardWidth = options.baseCardWidth ?? 200;
  const baseGap = options.baseGap ?? 12;
  const baseCardHeight = options.baseCardHeight ?? 200;
  const scaleConfigKey = options.scaleConfigKey ?? "VRCX_MyAvatarsCardScale";
  const spacingConfigKey = options.spacingConfigKey ?? "VRCX_MyAvatarsCardSpacing";

  const cardScaleBase = ref(0.6);
  const cardSpacingBase = ref(1);
  const gridContainerRef = ref<HTMLElement | null>(null);
  const containerWidth = ref(0);

  const updateContainerWidth = (el?: HTMLElement | null) => {
    const element = el ?? gridContainerRef.value;
    if (!element) {
      containerWidth.value = 0;
      return;
    }
    containerWidth.value = Math.max(element.clientWidth, 0);
  };

  const cardScale = computed({
    get: () => cardScaleBase.value,
    set: (value: number) => {
      const next = clamp(value || 1, scaleSlider.min, scaleSlider.max);
      cardScaleBase.value = next;
      void configRepository.setString(scaleConfigKey, String(next)).catch(logFailure("Failed to save avatar card scale"));
    },
  });

  const cardSpacing = computed({
    get: () => cardSpacingBase.value,
    set: (value: number) => {
      const next = clamp(value || 1, spacingSlider.min, spacingSlider.max);
      cardSpacingBase.value = next;
      void configRepository.setString(spacingConfigKey, String(next)).catch(logFailure("Failed to save avatar card spacing"));
    },
  });

  const cardScalePercent = computed(() => Math.round(cardScale.value * 100));
  const cardSpacingPercent = computed(() => Math.round(cardSpacing.value * 100));

  const cardScaleValue = computed({
    get: () => [cardScale.value],
    set: (value: number[]) => {
      const next = value[0];
      if (typeof next === "number") cardScale.value = next;
    },
  });

  const cardSpacingValue = computed({
    get: () => [cardSpacing.value],
    set: (value: number[]) => {
      const next = value[0];
      if (typeof next === "number") cardSpacing.value = next;
    },
  });

  const getGridMetrics = (count = 1): GridMetrics => {
    const scale = cardScale.value;
    const spacing = cardSpacing.value;
    const minWidth = baseCardWidth * scale;
    const gap = Math.max(4, baseGap * spacing);
    const width = Math.max(containerWidth.value, 0);
    const itemCount = Math.max(count || 0, 0);
    const safeCount = itemCount > 0 ? itemCount : 1;
    const maxColumns = width > 0 ? Math.max(1, Math.floor((width + gap) / (minWidth + gap)) || 1) : 1;
    const columns = Math.max(1, Math.min(safeCount, maxColumns));

    let cardWidth = minWidth;
    if (itemCount >= maxColumns && columns > 0) {
      const columnsWidth = width - gap * (columns - 1);
      const rawWidth = columnsWidth > 0 ? columnsWidth / columns : minWidth;
      if (Number.isFinite(rawWidth) && rawWidth > 0) {
        cardWidth = Math.max(minWidth, rawWidth);
      }
    }

    return { minWidth, gap, columns, cardWidth };
  };

  const gridStyle = computed(() => {
    const scale = cardScale.value;
    const spacing = cardSpacing.value;
    const minWidth = baseCardWidth * scale;
    const gap = Math.max(4, baseGap * spacing);

    return (count = 1): Record<string, string> => {
      const { columns, cardWidth } = getGridMetrics(count);
      return {
        "--avatar-card-min-width": `${Math.round(minWidth)}px`,
        "--avatar-card-gap": `${Math.round(gap)}px`,
        "--avatar-card-target-width": `${Math.round(cardWidth)}px`,
        "--avatar-grid-columns": `${columns}`,
      };
    };
  });

  function chunkIntoRows<T>(items: readonly T[] | null | undefined, keyPrefix?: string): GridRow<T>[];
  function chunkIntoRows(items: unknown, keyPrefix?: string): GridRow<unknown>[];
  function chunkIntoRows(items: unknown, keyPrefix = "row"): GridRow<unknown>[] {
    if (!isItemList(items) || !items.length) return [];
    const { columns } = getGridMetrics(items.length);
    const safeColumns = Math.max(1, columns);
    const rows: GridRow<unknown>[] = [];
    for (let i = 0; i < items.length; i += safeColumns) {
      rows.push({
        key: `${keyPrefix}:${i}`,
        items: items.slice(i, i + safeColumns),
      });
    }
    return rows;
  }

  const estimateRowHeight = (itemCount = 0) => {
    const scale = cardScale.value;
    const spacing = cardSpacing.value;
    const { columns, gap } = getGridMetrics(itemCount);
    const safeColumns = Math.max(1, columns);
    const rowCount = Math.max(1, Math.ceil(itemCount / safeColumns));

    const cardHeight = baseCardHeight * scale * spacing;
    return rowCount * cardHeight + (rowCount - 1) * gap + 4;
  };

  watch(
    gridContainerRef,
    (element) => {
      if (!element) {
        containerWidth.value = 0;
        return;
      }
      void nextTick(() => updateContainerWidth(element)).catch(logFailure("Failed to update avatar grid width"));
    },
    { immediate: true }
  );

  useResizeObserver(gridContainerRef, (entries) => {
    const [entry] = entries;
    const width = entry ? entry.contentRect.width : (gridContainerRef.value?.clientWidth ?? 0);
    containerWidth.value = Math.max(width, 0);
  });

  onBeforeMount(async () => {
    try {
      const [storedScale, storedSpacing] = await Promise.all([
        configRepository.getString(scaleConfigKey, "0.6"),
        configRepository.getString(spacingConfigKey, "1"),
      ]);

      const parsedScale = parseStoredNumber(storedScale);
      if (!Number.isNaN(parsedScale)) {
        cardScaleBase.value = clamp(parsedScale, scaleSlider.min, scaleSlider.max);
      }

      const parsedSpacing = parseStoredNumber(storedSpacing);
      if (!Number.isNaN(parsedSpacing)) {
        cardSpacingBase.value = clamp(parsedSpacing, spacingSlider.min, spacingSlider.max);
      }
    } catch (error) {
      console.error("Failed to load avatar card grid preferences", error);
    }
  });

  return {
    cardScale,
    cardSpacing,
    cardScalePercent,
    cardSpacingPercent,
    cardScaleValue,
    cardSpacingValue,
    scaleSlider,
    spacingSlider,
    gridContainerRef,
    gridStyle,
    getGridMetrics,
    chunkIntoRows,
    estimateRowHeight,
    updateContainerWidth,
  };
}
