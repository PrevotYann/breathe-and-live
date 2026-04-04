# AGENTS.md

## Mission

Build a complete **Foundry VTT system for v12.343** for the **Demon Slayer / Kimetsu no Yaiba** universe, using the uploaded French rulebook **[FR] Breathe and Live-1.pdf** as the primary rules source.

The system must cover the full playable scope of the rulebook, not just the basics. The book includes character creation, core dice rules, HP/AC/endurance/reaction points, base and derived stats, sensory abilities, superhuman traits, human actions, reaction-point actions, base attacks, combat economy, status effects, limb mutilation, Demon Slayer class progression, many breathing styles, homebrew breathing styles, create-your-own breathing rules, slayer subclasses, demonist class and demonization points, progression, TCB constant, Marked Form, Transparent World, Red Blade, tools and objects, medical systems, transport, clothing, food, death, playable demons, and a 1934 supplement. fileciteturn0file0

The system must support the three starting archetypes described by the book:
- **Pourfendeur de démons / Slayer**
- **Démoniste / Demonist**, which consumes demon flesh and uses blood demon points.
- **Démon / Demon**

## Non-negotiable goals

1. **Implement the rules from the book faithfully.**
   - Do not replace mechanics with generic d20 assumptions when the book gives a specific rule.
   - Prefer explicit data-driven implementation over hardcoded one-off logic.
   - Preserve the book’s terminology where practical, especially for French-facing content.

2. **Cover the whole rulebook.**
   - Do not stop after actor sheets and one class.
   - Continue until the system covers the book sections listed in the table of contents, including classes, breaths, subclasses, items, medical content, playable demons, and the supplement. fileciteturn0file0

3. **Make it usable in Foundry.**
   - Character creation and progression must be playable in Foundry, not just stored as notes.
   - Combat-facing mechanics must be executable from sheets/chat/actions.
   - Compendiums must ship with meaningful example content.

4. **Generate visual assets for sheets when needed.**
   - The system should include improved player-facing sheet visuals and additional sheet artwork/backgrounds/icons when they materially improve usability.
   - Use generated images only when they are cohesive with the project and legally safe.

## Rules-source policy

Treat the uploaded French rulebook as the **authoritative source** for mechanics.

When the book is ambiguous:
1. Search the repository for prior implementation notes or data.
2. Compare nearby passages in the same rulebook section.
3. Leave a short `TODO-RULEBOOK-AMBIGUITY:` note in code or docs.
4. Choose the **least destructive, most reversible** implementation.
5. Do **not** invent missing mechanics silently.

If the rulebook references data that is clearly external (for example the detailed forms sheet linked from the book), do not fabricate hidden values. Instead:
- implement the framework,
- import whatever is available in the repository,
- annotate the missing dataset,
- keep the system ready for later data ingestion. 

## Expected system scope

Implement at minimum:

### 1. Core data model
Support actor/item/document types needed for:
- **PC Slayer**
- **PC Demonist**
- **PC Demon**
- NPC humans
- NPC demons
- Kasugai crow / companion creature
- weapons
- firearms
- breath techniques
- subclass techniques
- demon abilities / blood arts
- medical items
- consumables
- clothing
- transport
- utilities / mission gear

### 2. Core stats and derived resources
Implement the book’s main stat framework:
- 6 base stats
- derived stats
- HP
- AC
- Endurance
- Reaction Points
- rank / level progression
- study slots / learning slots where applicable
- blood demon points for Demonists
- demon resources for playable demons where needed 

Respect explicit formulas from the book, such as:
- Endurance = `20 + Courage`
- AC = `10 + Vitesse`
- starting Reaction Points = `5 + Vitesse + Intellect` 

### 3. Character creation
Support complete creation flows for:
- Slayer
- Demonist
- Demon

Include:
- base stat assignment methods
- derived stat allocation
- trainer background
- partner / Kasugai crow background
- starting points for extrasensory abilities, breath forms, and superhuman traits
- starting equipment by class 

### 4. Combat engine support
Implement:
- basic attacks
- action economy
- movement
- sprint
- wait
- dodge/evade logic
- reaction point usage
- weapon swapping
- medical reactions
- demonist healing reaction
- recovery breath / stamina recovery
- auto-hit handling for breath techniques where specified
- RP refresh on rest only where specified 

### 5. Status and injury systems
Implement the combat effects listed by the book, including where relevant:
- burn
- bleed
- freeze
- fury
- slowed
- sadness
- imprisoned
- off-balance
- paralyzed
- controlled
- poisoned
- charmed
- blinded
- deafened
- anosmia
- paresthesia
- ageusia
- smoked
- cursed

Also implement limb targeting / mutilation rules for humans and demons. 

### 6. Breath techniques
Implement all breathing families explicitly present in the book:
- Sun
- Moon
- Flame
- Water
- Wind
- Thunder
- Stone
- Flower
- Mist
- Serpent
- Sound
- Insect
- Love
- Beast
- Ocean
- West
- Snow
- custom-breath construction support fileciteturn0file0

For each breath style, support:
- prerequisites
- required senses/traits/weapons
- special passive
- all named forms available in the book data
- stamina/endurance usage
- range
- damage
- special flags such as AoE, anti-friendly-fire, mobility, decapitation relevance, etc.

### 7. Classes and progression
Implement:
- Slayer rank progression through Hashira
- Demonist progression
- slayer subclasses
- demonist subclasses
- TCB / Total Concentration Breathing constant
- Marked Form
- Transparent World
- Red Blade
- playable Demon class progression and capabilities
- 1934 supplement content as a toggle/module layer if the supplement changes or adds options fileciteturn0file0

