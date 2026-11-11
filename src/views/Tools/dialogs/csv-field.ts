function needsQuoting(value: string): boolean {
  for (let index = 0; index < value.length; index++) {
    const char = value.charAt(index);
    if (char === "," || char === '"' || value.charCodeAt(index) < 32) {
      return true;
    }
  }
  return false;
}

export function escapeCsvField(value: string): string {
  if (needsQuoting(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
