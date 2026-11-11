import { resolve } from "node:path";

import { defineConfig } from "vite";

const root = import.meta.dirname;

export default defineConfig({
  root,
  publicDir: false,
  build: {
    ssr: true,
    target: "node24",
    outDir: resolve(root, "../build/main"),
    emptyOutDir: true,
    minify: false,
    rollupOptions: {
      input: {
        main: resolve(root, "main.ts"),
        preload: resolve(root, "preload.ts"),
      },
      external: ["electron"],
      output: {
        format: "cjs",
        entryFileNames: "[name].cjs",
        chunkFileNames: "[name].cjs",
      },
    },
  },
});
