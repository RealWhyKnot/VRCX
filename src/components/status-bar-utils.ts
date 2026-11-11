import dayjs from "dayjs";

export const defaultVisibility = {
  vrchat: true,
  steamvr: true,
  proxy: true,
  ws: true,
  nowPlaying: true,
  uptime: true,
  clocks: true,
  zoom: true,
  servers: true,
};

export type StatusBarVisibilityKey = keyof typeof defaultVisibility;
export type StatusBarVisibility = Record<StatusBarVisibilityKey, boolean>;
export type StatusBarClock = { offset: number };

type ReadableStorage = Pick<Storage, "getItem">;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isVisibilityKey(key: string): key is StatusBarVisibilityKey {
  return Object.hasOwn(defaultVisibility, key);
}

export function normalizeUtcHour(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(-12, Math.min(14, Math.round(n)));
}

export function formatUtcHour(offset: unknown): string {
  const n = normalizeUtcHour(offset);
  return `UTC${n >= 0 ? "+" : ""}${n}`;
}

export function parseClockOffset(value: unknown): number {
  if (typeof value === "number") {
    return normalizeUtcHour(value);
  }
  if (typeof value !== "string") {
    return 0;
  }
  if (/^[+-]?\d+$/.test(value.trim())) {
    return normalizeUtcHour(Number(value));
  }
  const utcMatch = /^UTC([+-])(\d{1,2})(?::(\d{1,2}))?$/i.exec(value);
  if (utcMatch) {
    const sign = utcMatch[1] === "+" ? 1 : -1;
    const hours = Number(utcMatch[2]);
    const minutes = Number(utcMatch[3] ?? 0);
    return normalizeUtcHour(sign * (hours + minutes / 60));
  }

  try {
    return normalizeUtcHour(dayjs().tz(value).utcOffset() / 60);
  } catch {
    return 0;
  }
}

export function normalizeClock(entry: unknown): StatusBarClock {
  if (isRecord(entry)) {
    if ("offset" in entry) {
      return { offset: parseClockOffset(entry["offset"]) };
    }
    if ("timezone" in entry) {
      return { offset: parseClockOffset(entry["timezone"]) };
    }
  }
  return { offset: 0 };
}

export function mergeVisibility(saved: unknown): StatusBarVisibility {
  const merged: StatusBarVisibility = { ...defaultVisibility };
  if (!isRecord(saved)) return merged;
  for (const [key, value] of Object.entries(saved)) {
    if (isVisibilityKey(key) && typeof value === "boolean") {
      merged[key] = value;
    }
  }
  return merged;
}

export function loadVisibility(storage: ReadableStorage): StatusBarVisibility {
  try {
    const saved = storage.getItem("VRCX_statusBarVisibility");
    if (saved) {
      const parsed: unknown = JSON.parse(saved);
      return mergeVisibility(parsed);
    }
  } catch {
    return { ...defaultVisibility };
  }
  return { ...defaultVisibility };
}

export function loadClocks(storage: ReadableStorage, defaults: StatusBarClock[]): StatusBarClock[] {
  const copyDefaults = () => defaults.map((c) => ({ ...c }));
  try {
    const saved = storage.getItem("VRCX_statusBarClocks");
    if (saved) {
      const parsed: unknown = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length === 3) {
        return parsed.map((entry: unknown) => normalizeClock(entry));
      }
    }
  } catch {
    return copyDefaults();
  }
  return copyDefaults();
}

export function loadClockCount(storage: ReadableStorage): number {
  try {
    const saved = storage.getItem("VRCX_statusBarClockCount");
    if (saved !== null) {
      const n = Number(saved);
      if (n >= 0 && n <= 3) return n;
    }
  } catch {
    return 2;
  }
  return 2;
}

export function formatAppUptime(elapsedSeconds: number): string {
  const safe = Math.max(0, Math.floor(elapsedSeconds));
  const hours = Math.floor(safe / 3600)
    .toString()
    .padStart(2, "0");
  const minutes = Math.floor((safe % 3600) / 60)
    .toString()
    .padStart(2, "0");
  const seconds = Math.floor(safe % 60)
    .toString()
    .padStart(2, "0");
  return `${hours}:${minutes}:${seconds}`;
}
