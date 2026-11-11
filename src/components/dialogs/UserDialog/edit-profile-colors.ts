export function normalizeColor(value: string | null | undefined) {
  const hex = (value ?? "").trim().replace(/^#/, "").toLowerCase();
  return /^[0-9a-f]{6}$/.test(hex) ? hex : "";
}

export function getThemeHexColor(value: string) {
  const normalized = normalizeColor(value);
  return normalized ? `#${normalized}` : "#ffffff";
}
