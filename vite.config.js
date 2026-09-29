import { resolve } from "node:path";
export default {
  esbuild: { keepNames: true },
  build: {
    sourcemap: true,
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      input: { "breathe-and-live": resolve("module/breathe-and-live.mjs") },
      output: { entryFileNames: "module/[name].mjs", format: "es" },
    },
  },
};
