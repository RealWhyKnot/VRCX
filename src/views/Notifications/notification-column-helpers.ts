import { i18n } from "../../plugins/i18n";

export const { t } = i18n.global;

export const te = (key: string) => i18n.global.te(key);

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function textOf(source: unknown, key: string): string | undefined {
  if (!isRecord(source)) {
    return undefined;
  }
  const value = source[key];
  return typeof value === "string" ? value : undefined;
}

export function firstNonEmpty(...values: (string | undefined)[]): string | undefined {
  for (const value of values) {
    if (value) {
      return value;
    }
  }
  return undefined;
}

export const isGroupId = (id: string | undefined) => typeof id === "string" && id.startsWith("grp_");
