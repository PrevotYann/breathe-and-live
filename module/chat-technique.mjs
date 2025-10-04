// module/chat-technique.mjs
export async function useTechnique(user, item, targets = []) {
  const sys = item.system ?? {};
  const cost = sys.costE ?? 0;
  const dmg = sys.damage ?? "1d8";
  const uRes = user.system.resources;

  if ((uRes.e.value ?? 0) < cost)
    return ui.notifications.warn("Pas assez d'Endurance");
  await user.update({ "system.resources.e.value": uRes.e.value - cost });

  const roll = await new Roll(dmg).roll({ async: true });
  const content = `
  <div class="bl-card">
    <h3>${item.name}</h3>
    <p>Dégâts potentiels : <strong>${roll.total}</strong></p>
    <footer><button class="bl-dodge" data-cost="1">Esquiver (1 RP)</button></footer>
  </div>`;

  const msg = await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor: user }),
    content,
  });

  Hooks.once("renderChatMessage", (message, html) => {
    if (message.id !== msg.id) return;
    html.on("click", ".bl-dodge", async () => {
      const rp = user.system.resources.rp.value ?? 0;
      if (rp <= 0) return ui.notifications.warn("Plus de RP");
      await user.update({ "system.resources.rp.value": rp - 1 });
      html
        .find("footer")
        .replaceWith(
          `<p><em>Esquive réussie — RP -1, dégâts annulés.</em></p>`
        );
    });
  });
}
