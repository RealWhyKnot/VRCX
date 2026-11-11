type ElementHolder = {
  $el: unknown;
};

type FocusTarget = {
  focus: () => void;
};

type BoundingRectTarget = {
  getBoundingClientRect: () => { width: number };
};

function isElementHolder(value: unknown): value is ElementHolder {
  return typeof value === "object" && value !== null && "$el" in value;
}

export function resolveElementTarget(target: unknown): unknown {
  if (isElementHolder(target) && target.$el !== null && target.$el !== undefined) {
    return target.$el;
  }
  return target;
}

export function isFocusTarget(value: unknown): value is FocusTarget {
  return typeof value === "object" && value !== null && "focus" in value && typeof value.focus === "function";
}

function isBoundingRectTarget(value: unknown): value is BoundingRectTarget {
  return typeof value === "object" && value !== null && "getBoundingClientRect" in value && typeof value.getBoundingClientRect === "function";
}

export function measureElementWidth(target: unknown): number | null {
  const element = resolveElementTarget(target);
  if (!isBoundingRectTarget(element)) {
    return null;
  }
  const { width } = element.getBoundingClientRect();
  return Number.isFinite(width) ? width : null;
}
