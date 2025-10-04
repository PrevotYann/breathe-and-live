import { resolve } from "node:path";
export default {
  build: {
    sourcemap: true,
    outDir: ".",
    emptyOutDir: false,
    rollupOptions: {
      input: { "module/breathe-and-live": resolve("src/breathe-and-live.ts") },
      output: { entryFileNames: "module/[name].mjs", format: "es" },
    },
  },
};
