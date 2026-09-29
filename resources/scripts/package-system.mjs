import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { compilePack, extractPack } from "@foundryvtt/foundryvtt-cli";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const output = path.join(root, "dist");
const staging = path.join(output, ".pack-sources");
const manifest = JSON.parse(fs.readFileSync(path.join(root, "system.json"), "utf8"));

// Vite builds the entry module; Foundry also needs the static assets and databases.
for (const entry of ["template.json", "templates", "styles", "lang", "assets", "resources/icons", "resources/macros", "LICENSE.txt"]) {
  fs.cpSync(path.join(root, entry), path.join(output, entry), { recursive: true });
}
// Preserve the public import path used by older technique macros.
fs.mkdirSync(path.join(output, "module"), { recursive: true });
fs.writeFileSync(path.join(output, "module/chat-technique.mjs"),
  "export const useTechnique = (...args) => game.system.api.useTechnique(...args);\n");

try {
  for (const pack of manifest.packs) {
    let source = path.join(root, "packs/_source", pack.name);
    if (pack.path.endsWith(".db")) {
      source = path.join(staging, pack.name);
      await extractPack(path.join(root, pack.path), source, { nedb: true, documentType: pack.type });
    }
    pack.path = `packs/${pack.name}`;
    await compilePack(source, path.join(output, pack.path), { recursive: true });
    console.log(`Packaged ${pack.name}`);
  }
  fs.writeFileSync(path.join(output, "system.json"), JSON.stringify(manifest, null, 2) + "\n");
} finally {
  const relative = path.relative(output, staging);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) throw new Error("Unsafe staging path");
  fs.rmSync(staging, { recursive: true, force: true });
}
