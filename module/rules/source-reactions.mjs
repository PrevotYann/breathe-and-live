import { rollBasicAttack, rollDerivedCheck, spendRp } from "./action-engine.mjs";
import { normalizeRuleName } from "./technique-limits.mjs";
import { getDeflectStance, canInteractWithToken, consumeDeflectStance } from "../chat/reaction-card.mjs";
import { applyEffectsList } from "./effects-engine.mjs";
import { spendCombatAction } from "./combat-actions.mjs";

const names = new Set(["fendeur de riviere", "carapace reactive", "contre-morsure", "piege de diversion", "reflexe d'esquive"]);
export function sourceReactionButtons(actor, tokenId) {
  return Array.from(actor?.items ?? []).filter(i => i.type === "subclassTechnique" && names.has(normalizeRuleName(i.name)))
    .map(i => `<button class="bl-source-reaction" data-target-token="${tokenId}" data-item-id="${i.id}">${i.name}</button>`).join("") + sourceAllyReactionButtons(actor, tokenId);
}
export function sourceAllyReactionButtons(actor, tokenId) {
  const target = canvas.tokens.get(tokenId);
  return (canvas.tokens.placeables ?? []).filter(t => t.actor && t.id !== tokenId).flatMap(t => {
    const pact = t.document?.disposition !== target?.document?.disposition && t.actor.items.find(i => normalizeRuleName(i.name) === "pacte de controle mental");
    const service = t.actor.system?.combat?.subclassStance === "service" && t.document?.disposition === target?.document?.disposition;
    return [pact ? `<button class="bl-pacte" data-target-token="${tokenId}" data-ability-token="${t.id}" data-item-id="${pact.id}" disabled>Pacte (${t.name}) après esquive</button>` : "",
      service ? `<button class="bl-service" data-target-token="${tokenId}" data-ability-token="${t.id}">Plaisir de servir (${t.name})</button>` : ""];
  }).join("");
}
export function permitAvoidanceCounter(html, tokenId) {
  html.find(`.bl-pacte[data-target-token="${tokenId}"]`).prop("disabled", false).attr("data-avoidance", "true");
}
function reduceDamageRow(html, tokenId, remaining) {
  html.find(`.bl-target-row[data-target-token="${tokenId}"] .bl-takedmg, .bl-target-row[data-target-token="${tokenId}"] .bl-takedmg-poison`).attr("data-damage", remaining);
}
async function askNumber(title, label) {
  return new Promise(resolve => new Dialog({ title, content: `<p>${label}</p><input name="amount" type="number" min="0" placeholder="Valeur MJ" />`,
    buttons: { apply: { label: "Valider", callback: html => {
      const raw = String(html.find('[name="amount"]').val() ?? "").trim(); resolve(raw && Number.isFinite(Number(raw)) && Number(raw) >= 0 ? Number(raw) : null);
    } }, cancel: { label: "Annuler", callback: () => resolve(null) } }, close: () => resolve(null),
  }).render(true));
}
export function attachSourceReactions(card, html, on, attacker) {
  on(".bl-source-reaction", async event => {
    const button = $(event.currentTarget), token = canvas.tokens.get(String(button.attr("data-target-token")));
    if (!token?.actor || !canInteractWithToken(token)) return;
    const actor = token.actor, item = actor.items.get(String(button.attr("data-item-id")));
    if (!item || !names.has(normalizeRuleName(item.name))) return;
    const name = normalizeRuleName(item.name);
    const enemy = attacker.getActiveTokens?.()[0];
    let threshold = card.attackTotal;
    if (name === "fendeur de riviere") {
      if (!card.isFirearm && !card.ranged) { ui.notifications.warn("Fendeur de Rivière exige un projectile entrant."); return; }
      if (threshold === undefined) threshold = await askNumber("Jet adverse", "Le projectile n'a pas de jet d'attaque chiffré ; indiquez le seuil arbitré par le MJ.");
      if (threshold === null) return;
    }
    if (name === "contre-morsure" && (!enemy || Math.max(Math.abs(token.center.x-enemy.center.x), Math.abs(token.center.y-enemy.center.y)) / canvas.grid.size * 1.5 > 1.5)) {
      ui.notifications.warn("Contre-Morsure exige un attaquant à moins de 1,5 m."); return;
    }
    if (name === "piege de diversion" && (card.attackBonus === undefined || card.autoHit)) {
      ui.notifications.warn("Piège de diversion nécessite un jet d'attaque ; le MJ résout l'opposition pour cette attaque automatique."); return;
    }
    const cost = Number(item.system.costRp) || 0;
    if (name !== "reflexe d'esquive" && cost > 0 && !(await spendRp(actor, cost, item.name))) return;
    let result;
    if (name === "piege de diversion") {
      const deceptive = await rollDerivedCheck(actor, "tromperie", item.name), awareness = await rollDerivedCheck(attacker, "perception", item.name);
      if (!deceptive || !awareness || !(deceptive.total > awareness.total)) result = "Diversion échouée : attaque inchangée.";
      else {
        const alternate = await new Roll(`1d20 + ${card.attackBonus}`).evaluate();
        const total = Math.min(card.attackTotal, alternate.total);
        await alternate.toMessage({ speaker: ChatMessage.getSpeaker({ actor: attacker }), flavor: "Piège de diversion : seconde valeur du désavantage" });
        if (total < card.targetCa) { html.find(`.bl-target-row[data-target-token="${token.id}"] button`).prop("disabled", true); result = `Diversion : attaque manquée (${total} contre CA ${card.targetCa}).`; }
        else result = `Diversion réussie ; l'attaque touche encore (${total}).`;
      }
    } else if (name === "reflexe d'esquive") {
      // TODO-RULEBOOK-AMBIGUITY: p.63 has no DC or canonical Acrobatics stat.
      const dc = await askNumber("Réflexe d'esquive", "Indiquez le DD du test d'Acrobatie, absent du livre. Le MJ choisit ensuite la statistique correspondante.");
      if (dc === null) return;
      const key = await new Promise(resolve => new Dialog({ title: "Statistique d'Acrobatie — MJ", content: `<select name="stat">${Object.entries(CONFIG.breatheAndLive?.DERIVED_LABELS || {}).map(([key,label]) => `<option value="${key}">${label}</option>`).join("")}</select>`, buttons: { apply: { label: "Tester", callback: html => resolve(html.find('[name="stat"]').val()) }, cancel: { label: "Annuler", callback: () => resolve(null) } }, close: () => resolve(null) }).render(true));
      if (!key) return;
      if (cost > 0 && !(await spendRp(actor, cost, item.name))) return;
      const roll = await rollDerivedCheck(actor, key, item.name);
      if (roll?.total >= dc) {
        html.find(`.bl-target-row[data-target-token="${token.id}"] button`).prop("disabled", true); permitAvoidanceCounter(html, token.id);
        result = "Acrobatie réussie : attaque esquivée. Une riposte utilisant une action peut être effectuée.";
        await actor.setFlag("breathe-and-live", "acrobaticsRiposte", { enemyUuid: attacker.uuid, combatId: game.combat?.id, round: game.combat?.round, turn: game.combat?.turn });
        html.find(`.bl-target-row[data-target-token="${token.id}"] .bl-target-result`).after(`<button class="bl-acrobatics-riposte" data-target-token="${token.id}">Riposter (1 action)</button>`);
      } else result = "Acrobatie échouée : dégâts à résoudre.";
    } else if (name === "contre-morsure") {
      await rollBasicAttack(actor, { targetToken: enemy, free: true }); result = "Contre-attaque effectuée ; l'attaque entrante reste à résoudre.";
    } else {
      const roll = await rollDerivedCheck(actor, name === "carapace reactive" ? "endurance" : "dexterite", item.name);
      if (!roll) return;
      const row = html.find(`.bl-target-row[data-target-token="${token.id}"]`);
      const damage = Number(row.find(".bl-takedmg").attr("data-damage")) || 0;
      if (name === "carapace reactive") { const remaining = Math.max(0, damage - roll.total); reduceDamageRow(html, token.id, remaining); result = `${item.name} : ${roll.total} dégâts absorbés ; reste ${remaining}.`; }
      else if (roll.total >= threshold) { row.find("button").prop("disabled", true); result = "Projectile détruit, dégâts évités."; }
      else result = "Échec du Fendeur de Rivière ; les dégâts restent à résoudre.";
    }
    button.prop("disabled", true);
    html.find(`.bl-target-row[data-target-token="${token.id}"] .bl-target-result`).text(result);
  });
  on(".bl-acrobatics-riposte", async event => {
    const button = $(event.currentTarget), token = canvas.tokens.get(String(button.attr("data-target-token")));
    if (!token?.actor || !canInteractWithToken(token)) return;
    const actor = token.actor, permission = actor.getFlag("breathe-and-live", "acrobaticsRiposte");
    if (!permission || permission.enemyUuid !== attacker.uuid || permission.combatId !== game.combat?.id || permission.round !== game.combat?.round || permission.turn !== game.combat?.turn) return;
    const enemy = attacker.getActiveTokens?.()[0];
    if (!enemy) return;
    if (!(await spendCombatAction(actor, { reaction: true, costs: game.combat?.round > 0 ? [{ path: "system.combat.actionEconomy.remainingActions", cost: 1, label: "action de riposte" }] : [] }))) return;
    await actor.unsetFlag("breathe-and-live", "acrobaticsRiposte");
    await rollBasicAttack(actor, { targetToken: enemy, free: true });
    button.prop("disabled", true);
  });
  on(".bl-pacte", async event => {
    const button = $(event.currentTarget), userToken = canvas.tokens.get(String(button.attr("data-ability-token"))), target = canvas.tokens.get(String(button.attr("data-target-token")));
    if (!userToken?.actor || !target?.actor || !canInteractWithToken(userToken) || button.attr("data-avoidance") !== "true") return;
    const item = userToken.actor.items.get(String(button.attr("data-item-id")));
    if (!item || !(await spendRp(userToken.actor, Number(item.system.costRp) || 1))) return;
    const roll = await rollDerivedCheck(userToken.actor, "puissanceBrute", item.name);
    if (!(roll?.total >= 15)) { button.prop("disabled", true); return; }
    // TODO-RULEBOOK-AMBIGUITY: p.65 does not specify immobilization duration.
    await applyEffectsList({ source: userToken.actor, target, effects: [{ path: "system.combat.sourceImmobilized", mode: "set", value: 1, duration: "roundEnd", label: "Pacte : immobilisation, durée fin de round à confirmer par le MJ" }] });
    const row = html.find(`.bl-target-row[data-target-token="${target.id}"]`);
    row.find(".bl-takedmg, .bl-takedmg-poison").prop("disabled", false); button.prop("disabled", true);
    row.find(".bl-target-result").text("Pacte réussi (DD 15) : esquive/déviation neutralisée, dégâts de l'attaque à résoudre.");
  });
  on(".bl-service", async event => {
    const button = $(event.currentTarget), protector = canvas.tokens.get(String(button.attr("data-ability-token"))), ally = canvas.tokens.get(String(button.attr("data-target-token"))), enemy = attacker.getActiveTokens?.()[0];
    if (!protector?.actor || !ally || !enemy || !canInteractWithToken(protector) || protector.actor.system.combat.subclassStance !== "service") return;
    if (Math.max(Math.abs(enemy.center.x-protector.center.x),Math.abs(enemy.center.y-protector.center.y))/canvas.grid.size*1.5 > 1.5) { ui.notifications.warn("L'attaquant doit être à 1,5 m du protecteur."); return; }
    const origin = { x: protector.document.x, y: protector.document.y };
    // TODO-RULEBOOK-AMBIGUITY: p.65's pronoun is ambiguous; swap with the protected ally.
    await canvas.scene.updateEmbeddedDocuments("Token", [{ _id: protector.id, x: ally.document.x, y: ally.document.y }, { _id: ally.id, ...origin }], { animate: false });
    const row = html.find(`.bl-target-row[data-target-token="${ally.id}"]`);
    row.find("button").prop("disabled", true); row.find(".bl-target-result").text("Plaisir de servir : places échangées avec l'allié protégé, attaque repoussée.");
  });
  on(".bl-demon-block", async event => {
    const button = $(event.currentTarget), token = canvas.tokens.get(String(button.attr("data-target-token")));
    if (!token?.actor || !canInteractWithToken(token)) return;
    const stance = getDeflectStance(token.actor);
    if (stance?.source !== "demon-defense") return;
    const reduction = await askNumber("Blocage démoniaque", "Le livre ne donne pas de formule de blocage. Le MJ indique les dégâts réellement bloqués.");
    if (reduction === null) return;
    const row = html.find(`.bl-target-row[data-target-token="${token.id}"]`), damage = Number(row.find(".bl-takedmg").attr("data-damage")) || 0;
    reduceDamageRow(html, token.id, Math.max(0, damage - reduction));
    await consumeDeflectStance(token.actor); button.prop("disabled", true);
    row.find(".bl-target-result").text(`Blocage : ${reduction} dégâts absorbés ; reste ${Math.max(0, damage-reduction)}.`);
  });
}
