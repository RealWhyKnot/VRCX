import type { StyleValue } from "vue";

function isStyleValue(value: unknown): value is StyleValue {
  return typeof value === "string" || (typeof value === "object" && value !== null);
}

function stripDisplay(style: StyleValue): StyleValue {
  if (typeof style === "string") {
    return style
      .split(";")
      .map((s) => s.trim())
      .filter((s) => s && !s.toLowerCase().startsWith("display:"))
      .join("; ");
  }
  if (Array.isArray(style)) {
    return style.map(stripDisplay);
  }
  const next = { ...style };
  delete next.display;
  return next;
}

export function resolveWrapperStyle(raw: unknown): StyleValue | undefined {
  if (!raw || !isStyleValue(raw)) return undefined;
  const stripped = stripDisplay(raw);
  return stripped === "" ? undefined : stripped;
}
