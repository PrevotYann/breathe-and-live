# Actor palettes and Foundry cover

## Implementation plan and scope

1. Reuse the Actor templates and shared sheet styles; preserve document schemas and rules.
2. Identify the actual Actor type on the form so Companion and NPC Demon palettes work even though they share the NPC template.
3. Apply teal (Slayer), crimson (Demon), violet (Demonist), and amber (Companion) to the whole window, header, navigation, resource accents, and action controls. Human NPCs retain the neutral blue accent.
4. Add original cover artwork and the native Foundry manifest properties used by official systems.
5. Check contrast, narrow layouts, palette inheritance, and packaged asset paths.

The book's Slayer, Demonist, playable Demon, NPC, and Kasugai sections map to `module/sheets/actor-slayer-sheet.mjs` and `templates/actor/`. Presentation is in `styles/system.css`. No schema migration or rule calculation changes are needed.

## Cover configuration

`system.json` uses `media[type=setup]` for the system card and `background` for the default banner of newly created worlds. Both point to `systems/breathe-and-live/assets/art/system-cover.png`; the build copies the asset into the distributable. Existing worlds can select that path in their world configuration.

References: [Foundry v14 system background property](https://foundryvtt.com/api/v14/interfaces/foundry.packages.types._SystemManifestData.html), [official D&D5e manifest](https://github.com/foundryvtt/dnd5e/blob/6.0.x/system.json).

The original generated backdrop is intentionally text-free. **Pending input:** the supplied logo is currently a browser-local Google Docs blob URL, which cannot be retrieved from this workspace. Attach the original image to finish the requested logo composition. Do not recreate or substitute a guessed logo. The current cover is a backdrop draft until that composition is completed.

## Verification

`npm run test:sheets` checks the computed window palette for all Actor types as well as the existing navigation, form persistence, contrast, and narrow layout checks. It captures Companion and NPC Demon previews in addition to the main archetypes.

Verified on Foundry 14.368: all 32 sheet types and 258 tab/width checks pass. Lint, 39 automated tests, and the distributable build pass. All manifest cover paths exist in `dist/` and are served with HTTP 200 and an image content type by Foundry.

Manual setup check: install the packaged system, confirm the system card artwork, create a new world and confirm its default banner, then verify a deliberately customized world banner remains selected.
