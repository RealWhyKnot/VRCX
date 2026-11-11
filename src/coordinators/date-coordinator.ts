import { useAppearanceSettingsStore } from "../stores/settings/appearance";

function padZero(num: number): string {
  return String(num).padStart(2, "0");
}

function toIsoLong(date: Date): string {
  const y = date.getFullYear();
  const m = padZero(date.getMonth() + 1);
  const d = padZero(date.getDate());
  const hh = padZero(date.getHours());
  const mm = padZero(date.getMinutes());
  const ss = padZero(date.getSeconds());
  return `${y}-${m}-${d} ${hh}:${mm}:${ss}`;
}

function toLocalShort(date: Date, dateFormat: string, isHour12: boolean): string {
  return date
    .toLocaleDateString(dateFormat, {
      month: "2-digit",
      day: "2-digit",
      hour: "numeric",
      minute: "numeric",
      hourCycle: isHour12 ? "h12" : "h23",
    })
    .replace(" AM", "am")
    .replace(" PM", "pm")
    .replace(",", "");
}

function toLocalLong(date: Date, dateFormat: string, isHour12: boolean): string {
  return date.toLocaleDateString(dateFormat, {
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
    hourCycle: isHour12 ? "h12" : "h23",
  });
}

function toLocalTime(date: Date, dateFormat: string, isHour12: boolean): string {
  return date.toLocaleTimeString(dateFormat, {
    hour: "numeric",
    minute: "numeric",
    hourCycle: isHour12 ? "h12" : "h23",
  });
}

function toLocalDate(date: Date, dateFormat: string): string {
  return date.toLocaleDateString(dateFormat, {
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
  });
}

function formatDateFilter(dateStr: string | number | null | undefined, format: string): string {
  const appearance = useAppearanceSettingsStore();
  const { dtIsoFormat: isIsoFormat, dtHour12: isHour12, currentCulture } = appearance;

  if (!dateStr) {
    return "-";
  }

  const dt = new Date(dateStr);
  if (isNaN(dt.getTime())) {
    return "-";
  }

  let dateFormat = "en-gb";
  if (!isIsoFormat && currentCulture) {
    dateFormat = currentCulture;
  }
  if (dateFormat.length > 4 && dateFormat[4] === "_") {
    dateFormat = dateFormat.slice(0, 4);
  }

  if (isIsoFormat && format === "long") {
    return toIsoLong(dt);
  } else if (format === "long") {
    return toLocalLong(dt, dateFormat, isHour12);
  } else if (format === "short") {
    return toLocalShort(dt, dateFormat, isHour12);
  } else if (format === "time") {
    return toLocalTime(dt, dateFormat, isHour12);
  } else if (format === "date") {
    return toLocalDate(dt, dateFormat);
  } else {
    console.warn(`Unknown date format: ${format}`);
  }

  return "-";
}

export { formatDateFilter };
