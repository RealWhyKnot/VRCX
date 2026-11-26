import { execFile } from "node:child_process";
import { access } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

import { build } from "vite";

const run = promisify(execFile);
const BUILD_TIMEOUT_MS = 300000;

async function exists(file: string): Promise<boolean> {
  try {
    await access(file);
    return true;
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return false;
    }
    throw error;
  }
}

async function buildApp(root: string, outDir: string): Promise<void> {
  const vite = path.join(root, "node_modules/vite/bin/vite.js");
  await run(process.execPath, [vite, "build", "src", "--outDir", outDir, "--emptyOutDir", "--logLevel", "warn"], {
    cwd: root,
    windowsHide: true,
    timeout: BUILD_TIMEOUT_MS,
    maxBuffer: 64 * 1024 * 1024,
  });
}

async function resolveDist(root: string, requested: string | undefined): Promise<string> {
  if (requested !== undefined) {
    const dist = path.resolve(root, requested);
    if (!(await exists(path.join(dist, "index.html")))) {
      throw new Error(`No index.html in ${dist}; build the app first or drop --dist`);
    }
    return dist;
  }
  const dist = path.join(root, "build/page-check-html");
  await buildApp(root, dist);
  return dist;
}

async function bundleHost(root: string): Promise<string> {
  const output = await build({
    configFile: false,
    logLevel: "silent",
    root,
    build: {
      write: false,
      minify: false,
      target: "chrome145",
      lib: { entry: path.join(root, "build-scripts/page-check/host/index.ts"), formats: ["iife"], name: "pageCheckHost", fileName: () => "host.js" },
    },
  });
  const outputs = Array.isArray(output) ? output : [output];
  for (const result of outputs) {
    if ("output" in result) {
      const chunk = result.output.find((item) => item.type === "chunk");
      if (chunk?.type === "chunk") {
        return chunk.code;
      }
    }
  }
  throw new Error("The page-check host bundle produced no code");
}

export { bundleHost, resolveDist };
