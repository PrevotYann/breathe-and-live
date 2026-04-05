# Manual QA Checklist

Use this when automated testing is not practical inside the Foundry runtime.

- Derived formulas
  - Create a slayer with `Courage 4`, `Vitesse 3`, `Intellect 2`.
  - Confirm Endurance becomes `24`, AC becomes `13`, RP becomes `10`.

- Rank progression fields
  - Change actor rank on slayer, demonist and demon sheets.
  - Confirm the sheet keeps the selected rank and does not reset resources incorrectly.

- Endurance spend and recovery
  - Use a breath technique with `costE > 0`.
  - Confirm Endurance decreases.
  - Use `Souffle de recuperation`.
  - Confirm Endurance increases and `mustRest` clears.

- RP logic
  - Use a reaction button from a technique chat card.
  - Confirm RP decreases by 1 and damage is cancelled.

- Basic attacks
  - Attack with a melee weapon.
  - Attack with a firearm.
  - Confirm both show the attack roll and damage roll in chat.
  - Confirm both expose reaction buttons in chat before target HP is updated.
  - Confirm `Esquiver (1 RP)` cancels damage and spends 1 RP.
  - Confirm `Prendre les degats` applies the rolled damage and updates target HP.

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
  - Toggle limb injury, broken and severed flags on a test actor.
  - Confirm they remain visible on the sheet and survive reopen/reload.

- Medical workflows
  - Use `Bandage`, `Trousse de premiers secours`, and `Equipement chirurgical`.
  - Confirm healing applies and caps at `healableMax`.

- Demonist BDP gain/spend
  - Use a demonist or demon ability with `costBdp`.
  - Confirm BDP decreases and the action still resolves.

- Compendium importability
  - Open each listed system pack in Foundry.
  - Confirm entries display without missing-type warnings.

- Sheet rendering
  - Open each actor type: `slayer`, `demonist`, `demon`, `npcHuman`, `npcDemon`, `companion`.
  - Confirm no missing-field errors appear in console.
