const normalize = value => String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const aliases = { strength: /force physique accrue/, agility: /agilite et souplesse/, intellect: /intelligence superieure/, medicine: /connaissances medicales/, firearm: /maitrise des armes a feu/, spirit: /^esprit$/, blood: /sang resistant/, genius: /^genie$/, stomach: /estomac d.acier/, reinforced: /parties du corps renforcees/ };
export function sourceTrait(actor, key) {
  return Array.from(actor?.items ?? []).find(item => item.system?.traitKey === key || aliases[key]?.test(normalize(item.name)));
}
export function traitCombatBonuses(actor) {
  if (!(game.combat?.round > 0) || !Array.from(game.combat.combatants ?? []).some(c=>c.actor?.uuid === actor.uuid)) return {};
  return { force: sourceTrait(actor, "strength") ? 3 : 0, finesse: sourceTrait(actor, "agility") ? 3 : 0, intellect: sourceTrait(actor, "intellect") ? 3 : 0 };
}
export function traitDerivedBonus(actor, key) {
  return (sourceTrait(actor, "intellect") ? 3 : 0) + (key === "puissanceBrute" && sourceTrait(actor, "strength") ? 6 : 0) +
    (key === "dexterite" && sourceTrait(actor, "agility") ? 6 : 0);
}
export function reinforcedDamageReduction(actor, limb) {
  return limb && sourceTrait(actor, "reinforced")?.system?.reinforcedLimb === limb ? 8 : 0;
}
export function drivingBonus(actor, key) {
  const vehicle = actor.items?.find(i => i.id === actor.getFlag("breathe-and-live", "drivingVehicleId"));
  return (Number(vehicle?.system?.vehicleBonus?.all) || 0) + (Number(vehicle?.system?.vehicleBonus?.[key]) || 0);
}
export function envelopingAttackPenalty(actor) {
  const token = actor.getActiveTokens?.()[0];
  if (!token || !(game.combat?.round > 0)) return 0;
  return canvas.tokens.placeables.some(t => t.actor?.uuid !== actor.uuid && t.actor?.getFlag("breathe-and-live", "envelopingAttack") &&
    Math.max(Math.abs(token.center.x-t.center.x),Math.abs(token.center.y-t.center.y)) / canvas.grid.size * (canvas.scene?.grid?.distance || 1.5) < 9) ? 1 : 0;
}
const senses = [ ["vue","Vue"], ["ouie","Ouïe"], ["odorat","Odorat"], ["gout","Goût"], ["toucher","Toucher"] ];
export async function perceptionContext(actor, key, label) {
  let socialBonus = 0;
  if (["tromperie", "performance", "intimidation", "perception", "intuition"].includes(key) && Number(actor.system?.progression?.bonuses?.socialExternal) > 0) {
    const external = await Dialog.confirm({ title: "Maîtrise des compétences sociales", content: "<p>Ce test social concerne-t-il une personne extérieure au groupe ?</p>" });
    if (external) socialBonus = Number(actor.system.progression.bonuses.socialExternal);
  }
  if (key !== "perception") return { label, bonus: socialBonus + drivingBonus(actor, key) };
  let sense = senses.find(([value]) => normalize(label).includes(value))?.[0];
  if (!sense) sense = await new Promise(resolve => new Dialog({ title: "Sens utilisé pour la Perception",
    content: `<select name="sense">${senses.map(([key, text]) => `<option value="${key}">${text}</option>`).join("")}</select>`,
    buttons: { roll: { label: "Tester", callback: html => resolve(html.find('[name="sense"]').val()) }, cancel: { label: "Annuler", callback: () => resolve(null) } }, close: () => resolve(null),
  }).render(true));
  if (!sense) return null;
  const rank = Math.max(0, ...Array.from(actor.items ?? []).filter(i => i.type === "sense" && normalize(i.system?.senseType) === sense).map(i => Number(i.system.rank) || 0));
  return { label: `${label || "Perception"} (${senses.find(([key]) => key === sense)?.[1]})`, bonus: socialBonus + drivingBonus(actor, key) + (rank ? Math.min(3, rank) + 2 : 0) };
}

export async function useExtrasensoryAbility(actor, item) {
  const token = actor.getActiveTokens?.()[0];
  if (!token) { ui.notifications.warn("Placez le personnage sur la scène pour utiliser ce sens."); return null; }
  const rank = Number(item.system?.rank) || 1, range = rank >= 3 ? 18 : rank === 2 ? 9 : 0;
  if (!range) { ui.notifications.info("Niveau 1 : choisissez ce sens lors d'un test de Perception (+3)."); return null; }
  const targets = canvas.tokens.placeables.filter(t => t.actor && t.id !== token.id &&
    Math.max(Math.abs(t.center.x - token.center.x), Math.abs(t.center.y - token.center.y)) / canvas.grid.size * 1.5 <= range);
  const lines = targets.filter(t => ["demon", "npcDemon"].includes(t.actor.type)).map(t => `${t.name} : présence démoniaque${rank === 3 && item.system.senseType === "odorat" ? `, rang ${t.actor.system.class.rank}` : ""}.`);
  if (rank === 3) {
    const selected = Array.from(game.user.targets ?? []).find(t => t.actor && targets.includes(t));
    if (item.system.senseType === "ouie") for (const t of targets) lines.push(`${t.name} : ${t.actor.system.resources.hp.value} PV.`);
    if (item.system.senseType === "vue") lines.push("Le MJ annonce l'action du démon à proximité au début de son tour ; cette décision narrative n'est pas déterminée par le système.");
    if (item.system.senseType === "toucher" && selected) {
      const touching = await Dialog.confirm({ title: "Toucher extrasensoriel", content: `<p>Le personnage touche-t-il réellement ${selected.name} ?</p>` });
      if (touching) lines.push(`${selected.name} : PV ${selected.actor.system.resources.hp.value}, RP ${selected.actor.system.resources.rp.value}, BDP ${selected.actor.system.resources.bdp.value}.`);
    }
    if (item.system.senseType === "gout" && selected) {
      const tasted = await Dialog.confirm({ title: "Goût extrasensoriel", content: `<p>Le personnage a-t-il goûté ou consommé la chair de ${selected.name} ?</p>` });
      if (tasted) lines.push(`${selected.name} : ${Object.entries(selected.actor.system.stats.effectiveBase || selected.actor.system.stats.base).map(([key,value]) => `${key} ${value}`).join(", ")}.`);
    }
  }
  await ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor }), content: `<strong>${item.name} — portée ${range} m</strong><p>${lines.join("<br>") || "Aucune présence démoniaque détectée à portée."}</p>` });
  return lines;
}