### 8. Inventory and support systems
Implement item categories and usable effects for:
- weapons and ammunition
- healing and medical gear
- tools and utility objects
- transport
- clothing
- food
- mission-requested items / Kakushi delivery style workflows if practical
- death and severe injury support rules fileciteturn0file0

## Foundry implementation preferences

### Architecture
- Prefer **data-driven JSON/TS structures** for techniques, items, effects, and progression tables.
- Keep calculations centralized in reusable utilities.
- Avoid duplicating formulas across sheets, item logic, and chat cards.
- Keep migration-safe schemas for actor and item system data.

### Sheet design
Create polished sheets for:
- Slayer PC
- Demonist PC
- Demon PC
- NPC Demon
- NPC Human
- item/technique sheets

Sheet priorities:
- fast combat use,
- visible resources,
- clear rank/progression,
- one-click technique execution,
- readable prerequisite display,
- good mobile-ish scaling inside Foundry popouts.

### UX requirements
- Show core resources prominently: HP, AC, Endurance, RP, rank, class, weapon.
- Breath techniques must be searchable/filterable.
- Statuses and limb injuries must be visible without opening nested dialogs.
- Derived stats should not require manual recalculation unless explicitly intended.
- Chat cards should explain what happened in plain language.

## Compendium requirements

Create example compendiums covering the full game loop.

### Mandatory compendium packs
1. **Actors - Slayers**
   - at least 3 example Slayer PCs/NPCs
   - cover different breaths and weapon setups

2. **Actors - Demonists**
   - at least 2 example Demonists
   - include consumed-flesh / BDP-related setup examples

3. **Actors - Demons**
   - at least 4 example demons across threat bands
   - include at least one example suitable for mutilation/regeneration testing

4. **Items - Weapons**
   - Nichirin variants
   - firearms
   - special weapon families tied to breath styles

5. **Items - Medical & Utility**
   - bandages
   - compressive dressing
   - splint
   - first aid kit
   - surgical equipment
   - demon blood healing items
   - painkillers
   - clothing / food / transport examples where useful fileciteturn1file1turn1file2

6. **Techniques - Breaths**
   - representative entries for every breath family
   - full entries when data is available

7. **Techniques - Subclasses**
   - slayer subclass features
   - demonist subclass features

8. **Abilities - Demons**
   - blood art / demon power examples
   - regeneration / body-part interactions if supported

### Compendium content standard
Each compendium entry should include:
- localized name
- source section
- concise rules text
- structured mechanical fields
- tags
- prerequisites
- example usage note if the mechanic is easy to misuse

Do not create empty placeholder compendium entries unless clearly labeled.

## Image-generation policy

The agent is allowed and expected to generate some images for the system, especially for:
- improved character sheet backgrounds
- class-themed header art
- subtle section icons
- breath-style insignias
- decorative but readable UI frames
- item card art when absent and beneficial

### Image rules
- Keep the visual style cohesive with Demon Slayer themes while remaining distinct enough for a fan system.
- Favor **clean readability over spectacle**.
- Avoid text baked into images unless unavoidable.
- Prefer layered/UI-friendly assets: transparent PNGs where useful.
- Avoid making assets that look like exact traced manga panels or copyrighted scans.
- Never block progress on implementation waiting for art.

### Image output expectations
When generating sheet art, produce assets for:
- Slayer sheet theme
- Demonist sheet theme
- Demon sheet theme
- neutral NPC sheet theme
- optional breath-style badge set

## Coding standards

- Use TypeScript where the project already uses TypeScript.
- Follow the repository’s linting, formatting, and build setup.
- Keep localization externalized where practical.
- Prefer French-facing labels if the project target is francophone, but avoid hardcoding text in logic.
- Write small migration scripts for schema changes.
- Add comments only where they reduce ambiguity.

## Testing requirements

Create or maintain tests/checklists for:
- actor derived-stat recalculation
- rank progression updates
- endurance spending and recovery
- RP spend logic
- auto-hit breath logic versus dodge/reaction exceptions
- status application/removal
- limb injury thresholds
- item healing workflows
- demonist BDP gain/spend
- importability of compendium content
- sheet rendering without missing data

If automated tests are not practical for a mechanic, add a manual QA checklist entry.

## Delivery order

Work in this order unless the repository structure strongly suggests another order:

1. Inspect repository structure and current Foundry setup.
2. Define actor/item schemas.
3. Implement derived calculations and shared utilities.
4. Build minimal working sheets.
5. Implement core combat and resource logic.
6. Implement Slayer class + breath framework.
7. Add breath style data.
8. Implement Demonist systems.
9. Implement Demon playable systems.
10. Implement items, medicine, transport, clothing, food.
11. Add subclasses, high-tier features, and supplement content.
12. Create compendiums.
13. Polish sheets and generate supporting images.
14. Run QA and write migration/import notes.

## Definition of done

The task is done only when:
- the Foundry system runs on **v12.343**,
- the main classes are playable,
- breath techniques are usable,
- compendiums exist for slayers, demonists, demons, items, attacks, breaths, and techniques,
- the high-tier mechanics are represented,
- medical/support items work,
- sheet visuals are improved,
- missing rule data is explicitly documented rather than silently skipped.

## Do not

- Do not rewrite the project into another game system.
- Do not flatten the rules into generic D&D-like mechanics.
- Do not omit Demonist or playable Demon support.
- Do not skip homebrew breaths or the 1934 supplement.
- Do not invent missing numeric values without marking them.
- Do not leave compendiums empty.
- Do not make the sheet pretty but mechanically hollow.

## First action

Before making major edits:
1. scan the repo,
2. identify current system entry points,
3. create a short implementation plan,
4. map rulebook sections to code modules,
5. then start with the data schema.

