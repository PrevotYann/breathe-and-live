# Four-actor combat audit — 2026-10-10

## Scope and implementation map

Use the French rulebook extraction `regles-physiques-v1.1.txt`, the local PDF,
the existing source audit, and the shipped compendium documents. Keep the
existing actor/item schemas; this repair requires no migration.

| Rulebook sections | Implementation |
| --- | --- |
| Stats, class resources and progression | `breathe-and-live.mjs`, `actor-derived-formulas.mjs` |
| Actions, initiative and reaction costs (p.20–22) | `combat-actions.mjs`, `action-engine.mjs`, `resource-costs.mjs` |
| Conditions, limb damage (p.27–30) | `condition-utils.mjs`, `action-engine.mjs`, `effects-engine.mjs` |
| Breaths, passives and advanced features | `use-technique.mjs`, `breath-effects.mjs`, `technique-utils.mjs` |
| Demonist healing (p.69–72), demon healing/regrowth | `action-engine.mjs`, `use-technique.mjs`, `regeneration.mjs` |
| Medicine, injury caps and death (p.98–107) | `action-engine.mjs`, `resource-costs.mjs`, `technique-utils.mjs` |
| Supplement delayed blood arts | `use-technique.mjs`, queued effects in `action-engine.mjs` |

Plan followed: establish the existing test baseline; create repeatable fights
from four compendium actors; reproduce failures; repair shared action/healing
paths; check the packaged system in an isolated Foundry 14.368 world.

## Actors and scenarios

- Renjiro, Flame Hashira: Nichirin katana and Flame passives.
- Aoi, Water Slayer: Nichirin katana, breath forms and bandages.
- Mika, Demonist marksman: trench rifle, blood points and healing ability.
- Shiori, playable Patchwork Demon: demon resources and limb regeneration.

The native QA fight temporarily grants Shiori a shipped delayed blood-art
example to exercise that workflow. This is a testing fixture, not a claim that
Patchwork grants another lineage's ability.

Deterministic simulations check pending chat damage, repeated card resolution,
temporary armor penalties and expiration, breath expenditure and RP dodge,
firearm ammunition, medical reaction costs and dose consumption, delayed
damage, regeneration, limb thresholds, charged weapons and interruption,
turn reservation, concurrent healing/damage, wound caps and recovery.
Human limb damage accumulates; demon limbs require the threshold in one hit.

## Repaired behavior

- Wait must be declared on the actor's turn with an action remaining.
- Shared action payment enforces condition restrictions, including recovery,
  medicine and reload paths that previously bypassed them.
- Demonist healing reactions check Red Blade before spending RP.
- Demon healing, Demonist healing reactions and healing ability items use
  serialized HP restoration, so concurrent incoming damage is preserved.
- Healing and full rest cannot reduce existing HP above a lowered wound cap.
- Delayed effects use `foundry.utils.randomID()` instead of a legacy global.
- Rest requires a positive finite duration between fights; it cannot revive
  actors at 0 HP or marked dead. Short rest preserves RP; eight hours restore RP.
- Demon healing chat reports the actual HP immediately before restoration.

## Validation and reproduction

- `npm test`: 95 tests pass, including ten four-actor scenarios.
- `npm run lint`: passes.
- `npm run build`: passes, including rulebook verification and pack compilation.
- `npm run test:v14`: passes in licensed Foundry 14.368; all 14 packs import,
  all 7 actor/25 item sheet types render, chat cards survive reload, and native
  reflection, medicine, conditions, movement, rest and regeneration work.
- `npm run test:combat:v14`: passes the native four-actor fight, damage/dodge,
  breath and firearm costs, delayed BDA, owner-turn conditions, limb regrowth,
  and short/long rests. It removes its own actors, scene and combat afterward.

Run native scripts against a **disposable world named `bl-v14-qa`**. Set
`FOUNDRY_QA_URL` when the server differs from `http://127.0.0.1:30144`.
The fight audit used a separate data directory and port 30145, preserving the
existing QA world and campaign directories.

## Limits

This is a targeted combat audit with regression coverage, not exhaustive proof
of every possible combination of forms, equipment and third-party modules.
The source verification still marks 34 of 140 forms as incomplete; missing
numeric data cannot be validated or executed faithfully until supplied.
Unspecified surgery DCs, regrowth durations, curse consequences and other
documented ambiguities still require explicit GM input. The regeneration test
duration is a QA choice, not a new rulebook value.

For a group's actual installation, also check simultaneous player/GM chat
interactions and module-specific token movement, permissions and lighting.
