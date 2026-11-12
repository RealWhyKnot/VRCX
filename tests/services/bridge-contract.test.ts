import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import { describe, expect, test } from "vitest";

const ROOT = path.resolve(import.meta.dirname, "../..");

const BOUND_SOURCES = {
  AppApi: ["src/VRCX-Shared/AppApi", "src/VRCX-Cef/AppApi", "src/VRCX-Electron/AppApi", "src/VRCX-Shared/AppApi.Bridge.cs"],
  WebApi: ["src/VRCX-Shared/WebApi.cs"],
  VRCXStorage: ["src/VRCX-Shared/VRCXStorage.cs"],
  DatabaseApi: ["src/VRCX-Shared/Database"],
  LogWatcher: ["src/VRCX-Shared/LogWatcher.cs", "src/VRCX-Shared/LogWatcher.Events.cs", "src/VRCX-Shared/LogWatcher.Media.cs"],
  Discord: ["src/VRCX-Shared/Discord.cs"],
  AssetBundleManager: ["src/VRCX-Shared/AssetBundleManager.cs"],
} as const satisfies Record<string, readonly string[]>;

const FRONTEND_ONLY = new Set(["VRCXStorage.GetArray"]);
const SKIPPED_FOLDERS = new Set(["obj", "bin", "node_modules", "VRCX-Cef", "VRCX-Electron", "VRCX-Shared", "DBMerger"]);
const PUBLIC_METHOD = /public\s+(?:(?:static|override|virtual|abstract|async|new|sealed)\s+)*[\w<>[\],.? ()]+?\s+(\w+)\s*\(/g;
const ASYNC_SUFFIX = "Async";

function listFiles(target: string, extensions: readonly string[], skipped: ReadonlySet<string>): string[] {
  const full = path.resolve(ROOT, target);
  if (statSync(full).isFile()) {
    return [full];
  }
  return readdirSync(full, { withFileTypes: true }).flatMap((entry) => {
    const child = path.join(target, entry.name);
    if (entry.isDirectory()) {
      return skipped.has(entry.name) ? [] : listFiles(child, extensions, skipped);
    }
    return extensions.some((extension) => entry.name.endsWith(extension)) ? [path.resolve(ROOT, child)] : [];
  });
}

function bridgedNames(sources: readonly string[]): Set<string> {
  const names = new Set<string>();
  for (const source of sources) {
    for (const file of listFiles(source, [".cs"], new Set(["obj", "bin"]))) {
      for (const match of readFileSync(file, "utf8").matchAll(PUBLIC_METHOD)) {
        const name = match[1] ?? "";
        names.add(name.endsWith(ASYNC_SUFFIX) ? name.slice(0, -ASYNC_SUFFIX.length) : name);
      }
    }
  }
  return names;
}

describe("host bridge", () => {
  test("every bridged call in the frontend exists on the C# side", () => {
    const available = new Map(Object.entries(BOUND_SOURCES).map(([name, sources]) => [name, bridgedNames(sources)]));
    const call = new RegExp(String.raw`\b(${Object.keys(BOUND_SOURCES).join("|")})\.([A-Z]\w*)\s*\(`, "g");
    const missing = new Set<string>();
    for (const file of listFiles("src", [".ts", ".vue"], SKIPPED_FOLDERS)) {
      for (const match of readFileSync(file, "utf8").matchAll(call)) {
        const key = `${match[1] ?? ""}.${match[2] ?? ""}`;
        if (!FRONTEND_ONLY.has(key) && !available.get(match[1] ?? "")?.has(match[2] ?? "")) {
          missing.add(key);
        }
      }
    }
    expect([...missing].sort()).toEqual([]);
  });

  test("the bridge exposes Execute for web requests", () => {
    expect(bridgedNames(BOUND_SOURCES.WebApi).has("Execute")).toBe(true);
  });
});
