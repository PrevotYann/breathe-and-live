import { rollBasicAttack, rollDerivedCheck, spendRp } from "./action-engine.mjs";
import { normalizeRuleName } from "./technique-limits.mjs";
import { getDeflectStance, canInteractWithToken, consumeDeflectStance } from "../chat/reaction-card.mjs";

const names = new Set(["fendeur de riviere", "carapace reactive", "contre-morsure"]);
export function sourceReactionButtons(actor, tokenId) {
  return Array.from(actor?.items ?? []).filter(i => i.type === "subclassTechnique" && names.has(normalizeRuleName(i.name)))
    .map(i => `<button class="bl-source-reaction" data-target-token="${tokenId}" data-item-id="${i.id}">${i.name}</button>`).join("");
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
    const cost = Number(item.system.costRp) || 0;
    if (cost > 0 && !(await spendRp(actor, cost, item.name))) return;
    let result;
    if (name === "contre-morsure") {
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
