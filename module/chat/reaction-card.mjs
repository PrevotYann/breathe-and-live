import { getActiveBreaths } from "../rules/breath-effects.mjs";

const SYSTEM_ID = "breathe-and-live";
const METERS_PER_SQUARE = 1.5;

function distMetersChebyshev(aToken, bToken) {
  if (!aToken || !bToken) return null;
  const gs = canvas?.grid?.size || 100;
  const dx = Math.abs((aToken.center?.x ?? 0) - (bToken.center?.x ?? 0)) / gs;
  const dy = Math.abs((aToken.center?.y ?? 0) - (bToken.center?.y ?? 0)) / gs;
  return Math.max(dx, dy) * METERS_PER_SQUARE;
}

export function canInteractWithToken(token) {
  const actor = token?.actor;
  return game.user.isGM || (actor && actor.isOwner);
}

export function resolveCanvasToken(tokenLike, actor = null) {
  if (tokenLike?.center && tokenLike?.actor) return tokenLike;
  if (tokenLike?.object?.center && tokenLike.object?.actor) return tokenLike.object;

  const tokenId = tokenLike?.id ?? tokenLike?._id ?? tokenLike?.document?._id;
  if (tokenId) {
    const canvasToken = canvas?.tokens?.get?.(String(tokenId));
    if (canvasToken?.center && canvasToken?.actor) return canvasToken;
  }

  return (
    actor?.getActiveTokens?.()?.[0] ||
    canvas?.tokens?.controlled?.find((entry) => entry.actor?.id === actor?.id) ||
    canvas?.tokens?.placeables?.find((entry) => entry.actor?.id === actor?.id) ||
    null
  );
}

export function getDeflectStance(actor) {
  const stance = actor?.getFlag(SYSTEM_ID, "deflectStance");
  if (!stance) return null;
  if (game.combat && stance.round && Number(stance.round) !== Number(game.combat.round)) {
    return null;
  }
  return stance;
}

export async function consumeDeflectStance(actor) {
  if (!actor) return;
  await actor.unsetFlag(SYSTEM_ID, "deflectStance").catch(() => {});
}

export function buildReactionTargetRow({
  attackerToken = null,
  targetToken,
  damageTotal = 0,
  allowDodge = true,
  allowReactions = true,
  allowWaterDeflect = true,
  takeDamageLabel = "Prendre les degats",
}) {
  const targetActor = targetToken?.actor;
  const targetBreaths = targetActor ? getActiveBreaths(targetActor) : {};
  const canDodge = allowReactions && allowDodge;
  const canWaterDeflect =
    allowReactions &&
    allowWaterDeflect &&
    !!targetBreaths.water?.enabled &&
    !!targetBreaths.water?.specials?.devierVagues;
  const stance = allowReactions ? getDeflectStance(targetActor) : null;
  const distance = distMetersChebyshev(attackerToken, targetToken);
  const distanceLabel =
    distance === null ? "" : ` <small>Dist: ${distance.toFixed(1)} m</small>`;

  return `
    <div class="bl-target-row" data-target-token="${targetToken.id}">
      <div><b>${targetToken.name}</b>${distanceLabel}</div>
      <div class="bl-target-buttons" style="display:flex; gap:.35rem; flex-wrap:wrap; margin-top:.25rem;">
        ${canDodge ? `<button class="bl-dodge" data-target-token="${targetToken.id}" data-damage="${damageTotal}">Esquiver (1 RP)</button>` : ""}
        ${canWaterDeflect ? `<button class="bl-deflect" data-target-token="${targetToken.id}" data-damage="${damageTotal}">Devier (1 RP)</button>` : ""}
        ${stance ? `<button class="bl-stance-deflect" data-target-token="${targetToken.id}" data-damage="${damageTotal}">Deflecter (${stance.itemName})</button>` : ""}
        <button class="bl-takedmg" data-target-token="${targetToken.id}" data-damage="${damageTotal}">${takeDamageLabel}</button>
      </div>
      <div class="bl-target-result" style="margin-top:.25rem;"></div>
    </div>
  `;
}
