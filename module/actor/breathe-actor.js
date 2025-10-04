/**
 * Classe BreatheActor
 * Gère les calculs automatiques pour les personnages, démonistes, démons, PNJ.
 */
export class BreatheActor extends Actor {
  /** @override */
  prepareData() {
    super.prepareData();
    const actorData = this.system;
    const stats = actorData.statsBase || {};
    const attrs = actorData.attributes || {};

    // Vérification du type d'acteur
    switch (this.type) {
      case "slayer":
        this._prepareCharacterData(actorData, stats, attrs);
        break;
      case "demonist":
        this._prepareDemonisteData(actorData, stats, attrs);
        break;
      case "demon":
        this._prepareDemonData(actorData, stats, attrs);
        break;
      case "npc":
        this._prepareNpcData(actorData, stats, attrs);
        break;
    }
  }

  /* -------------------------------------------- */
  /* HUMAIN : Pourfendeur de démons               */
  /* -------------------------------------------- */
  _prepareCharacterData(data, stats, attrs) {
    const niveau = data.details.niveau || 1;

    // PV et Endurance
    attrs.pv.max = 20 + niveau * 3;
    if (attrs.pv.value > attrs.pv.max) attrs.pv.value = attrs.pv.max;

    attrs.endurance.max = 20 + niveau * 5;
    if (attrs.endurance.value > attrs.endurance.max)
      attrs.endurance.value = attrs.endurance.max;

    // Défense
    attrs.ca = 10 + (stats.vitesse || 0);

    // Réactions
    attrs.reactions.max = 5 + (stats.vitesse || 0) + (stats.intellect || 0);
    if (attrs.reactions.value > attrs.reactions.max)
      attrs.reactions.value = attrs.reactions.max;

    // Stats dérivées
    this._prepareDerivedStats(data, stats);
  }

  /* -------------------------------------------- */
  /* DÉMONISTE                                    */
  /* -------------------------------------------- */
  _prepareDemonisteData(data, stats, attrs) {
    const niveau = data.details.niveau || 1;

    // PV et Endurance (mêmes bases que les pourfendeurs)
    attrs.pv.max = 20 + niveau * 3;
    if (attrs.pv.value > attrs.pv.max) attrs.pv.value = attrs.pv.max;

    attrs.endurance.max = 20 + niveau * 5;
    if (attrs.endurance.value > attrs.endurance.max)
      attrs.endurance.value = attrs.endurance.max;

    // Défense
    attrs.ca = 10 + (stats.vitesse || 0);

    // Réactions
    attrs.reactions.max = 5 + (stats.vitesse || 0) + (stats.intellect || 0);
    if (attrs.reactions.value > attrs.reactions.max)
      attrs.reactions.value = attrs.reactions.max;

    // Stats dérivées
    this._prepareDerivedStats(data, stats);
  }

  /* -------------------------------------------- */
  /* DÉMON                                        */
  /* -------------------------------------------- */
  _prepareDemonData(data, stats, attrs) {
    const niveau = data.details.niveau || 1;

    // PV (les démons ont une meilleure base)
    attrs.pv.max = 25 + niveau * 4;
    if (attrs.pv.value > attrs.pv.max) attrs.pv.value = attrs.pv.max;

    // Endurance (les démons ont +15 / niveau)
    attrs.endurance.max = 20 + niveau * 15;
    if (attrs.endurance.value > attrs.endurance.max)
      attrs.endurance.value = attrs.endurance.max;

    // Défense
    attrs.ca = 10 + (stats.vitesse || 0);

    // Réactions
    attrs.reactions.max = 5 + (stats.vitesse || 0) + (stats.intellect || 0);
    if (attrs.reactions.value > attrs.reactions.max)
      attrs.reactions.value = attrs.reactions.max;

    // Stats dérivées
    this._prepareDerivedStats(data, stats);
  }

  /* -------------------------------------------- */
  /* PNJ                                          */
  /* -------------------------------------------- */
  _prepareNpcData(data, stats, attrs) {
    // PNJ = calculs simplifiés
    attrs.ca = 10 + (stats.vitesse || 0);
    this._prepareDerivedStats(data, stats);
  }

  /* -------------------------------------------- */
  /* Calcul des stats dérivées                    */
  /* -------------------------------------------- */
  _prepareDerivedStats(data, stats) {
    const d = data.statsDerivees;

    // Exemple de mapping : tu peux ajuster selon les règles exactes du PDF
    d.athletisme = (stats.force || 0) + 1;
    d.puissanceBrute = (stats.force || 0) + 1;
    d.dexterite = (stats.finesse || 0) + 1;
    d.equilibre = (stats.finesse || 0) + 1;
    d.precision = (stats.finesse || 0) + 1;
    d.mithridatisme = (stats.courage || 0) + 1;
    d.endurance = (stats.courage || 0) + 2;
    d.tolerance = (stats.courage || 0) + 1;
    d.reflexes = (stats.vitesse || 0) + 1;
    d.agilite = (stats.vitesse || 0) + 1;
    d.rapidite = (stats.vitesse || 0) + 1;
    d.ruse = (stats.social || 0) + 1;
    d.manipulation = (stats.social || 0) + 1;
    d.performance = (stats.social || 0) + 1;
    d.intimidation = (stats.social || 0) + 1;
    d.perception = (stats.intellect || 0) + 2;
    d.intuition = (stats.intellect || 0) + 1;
    d.medecine = (stats.intellect || 0) + 1;
    d.nature = (stats.intellect || 0) + 1;
    d.sciences = (stats.intellect || 0) + 1;
    d.enquete = (stats.intellect || 0) + 1;
    d.survie = (stats.intellect || 0) + 1;
  }
}
