import { useTechnique } from "../chat/use-technique.mjs";

export class BLSlayerSheet extends ActorSheet {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["breathe-and-live", "sheet", "actor", "slayer"],
      width: 720,
      height: 680,
      tabs: [
        {
          navSelector: ".sheet-tabs",
          contentSelector: ".sheet-body",
          initial: "ressources",
        },
      ],
    });
  }

  get template() {
    return "systems/breathe-and-live/templates/actor/actor-slayer.hbs";
  }

  /** NORMALISATION DES DONNÉES POUR LE TEMPLATE **/
  async getData(options) {
    const data = await super.getData(options);

    // Source brute (system) ou compat (data.data)
    const rawSys =
      (this.actor.system && Object.keys(this.actor.system).length
        ? this.actor.system
        : this.actor.data?.data ?? {}) || {};

    // Défauts attendus par le template
    const defaults = {
      class: { type: "Pourfendeur", rank: "Mizunoto", level: 1 },
      stats: {
        base: {
          force: 0,
          finesse: 0,
          courage: 0,
          vitesse: 0,
          social: 0,
          intellect: 0,
        },
        derived: {},
      },
      resources: {
        hp: { value: 20, max: 20 },
        e: { value: 0, max: 0 },
        rp: { value: 0, max: 0 },
        ca: 10,
      },
    };

    // IMPORTANT : on fusionne en laissant PRÉVALOIR les vraies données (rawSys)
    data.system = foundry.utils.mergeObject(
      foundry.utils.duplicate(defaults),
      rawSys,
      {
        inplace: false,
        insertKeys: true,
        overwrite: true,
      }
    );

    // Seul GM ou Owner peut éditer
    const canEdit = game.user?.isGM || this.actor.isOwner;
    data.canEdit = !!canEdit;

    return data;
  }

  activateListeners(html) {
    super.activateListeners(html);
    const canEdit = game.user?.isGM || this.actor.isOwner;

    // Si pas d’édition, on bloque les actions destructrices/modificatrices
    if (!canEdit) return;

    // Delete item
    html.find(".item-delete").on("click", (ev) => {
      const li = ev.currentTarget.closest(".item");
      const id = li?.dataset.itemId;
      if (id) this.actor.deleteEmbeddedDocuments("Item", [id]);
    });

    // Use Technique (chat roll + E consumption)
    html.on("click", ".item-chat, .bl-use-technique", async (ev) => {
      // Find the technique item
      const li = ev.currentTarget.closest(".item");
      const item = li ? this.actor.items.get(li.dataset.itemId) : null;
      if (!item) return;

      if (item.type === "technique") {
        return useTechnique(this.actor, item); // <-- uses the helper
      }

      // Read cost and current Endurance
      const cost = Number(item.system?.costE ?? 0) || 0;
      const ePath = "system.resources.e.value";
      const eVal = getProperty(this.actor, ePath) ?? 0;

      // Not enough Endurance?
      if (eVal < cost) {
        ui.notifications.warn(
          `Pas assez d'Endurance (E). Requis: ${cost}, actuel: ${eVal}`
        );
        return;
      }

      // Consume Endurance first (so a crash mid-roll can't “refund” E)
      await this.actor.update({ [ePath]: eVal - cost });

      // Roll damage
      const dmg = item.system?.damage || "1d8";
      const roll = await new Roll(dmg).roll({ async: true });

      // Send to chat (show E spent)
      await roll.toMessage({
        speaker: ChatMessage.getSpeaker({ actor: this.actor }),
        flavor: `Technique : ${item.name} — E -${cost}`,
      });

      // Optional: re-render to reflect the new E immediately on the sheet
      this.render(false);
    });
  }
}
