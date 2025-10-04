import { resolve } from "node:path";
export default {
  build: {
    sourcemap: true,
    outDir: ".",
    emptyOutDir: false,
    rollupOptions: {
      input: { "module/breathe-live": resolve("src/breathe-live.ts") },
      output: { entryFileNames: "module/[name].mjs", format: "es" },
    },
  },
};
