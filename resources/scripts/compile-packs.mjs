import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { compilePack } from "@foundryvtt/foundryvtt-cli";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..", "..");
const PACKS_ROOT = path.join(ROOT, "packs");
const PACK_SOURCE_ROOT = path.join(PACKS_ROOT, "_source");

function assertWorkspaceTarget(targetPath) {
  const resolvedRoot = path.resolve(ROOT);
  const resolvedTarget = path.resolve(targetPath);
  if (!resolvedTarget.startsWith(resolvedRoot)) {
    throw new Error(`Unsafe target path outside workspace: ${resolvedTarget}`);
  }
}

async function compileAllPacks() {
  if (!fs.existsSync(PACK_SOURCE_ROOT)) {
    throw new Error(`Pack source directory not found: ${PACK_SOURCE_ROOT}`);
  }

  const folders = fs
    .readdirSync(PACK_SOURCE_ROOT, { withFileTypes: true })
    .filter((entry) => entry.isDirectory());

  for (const folder of folders) {
    const src = path.join(PACK_SOURCE_ROOT, folder.name);
    const dest = path.join(PACKS_ROOT, folder.name);

    assertWorkspaceTarget(src);
    assertWorkspaceTarget(dest);

    if (fs.existsSync(dest)) {
      fs.rmSync(dest, { recursive: true, force: true });
    }

    console.log(`Compiling ${folder.name}...`);
    await compilePack(src, dest, { recursive: true, log: true });
  }
}

await compileAllPacks();
