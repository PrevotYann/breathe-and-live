// Stable document ids and in-game links for the one-shot. Ids are derived from
// readable keys so rebuilding the pack never changes them (Foundry keeps ids on
// Adventure import, which keeps the @UUID links in the journals valid).
import { createHash } from "node:crypto";

export const SLUG = "lanternes-hotaru";
export const ASSETS = `systems/breathe-and-live/assets/oneshot/${SLUG}`;

export function docId(key) {
  return createHash("sha1").update(`${SLUG}:${key}`).digest("hex").slice(0, 16);
}

export const link = {
  actor: (key, label) => `@UUID[Actor.${docId(`actor:${key}`)}]{${label}}`,
  item: (key, label) => `@UUID[Item.${docId(`item:${key}`)}]{${label}}`,
  scene: (key, label) => `@UUID[Scene.${docId(`scene:${key}`)}]{${label}}`,
  page: (journal, page, label) =>
    `@UUID[JournalEntry.${docId(`journal:${journal}`)}.JournalEntryPage.${docId(`page:${journal}:${page}`)}]{${label}}`,
};
