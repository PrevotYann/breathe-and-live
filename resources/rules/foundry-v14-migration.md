# Foundry V14 upgrade

System release: **0.2.0**. Target: **Foundry VTT 14.368** (Node.js 24 for a standalone server).

## Install

1. Back up the V12 world before opening it in V14. Foundry's core world migration cannot be undone by reinstalling the old system.
2. Run `npm install` and `npm run build`.
3. With Foundry stopped, copy the contents of `dist/` into `Data/systems/breathe-and-live/`.
4. Start Foundry 14.368 and launch a copy of the world as GM. Allow Foundry's migration and the existing system migration to finish, then reload once.
5. Check character resources and embedded items, open a breathing technique, and resolve an attack and reaction in chat. Enable the 1934 world setting when applicable.

`dist/` is the installable package, including the manifest, templates, artwork, macros, and all 14 LevelDB compendiums. The repository's `.db` files remain editable source data; release packages do not require a legacy NeDB conversion.

## Compatibility decisions

- Preserve the system ID, all 7 actor types, all 25 item types, and existing `system.*` data paths. No actor, embedded item, resource, progression, condition, or injury schema reset is performed.
- Register `BLActor` during `init`, before Foundry constructs world collections. Registering it during `setup` caused actors loaded from disk to use the wrong class and fail subsequent updates.
- Use namespaced sheet registration and template loading. Preserve class names in the bundled build so saved sheet selections still resolve.
- Use `renderChatMessageHTML` with its native element argument; adapt that element for existing reaction listeners. Damage, dodge, ownership checks, socket authority, and persisted card state use the same rules engine.
- Use asynchronous `Roll.evaluate()` without obsolete options. The legacy `module/chat-technique.mjs` import forwards to the shared technique engine.
- Mist areas use V14 Regions, associated with the target's scene level. The 3 m radius uses the system's existing 1.5 m per square convention.
- Repair invalid hand-authored compendium IDs deterministically and align breathing-form database keys with those IDs. Every already-valid ID is retained. Pack item references are updated together; world actor/item IDs are untouched. Old links using an invalid compendium ID need to be recreated from the corrected pack.

The existing `template.json` schema and Application V1 sheets are deliberately retained, both supported by V14. Foundry can report their deprecation. Moving them to TypeDataModel/Application V2 is a separate future migration; it is not required for V14 play.

## Rules-to-code scope

The full mapping remains in `module-coverage-map.md`. This upgrade covers its existing domains:

| Domain | Modules checked |
| --- | --- |
| Actor resources, progression, creation | `breathe-and-live.mjs`, `actor-derived-formulas.mjs`, actor sheets |
| Attacks, firearms, reactions, medicine, rest | `action-engine.mjs`, `persistent-cards.mjs`, `reaction-card.mjs` |
| Breaths, subclasses, blood arts | `use-technique.mjs`, `breath-effects.mjs`, technique/breath sheets |
| Conditions, injuries, timed effects | `condition-utils.mjs`, `effects-engine.mjs`, `round-engine.mjs` |
| Equipment and 1934 content | Item sheets, existing supplement setting, all compendiums |

No rulebook numeric values are changed by this upgrade.

## Validation

Run `npm test`, `npm run validate:packs`, `npm run verify:ready`, `npm run lint`, and `npm run build`.

For real browser validation, run a licensed Foundry 14.368 server with a **disposable** world whose ID is `bl-v14-qa`, an unpassworded `Gamemaster` user, and the built system installed. Run `npm run test:v14`. It refuses other world IDs, creates test documents, and leaves them available for inspection. It never accesses a campaign world.

- `FOUNDRY_QA_URL` overrides `http://127.0.0.1:30144`.
- On Windows the runner uses installed Edge. Elsewhere install Playwright Chromium with `npx playwright install chromium`, or set `FOUNDRY_QA_BROWSER` to a browser executable.
- The suite checks complete pack imports, every sheet type, reload of saved actors, attacks, breath costs, damage and dodge, mist Regions, medicine, conditions, limb movement penalties, rests, stat rolls, and persisted chat resolution.
- Multiplayer authority, insufficient resources, temporary effects, and turn processing are additionally covered by `tests/regressions.test.mjs`.

After regenerating compendium sources, run `npm run repair:pack-ids`, `npm run build:packs`, and `npm test` before building a release. The ID repair is repeatable and leaves valid IDs unchanged.

This validation covers an isolated V14 world and bundled examples. Campaign-specific modules, custom macros, and privately edited content still need the checks in `manual-qa-checklist.md` on the backed-up world.
