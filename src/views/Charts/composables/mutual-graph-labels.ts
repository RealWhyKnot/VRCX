const MAX_LABEL_NAME_LENGTH = 20;

export function truncateLabelText(text: string) {
  if (!text) return "Unknown";
  return text.length > MAX_LABEL_NAME_LENGTH ? `${text.slice(0, MAX_LABEL_NAME_LENGTH)}…` : text;
}

export function firstNonEmpty(values: (string | null | undefined)[], fallback: string) {
  for (const value of values) {
    if (value) return value;
  }
  return fallback;
}
