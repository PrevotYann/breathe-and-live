# Manual QA Checklist

Use this when automated testing is not practical inside the Foundry runtime.

- Derived formulas
  - Create a slayer with `Courage 4`, `Vitesse 3`, `Intellect 2`.
  - Confirm Endurance becomes `24`, AC becomes `13`, RP becomes `10`.
  - Click each base stat button from a Slayer/Demonist/Demon sheet and confirm chat rolls `1d20 + stat - 1`.
  - Click several derived stat buttons and confirm chat rolls `1d20 + derived value`.
  - Open an older actor with accented or legacy derived keys such as `Puissance Brute`, `Dextérité`, `Médecine`, or `puissance_brute`; confirm values appear under the canonical derived stats and rolls use those values.
  - Open the same sheet with observer permission and confirm base/derived roll buttons still post chat rolls while inputs remain read-only.
  - Set Force to 6 and split more than 6 points across Force derived stats on a legacy actor; confirm the sheet displays `depassement`, then editing one field clamps it back to the shared Force budget.

- Character creation controls
  - On a Slayer or Demonist sheet, click `Table 0-5` and confirm the base stats are filled and `creation.statRolls` stores `0, 1, 2, 3, 4, 5`.
  - Click `Tirer 6d6` and confirm six values are stored in `creation.statRolls` and posted to chat.
  - Set sense/trait/breath-form creation points above 15 and confirm the sheet warns that the budget is exceeded.
  - Set trainer/partner/Kasugai axes above a total of 3 and confirm the sheet warns that the context budget is exceeded.
  - On a Slayer sheet, fill Kasugai name/type/commands, click `Creer / ouvrir Kasugai`, and confirm a `companion` actor is created, opened on second click, and linked through `system.support.companionActorId`.
  - Click `Equipement initial` on a Slayer and confirm katana, pistol, medical items and Kasugai whistle are imported once from compendiums.
  - Click `Equipement initial` on a Demonist and confirm trench gun, wakizashi and bandage are imported once from compendiums.

- Rank progression fields
  - Change actor rank on slayer, demonist and demon sheets.
  - Confirm the sheet keeps the selected rank and does not reset resources incorrectly.
  - Increase a Slayer/Demonist rank and confirm `skillSlots.max` and `skillSlots.value` gain +1 for each level gained.
  - Drag a progression feature whose required rank is too high and confirm the drop is refused.
  - Drag a progression feature without enough available skill slots and confirm the drop is refused.
  - Drag `Entrainement d'endurance`, `Amelioration de la sante`, `Entrainement cardio`, and `Formation medicale`; confirm slot cost is consumed and the matching resource/flag is applied.
  - Drag `TCB : Constant`, `Forme Marquee`, `Monde Transparent`, and `Lame Rouge`; confirm no skill slot is consumed and the matching unlock/advanced state is available.
  - Drag `Entrainement de Hashira` or `Victoire solo contre une Lune` and confirm a free skill slot is added.
  - On a demon sheet, confirm the rank change opens a confirmation dialog, updates level automatically, and refreshes the benchmark block to the new rank.
  - Confirm a demon rank increase adds the expected fixed stat package delta and unlocks `Infecter` / `Executer` only at the correct ranks.
  - On a demon or npcDemon sheet, choose body/movement/danger options totaling 3 points or less, click `Appliquer creation demon`, assign `0,1,2,3,3,5`, and confirm body HP, movement, danger damage, rank package stats, PV/CA/RP/BDP and actions per turn update.
  - Try demon creation choices totaling more than 3 points and confirm the assistant refuses to apply them.
  - On a demon of sufficient rank, use `Guerison`, `Repousse`, `Purification`, `Infecter`, `SOS` and `Executer`; confirm BDP costs, limb recovery, poison stack removal, infection flag, bloodline chat, and execution reactions.
  - Use demon `Bloquer` and `Esquiver`; confirm each spends 1 RP, creates a prepared defense button on the next incoming attack card, and consumes that defense to cancel damage.

