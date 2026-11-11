export function needsCsvQuotes(text: string): boolean {
  return Array.from(text).some((char) => char === "," || char === '"' || char.charCodeAt(0) <= 0x1f);
}

function toCsvText(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "object") {
    return JSON.stringify(value);
  }
  if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") {
    return String(value);
  }
  return "";
}

export function formatCsvField(value: unknown): string {
  if (value === null || typeof value === "undefined") {
    return "";
  }
  const text = toCsvText(value);
  if (needsCsvQuotes(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function readField(obj: unknown, field: string): unknown {
  return typeof obj === "object" && obj !== null ? Reflect.get(obj, field) : undefined;
}

export function formatCsvRow(obj: unknown, fields: readonly string[]): string {
  return fields.map((field) => formatCsvField(readField(obj, field))).join(",");
}
