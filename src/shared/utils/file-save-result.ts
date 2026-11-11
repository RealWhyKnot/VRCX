export type FileSaveResult = { status: "saved"; path: string } | { status: "skipped" } | { status: "folderBlocked" } | { status: "accessDenied" };

function readField(value: unknown, key: string): unknown {
  if (typeof value !== "object" || value === null) {
    return undefined;
  }
  const entry = Object.entries(value).find(([name]) => name === key);
  return entry ? entry[1] : undefined;
}

export function parseFileSaveResult(text: string): FileSaveResult {
  const parsed: unknown = JSON.parse(text);
  const status = readField(parsed, "status");
  const path = readField(parsed, "path");
  if (status === "saved" && typeof path === "string" && path !== "") {
    return { status, path };
  }
  if (status === "skipped" || status === "folderBlocked" || status === "accessDenied") {
    return { status };
  }
  throw new Error("The host returned an unknown file save result");
}
