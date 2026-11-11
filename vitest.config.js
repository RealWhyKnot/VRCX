import { resolve } from "node:path";

import { defineConfig } from "vitest/config";

import vue from "@vitejs/plugin-vue";
import vueJsx from "@vitejs/plugin-vue-jsx";

export default defineConfig({
  plugins: [vue(), vueJsx()],
  define: {
    NIGHTLY: JSON.stringify(false),
    WINDOWS: JSON.stringify(true),
    LINUX: JSON.stringify(false),
  },
  test: {
    globals: false,
    testTimeout: 60_000,
    hookTimeout: 60_000,
    maxWorkers: 2,
    environment: "jsdom",
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/**/*.{test,spec}.ts"],
    coverage: {
      reporter: ["text", "text-summary"],
      exclude: [
        "src/public/**",
        "src/vr/**",
        "src/types/**",
        "src/styles/**",
        "src/ipc-electron/**",
        "src/localization/**",
        "src/lib/**",
        "src/components/ui/**/*.vue",
        "src/components/ui/**/index.ts",
      ],
    },
  },
  resolve: {
    alias: {
      "@": resolve(import.meta.dirname, "src"),
    },
  },
});