- Endurance spend and recovery
  - Use a breath technique with `costE > 0`.
  - Confirm Endurance decreases.
  - Use `Souffle de recuperation`.
  - Confirm Endurance increases and `mustRest` clears.
  - Toggle `TCB actif` and confirm `Souffle de recuperation` is refused without restoring Endurance.
  - Toggle `TCB : Constant` plus `Saignement`, then use `Souffle de recuperation` and confirm the bleeding condition is cleared.

- RP logic
  - Use a reaction button from a technique chat card.
  - Confirm RP decreases by 1 and damage is cancelled.
  - Use `Riposte 1 RP` and confirm RP decreases by 1 before a normal basic attack.
  - Use `Coup assure 2 RP` and confirm RP decreases by 2 and the basic attack skips the attack roll.
  - Use `Degainage 1 RP` and confirm it only spends RP and posts the weapon-swap note.
  - Use `Degainage+attaque 2 RP` and confirm it spends RP then starts a basic attack.
  - Use `Assistance` and confirm a chat card posts threat/message details.
  - Use `Kakushi` and confirm a chat card posts requested item, quantity, and delivery note.

- Basic attacks
  - Attack with a melee weapon.
  - Confirm the sheet asks whether Force or Finesse is used to hit, and the other stat is shown as the damage stat.
  - Attack with a firearm.
  - Confirm the attack uses Finesse to hit, Precision to damage, spends 1 loaded ammunition, and refuses to fire at 0 loaded ammunition.
  - Click the reload button on a firearm and confirm `system.ammo.value` returns to `system.ammo.max`.
  - Confirm both show the attack roll and damage roll in chat.
  - Confirm both expose reaction buttons in chat before target HP is updated.
  - Click `Eviter sans RP`; on success confirm damage is cancelled, on failure confirm RP reaction buttons become disabled for that attack.
  - Confirm `Esquiver (1 RP)` cancels damage and spends 1 RP.
  - Confirm `Prendre les degats` applies the rolled damage and updates target HP.

- Item schemas
  - Create one item of each type: `weapon`, `firearm`, `projectile`, `explosive`, `ammunition`, `modification`.
  - Confirm weapons/firearms/projectiles/explosives open on the weapon sheet, expose `sourceSection`, and appear in the actor weapon list.
  - Confirm an `explosive` item exposes radius/save fields and a `projectile` item exposes the recoverable flag.
  - Confirm a `modification` item opens on the generic item sheet and exposes weapon-modifier fields.
  - Open `items-weapons` and confirm base/alternative weapons include curved blade, serrated blades, Nichirin mace/whip/double chain, Odachi, Naginata, Cimeterre, Patta and Epee crochet; TBD alternatives must display `TODO-RULEBOOK-AMBIGUITY` notes.
  - Import bow, crossbow, shuriken, wisteria kunai, grenade, Molotov, bomb and flamethrower and confirm projectile/explosive/firearm sheets expose the expected range/radius/save/ammo fields.
  - Open `items-weapons` and confirm Mauser C96, Nambu Type 14, Colt M1911, Type 38 Arisaka, Winchester 1895, Mauser 98k, ammunition, and weapon modifications import without schema warnings.
  - Create a `craftingRecipe` item and confirm the generic sheet exposes component count, DD, stat, result and failure fields.
  - Create a clothing/outfit item with `equipped` and `armorBonus`, add it to an actor, and confirm CA increases only while it is equipped.
  - Add a transport to an actor and confirm the relaxed/danger driving buttons post Finesse/Reflexes checks with editable DDs.

- Crafting
  - Use `Recette - remede anti-poison` from `items-medical-utility`.
  - Confirm the dialog uses 3 components / DD 8 and lets the GM change the derived stat.
  - Confirm the chat card reports success or failure without silently creating an item.

- Custom breath builder
  - Open `Calculateur souffle maison` from a Slayer or Demonist sheet.
  - Select damage/range/effect values and create the technique.
  - Confirm the created item has `sourceSection: Creation de souffle personnalise`, calculated `costE`, damage, range, tags, and automation flags.

- Technique prerequisites
  - Create or edit a technique with `prerequisites.sense`, `prerequisites.trait`, or `prerequisites.weapon`.
  - Drag it to an actor missing that requirement and confirm the drop is refused with a clear warning.
  - Add the matching sense/feature/weapon item and confirm the technique can be added.

