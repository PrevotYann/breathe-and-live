// module/sheets/actor-slayer-sheet.mjs
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

    // Seul GM ou Owner peut éditer (et donc utiliser/supprimer des items)
    const canEdit = game.user?.isGM || this.actor.isOwner;
    data.canEdit = !!canEdit;

    const allItems = Array.from(this.actor.items ?? []);
    data.itemsTech = allItems.filter((i) => i.type === "technique");
    data.itemsOther = allItems.filter((i) => i.type !== "technique");

    return data;
  }

  activateListeners(html) {
    super.activateListeners(html);
    const canEdit = game.user?.isGM || this.actor.isOwner;

    // Si pas d’édition, on bloque les actions destructrices/modificatrices
    if (!canEdit) return;

    // Supprimer un item de la liste
    html.find(".item-delete").on("click", (ev) => {
      const li = ev.currentTarget.closest(".item");
      const id = li?.dataset.itemId;
      if (id) this.actor.deleteEmbeddedDocuments("Item", [id]);
    });

    // Ouvrir la fiche de l'item (si tu as un bouton .item-edit dans le template)
    html.find(".item-edit").on("click", (ev) => {
      const li = ev.currentTarget.closest(".item");
      const item = li ? this.actor.items.get(li.dataset.itemId) : null;
      if (item) item.sheet?.render(true);
    });

    // Utiliser une Technique (bouton .item-chat / .bl-use-technique dans le template)
    html.on("click", ".item-chat, .bl-use-technique", async (ev) => {
      ev.preventDefault();

      const li = ev.currentTarget.closest(".item");
      const item = li ? this.actor.items.get(li.dataset.itemId) : null;
      if (!item) return;

      // Si c'est une TECHNIQUE → délègue au module (auto-touché, réactions, souffles, etc.)
      if (item.type === "technique") {
        return useTechnique(this.actor, item, {
          controlledToken: this.actor?.token,
        });
      }

      // Sinon (autres items qui auraient un coût E + dégâts), on applique une routine simple
      const FU = foundry.utils;
      const cost = Number(item.system?.costE ?? 0) || 0;
      const ePath = "system.resources.e.value";
      const eVal = Number(FU.getProperty(this.actor, ePath) ?? 0) || 0;

      if (eVal < cost) {
        ui.notifications.warn(
          `Pas assez d'Endurance (E). Requis: ${cost}, actuel: ${eVal}`
        );
        return;
      }

      // Consommer l'Endurance d'abord (anti “refund”)
      await this.actor.update({ [ePath]: eVal - cost });

      // Jet de dégâts basique si présent
      const dmg = item.system?.damage || "1d8";
      const roll = new Roll(dmg);
      await roll.evaluate({ async: true });

      await roll.toMessage({
        speaker: ChatMessage.getSpeaker({ actor: this.actor }),
        flavor: `Utilisation : ${item.name} — E -${cost}`,
      });

      // Re-render pour rafraîchir l'affichage des ressources
      this.render(false);
    });
  }
}
