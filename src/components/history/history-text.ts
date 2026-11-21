export function historyText(value: unknown, key: string): string {
  if (typeof value !== "object" || value === null || !(key in value)) return "";
  const text: unknown = Reflect.get(value, key);
  return typeof text === "string" ? text : "";
}
