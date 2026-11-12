import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { expect, test } from "vitest";

const SOURCE = path.resolve(import.meta.dirname, "../../src");
const SKIPPED_FOLDERS = new Set(["obj", "bin", "VRCX-Cef", "VRCX-Electron", "VRCX-Shared", "DBMerger"]);
const LEAKING_GLOBAL = /[^\s{},][ \t]+:global\(/;

function vueFiles(folder: string): string[] {
  return readdirSync(folder, { withFileTypes: true }).flatMap((entry) => {
    const child = path.join(folder, entry.name);
    if (entry.isDirectory()) {
      return SKIPPED_FOLDERS.has(entry.name) ? [] : vueFiles(child);
    }
    return entry.name.endsWith(".vue") ? [child] : [];
  });
}

test("scoped styles never put :global() after another selector", () => {
  const leaking = vueFiles(SOURCE).filter((file) => LEAKING_GLOBAL.test(readFileSync(file, "utf8")));
  expect(leaking.map((file) => path.relative(SOURCE, file))).toEqual([]);
});
