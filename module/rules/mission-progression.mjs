import { SYSTEM_ID } from "../config/rule-data.mjs";
import { normalizeBreathName, validateTechniqueOwnership } from "./technique-utils.mjs";

const queues = new WeakMap();
export function awardSecondaryBreathForm(actor) {
  const next = (queues.get(actor) ?? Promise.resolve()).catch(error => console.error("BL | Mission", error)).then(async () => {
    if (!actor.items.some(i => i.system?.featureKey === "secondary-breath")) {
      ui.notifications.warn("Acquérez d'abord la compétence Pratiquer un souffle secondaire."); return;
    }
    const pack = game.packs.get(`${SYSTEM_ID}.techniques-breaths`);
    const forms = await pack.getDocuments();
    const owned = new Set(actor.items.filter(i => i.type === "technique").map(i => `${i.system.breathKey}:${i.system.form}`));
    const available = forms.filter(i => !owned.has(`${normalizeBreathName(i.system.breathKey || i.system.breath)}:${i.system.form}`));
    if (!available.length) { ui.notifications.info("Toutes les formes disponibles sont déjà acquises."); return; }
    const answer = await new Promise(resolve => new Dialog({ title: "Mission réussie — souffle secondaire",
      content: `<p>Une forme par mission réussie (livre p.78). Choisissez une forme du souffle secondaire travaillé avec le MJ.</p><label>Identifiant ou nom unique de la mission</label><input name="mission" type="text" /><label>Forme apprise</label><select name="form">${available.map(i => `<option value="${i.id}">${i.name}</option>`).join("")}</select>`,
      buttons: { apply: { label: "Accorder", callback: html => resolve({ mission: String(html.find('[name="mission"]').val()).trim(), id: html.find('[name="form"]').val() }) }, cancel: { label: "Annuler", callback: () => resolve(null) } }, close: () => resolve(null),
    }).render(true));
    if (!answer?.mission) return;
    const missions = actor.getFlag(SYSTEM_ID, "secondaryBreathMissions") || [];
    if (missions.includes(answer.mission)) { ui.notifications.warn("Une forme a déjà été accordée pour cette mission."); return; }
    const form = available.find(i => i.id === answer.id);
    const key = normalizeBreathName(form.system.breathKey || form.system.breath), chosen = actor.getFlag(SYSTEM_ID, "secondaryBreathKey");
    if (chosen && key !== chosen) { ui.notifications.warn("Cette récompense doit appartenir au souffle secondaire déjà choisi."); return; }
    if (!actor.items.some(i => i.type === "breath" && normalizeBreathName(i.system.key || i.name) === key)) {
      const styles = await game.packs.get(`${SYSTEM_ID}.breaths-styles`).getDocuments();
      const style = styles.find(i => normalizeBreathName(i.system.key || i.name) === key);
      if (!style) return;
      const eligibility = validateTechniqueOwnership(actor, style.toObject());
      if (!eligibility.ok) { ui.notifications.warn(eligibility.message); return; }
      await actor.createEmbeddedDocuments("Item", [game.items.fromCompendium(style)]);
    }
    await actor.createEmbeddedDocuments("Item", [game.items.fromCompendium(form)]);
    await actor.setFlag(SYSTEM_ID, "secondaryBreathKey", key);
    await actor.setFlag(SYSTEM_ID, "secondaryBreathMissions", [...missions, answer.mission]);
    await ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor }), content: `<em>Mission ${answer.mission} réussie : ${actor.name} apprend ${form.name}, sans dépenser de slot d'étude.</em>` });
  });
  queues.set(actor, next); return next;
}
