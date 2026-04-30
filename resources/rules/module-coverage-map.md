# Module Coverage Map

This file maps the rulebook sections from `AGENTS.md` and `resources/rules/regles-physiques-v1.1.txt`
to the current repository modules so missing coverage stays explicit.

## Core runtime

- `module/breathe-and-live.mjs`
  - system init and sheet registration
  - actor derived data
  - advanced states, condition registry, limb registry
  - supplement 1934 world setting

- `module/rules/action-engine.mjs`
  - base attacks
  - recovery breath
  - sprint / wait / rest refresh
  - medical item usage
  - turn-start condition processing

- `module/rules/breath-effects.mjs`
  - breath passives and damage modifiers
  - red blade / marked form integration

- `module/rules/effects-engine.mjs`
  - temporary effect storage and expiry

## Sheets

- `module/sheets/actor-slayer-sheet.mjs`
  - slayer, demonist, demon, npc and companion sheet controller
  - searchable techniques
  - quick combat actions
  - visible condition and limb state data

- `templates/actor/*.hbs`
  - per-archetype sheet layouts

- `templates/item/*.hbs`
  - weapon, technique, breath and generic item editors

## Rulebook domains

- Character creation, trainer/partner/Kasugai context
  - stored on actor `system.profile.*` and `system.creation.*`

- Derived stats and explicit formulas
  - `module/breathe-and-live.mjs`
  - Endurance = `20 + Courage`
  - AC = `10 + Vitesse`
  - RP = `5 + Vitesse + Intellect`

- Combat economy, base attacks, recovery breath, reaction items
  - `module/rules/action-engine.mjs`
  - `module/chat/use-technique.mjs`

- Status effects and mutilation
  - `module/config/rule-data.mjs`
  - `module/rules/action-engine.mjs`
  - sheet condition/limb editors

- Breathing styles and breath tech metadata
  - `module/rules/breath-effects.mjs`
  - `packs/techniques-breaths.db`
  - `resources/souffles/*.json`

- Slayer / demonist / demon progression hooks
  - actor schema in `template.json`
  - compendium examples in `packs/*.db`
  - Demonist BDP capacity uses `10 + Courage`; playable demons use `10 x Courage`
  - Demonist BDP spend can add item-driven `demonisationGain`; Medecine Active Demoniste halves that accumulation, Medecine de Reparation Demoniste halves current demonisation, long rest resets it, and world-time decay removes 2 demonisation per hour.
  - Demonist healing and enhancement reactions are executable from the demonist sheet using the recently consumed demon rank.

- Medical equipment, clothing, food, transport
  - item schema in `template.json`
  - example packs in `packs/items-medical-utility.db`

- 1934 supplement
  - world setting in `module/breathe-and-live.mjs`
  - example pack in `packs/supplement-1934.db`

## Known gaps

- Several homebrew / supplement breath passives still need full numeric extraction from the PDF or detailed forms sheet.
- Demon rank changes now apply the fixed rank package and benchmark refresh from the rulebook, but several 1934 bloodline trees remain only partially extractible from the text export.
- Shared demon actions such as healing, regrowth, execution and infection are now automated; the remaining gap is mostly the numeric extraction of additional 1934 bloodline trees.
- Sheet-side guided character creation wizard is not yet implemented; schema and examples are in place first.
- TODO-RULEBOOK-AMBIGUITY: Demonist enhancement reaction duration is not explicit in the PDF; automation applies it until round end through temporary effects.
