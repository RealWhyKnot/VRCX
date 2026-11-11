export function needsCsvQuotes(text) {
  return /[\x00-\x1f,"]/.test(text);
}

export function formatCsvField(value) {
  if (value === null || typeof value === "undefined") {
    return "";
  }
  const text = String(value);
  if (needsCsvQuotes(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export function formatCsvRow(obj, fields) {
  return fields.map((field) => formatCsvField(obj?.[field])).join(",");
}