- Marked / red blade interactions
  - Activate `Forme Marquee` and use a breath technique.
  - Confirm the higher of the two damage rolls is used.
  - Activate `Lame Rouge` against a demon target.
  - Confirm damage is doubled.

- Status application/removal
  - Toggle `Brulure`, `Saignement`, and `Enfume`.
  - Advance combat turns.
  - Confirm turn-start damage or endurance loss occurs.
  - Use bandages on a bleeding actor and confirm the status clears.

- Limb injury thresholds
  - Make a basic attack and choose a targeted limb before rolling.
  - Against a human target, hit the same limb across multiple attacks and confirm `system.combat.injuries.targetedDamage.<limb>` accumulates.
  - Against a demon target, confirm only the single-hit damage is checked against the mutilation threshold.
  - Confirm arms/legs use a 20% HP threshold, while demon appendages such as wings/tail/tentacles use a 10% threshold.
  - Mark a leg broken or severed and confirm effective movement is halved and sprint uses the effective movement.
  - On a demon, mark wings severed and confirm the sheet displays `vol impossible`; mark tail/tentacles and confirm effective movement drops.
  - On a demon, use `Repousse` and confirm limb flags, notes, and targeted damage counters clear.
  - Toggle limb injury, broken and severed flags on a test actor.
  - Confirm they remain visible on the sheet and survive reopen/reload.
  - Deal 13-19 damage in one hit and confirm `severeWounds` increases by 1 and `healableMax` drops by 10%.
  - Deal 20+ damage in one hit and confirm `nearDeathWounds` increases by 1 and `healableMax` drops by 10%.

- Medical workflows
  - Use `Bandage`, `Trousse de premiers secours`, and `Equipement chirurgical`.
  - Confirm healing applies and caps at `healableMax`.
  - Use a surgical/doctor `maxHeal` item and confirm severe/near-death wound counters reset and `healableMax` returns to HP max.
  - Use a `food` item with `enduranceGain: 5` and confirm Endurance recovers up to max.
  - Use a `food` or `consumable` item with `temporaryEndurance` checked and confirm `system.resources.e.temporary` and current Endurance increase.

- Death workflow
  - Deal damage that brings an actor to 0 PV and confirm `system.death.state` becomes `dead`.
  - Enable `standingDeath`, deal damage to 0 PV, and confirm the state becomes `critical` instead of `dead`.
  - Use demon `Executer` on a human at 5 PV or less, click `Executer`, and confirm the target PV drop to 0 also updates the death state.

- Demonist BDP gain/spend
  - Use a demonist or demon ability with `costBdp`.
  - Confirm BDP decreases and the action still resolves.
  - Confirm a demonist's BDP max is `10 + Courage`, while a demon/npcDemon BDP max remains `10 x Courage`.
  - Consume demon flesh and confirm `system.support.recentDemonFleshRank` stores the selected rank.
  - Use a demonist item with `costBdp` and `demonisationGain`; confirm demonisation increases, then confirm Medecine Active Demoniste halves the gain.
  - Use Medecine de Reparation Demoniste and confirm current demonisation is halved.
  - Advance world time by 1 hour and confirm demonisation decreases by 2; use rest and confirm demonisation resets to 0.
  - Use Soin demoniste 1 RP and Soin max 2 RP; confirm the heal formula follows the recent demon flesh rank.
  - Use Amelioration RP and confirm Force/Vitesse temporary effects expire at round end.
  - Use `Expulsion` and confirm PV are reduced by half base HP and current demonisation is halved.
  - Use `Seringue de sang demon` and `Analgesiques`; confirm the first heals PV and the second grants temporary Endurance.

- Compendium importability
  - Open each listed system pack in Foundry.
  - Confirm entries display without missing-type warnings.
  - Toggle `Activer le supplement 1934` in system settings and confirm open actor/item sheets re-render.
  - Open a 1934-tagged item or supplement pack entry and confirm it displays the `Supplement 1934` optional badge/checkbox.

- Sheet rendering
  - Open each actor type: `slayer`, `demonist`, `demon`, `npcHuman`, `npcDemon`, `companion`.
  - Confirm no missing-field errors appear in console.
