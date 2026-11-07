// Items whose numbers the rulebook leaves to the GM carry `system.ruleSource.missingFields`.
// They must be arbitrated once before use; this gate lets the GM do it in one click at the
// moment of use instead of refusing silently until a checkbox is found on the item sheet.

export function needsRuleApproval(item) {
  const source = item?.system?.ruleSource;
  return !!(source?.missingFields?.length && !source.approved);
}

function describeValues(item) {
  const sys = item.system ?? {};
  const rows = [
    ["Dégâts", sys.damage],
    ["Coût BDP", sys.costBdp],
    ["Coût Endurance", sys.costE],
    ["Coût RP", sys.costRp],
    ["Portée", sys.rangeText || (sys.range ? `${sys.range} m` : "")],
  ].filter(([, value]) => value !== undefined && value !== null && String(value).trim() !== "" && String(value) !== "0");
  return rows.map(([label, value]) => `<li><b>${label} :</b> ${foundry.utils.escapeHTML?.(String(value)) ?? String(value)}</li>`).join("");
}

/** Resolves true when the item may be used now; the GM approval is persisted on the item. */
export async function ensureRuleApproval(item) {
  if (!needsRuleApproval(item)) return true;
  const missing = item.system.ruleSource.missingFields.join(", ");
  if (!game.user?.isGM) {
    ui.notifications.warn(`${item.name} : valeurs absentes du livre (${missing}). Le MJ doit les arbitrer avant usage.`);
    return false;
  }
  const values = describeValues(item);
  const approved = await Dialog.confirm({
    title: `Arbitrage MJ — ${item.name}`,
    content: `<p>Le livre ne chiffre pas : <b>${missing}</b>.</p>${values ? `<p>Valeurs actuellement saisies :</p><ul>${values}</ul>` : "<p>Aucune valeur saisie.</p>"}<p>Utiliser ces valeurs et les marquer comme validées par le MJ ?</p>`,
    yes: () => true,
    no: () => false,
    defaultYes: true,
  });
  if (!approved) return false;
  if (item.update) await item.update({ "system.ruleSource.approved": true });
  return true;
}
