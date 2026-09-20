const NS = "breathe-and-live";
const CHANNEL = `system.${NS}`;
const factories = new Map();
const pending = new Map();

export function registerCardType(kind, factory) {
  factories.set(kind, factory);
}

export function cardFlags(kind, data) {
  return { [NS]: { card: { kind, ...data } } };
}

// Serializing requests prevents two clients from resolving the same target twice.
export function enqueueCardAction(messageId, action) {
  const previous = pending.get(messageId) ?? Promise.resolve();
  const next = previous.catch(() => {}).then(action);
  pending.set(messageId, next);
  return next.finally(() => {
    if (pending.get(messageId) === next) pending.delete(messageId);
  });
}

export function canRequestCardAction(user, actor) {
  return !!user?.active && !!actor &&
    (user.isGM || actor.testUserPermission(user, "OWNER"));
}

export async function executeCardRequest(request) {
  const message = game.messages.get(request.messageId);
  const card = message?.getFlag(NS, "card");
  const factory = factories.get(card?.kind);
  if (!factory) return;
  const authority = game.users.activeGM ?? message.author;
  if (!authority?.active || game.user.id !== authority.id) return;
  const user = game.users.get(request.userId);
  const field = card.field ?? "flavor";
  if (!["flavor", "content"].includes(field)) return;
  const html = $("<div>").html(message[field]);
  if (!Number.isInteger(request.buttonIndex) || request.buttonIndex < 0) return;
  const button = html.find(".bl-card button").eq(request.buttonIndex);
  if (!button.length || button.prop("disabled")) return;
  if (card.sceneId && canvas.scene?.id !== card.sceneId) {
    throw new Error("Le MJ doit ouvrir la scene de cette attaque pour resoudre la reaction.");
  }
  const attackerAction = button.is(".bl-dash, .bl-mist, .bl-quickshot, .bl-dislocate, .bl-poison-purify");
  const actor = attackerAction
    ? await fromUuid(card.actorUuid)
    : canvas.tokens.get(String(button.attr("data-target-token")))?.actor;
  if (!canRequestCardAction(user, actor)) return;
  // Without a GM the message author must also be allowed to update the defender.
  if (!actor?.isOwner) throw new Error("Un MJ connecte est requis pour resoudre cette reaction.");
  let callback;
  await factory(card, html, (selector, handler) => {
    if (button.is(selector)) callback = handler;
  });
  if (!callback) return;
  await callback({ currentTarget: button[0] });
  // Persist results and disabled buttons for every client and subsequent renders.
  await message.update({ [field]: html.html() });
}

export function registerPersistentCardHooks() {
  Hooks.on("renderChatMessage", (message, html) => {
    if (!factories.has(message.getFlag(NS, "card")?.kind)) return;
    html.find(".bl-card button").off("click.blCard").on("click.blCard", async event => {
      const button = $(event.currentTarget);
      const request = {
        messageId: message.id,
        userId: game.user.id,
        buttonIndex: html.find(".bl-card button").index(event.currentTarget),
      };
      const authority = game.users.activeGM ?? message.author;
      if (!authority?.active) return ui.notifications.warn("Un MJ ou l'auteur du message doit etre connecte.");
      if (authority.id === game.user.id) {
        button.prop("disabled", true);
        try {
          await enqueueCardAction(message.id, () => executeCardRequest(request));
        } catch (error) {
          ui.notifications.error(error.message);
        } finally {
          ui.chat?.updateMessage(message);
        }
      } else {
        game.socket.emit(CHANNEL, { type: "cardAction", ...request });
      }
    });
  });
  game.socket.on(CHANNEL, request => {
    if (request?.type === "cardError" && request.userId === game.user.id) {
      return ui.notifications.error(request.message);
    }
    if (request?.type !== "cardAction") return;
    return enqueueCardAction(request.messageId, () => executeCardRequest(request)).catch(error => {
      ui.notifications.error(error.message);
      game.socket.emit(CHANNEL, { type: "cardError", userId: request.userId, message: error.message });
    });
  });
}
