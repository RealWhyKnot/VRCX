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

export function normalizeUtcHour(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(-12, Math.min(14, Math.round(n)));
}

export function formatUtcHour(offset) {
  const n = normalizeUtcHour(offset);
  return `UTC${n >= 0 ? "+" : ""}${n}`;
}

export function parseClockOffset(value) {
  if (typeof value === "number") {
    return normalizeUtcHour(value);
  }
  if (typeof value !== "string") {
    return 0;
  }
  if (/^[+-]?\d+$/.test(value.trim())) {
    return normalizeUtcHour(Number(value));
  }
  const utcMatch = value.match(/^UTC([+-])(\d{1,2})(?::(\d{1,2}))?$/i);
  if (utcMatch) {
    const sign = utcMatch[1] === "+" ? 1 : -1;
    const hours = Number(utcMatch[2]);
    const minutes = Number(utcMatch[3] || 0);
    return normalizeUtcHour(sign * (hours + minutes / 60));
  }

  try {
    return normalizeUtcHour(dayjs().tz(value).utcOffset() / 60);
  } catch {
    return 0;
  }
}

export function normalizeClock(entry) {
  if (entry && typeof entry === "object") {
    if ("offset" in entry) {
      return { offset: parseClockOffset(entry.offset) };
    }
    if ("timezone" in entry) {
      return { offset: parseClockOffset(entry.timezone) };
    }
  }
  return { offset: 0 };
}

export function loadVisibility(storage) {
  try {
    const saved = storage.getItem("VRCX_statusBarVisibility");
    if (saved) {
      return { ...defaultVisibility, ...JSON.parse(saved) };
    }
  } catch {}
  return { ...defaultVisibility };
}

export function loadClocks(storage, defaults) {
  try {
    const saved = storage.getItem("VRCX_statusBarClocks");
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length === 3) {
        return parsed.map(normalizeClock);
      }
    }
  } catch {}
  return defaults.map((c) => ({ ...c }));
}

export function loadClockCount(storage) {
  try {
    const saved = storage.getItem("VRCX_statusBarClockCount");
    if (saved !== null) {
      const n = Number(saved);
      if (n >= 0 && n <= 3) return n;
    }
  } catch {}
  return 2;
}

export function formatAppUptime(elapsedSeconds) {
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
