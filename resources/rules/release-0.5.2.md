# Breathe and Live v0.5.2 — corrections de combat

Compatible avec **Foundry VTT 14.368**.

- **Actions et initiative** : Attendre nécessite le tour du personnage et une action restante. Les restrictions de conditions couvrent aussi récupération, médecine et recharge.
- **Soins** : la réaction de soin Démoniste respecte la Lame Rouge avant de dépenser des RP. Les soins démoniaques et les capacités de soin préservent les dégâts simultanés ; soigner ou se reposer ne diminue plus les PV au-dessus du plafond de blessures.
- **Effets différés** : correction de l'appel à l'utilitaire d'identifiant Foundry pour les arts du sang à déclenchement retardé.
- **Repos** : durée positive et finie, entre les combats ; aucun repos ne ressuscite un personnage mort ou à 0 PV. Les repos courts conservent les RP et huit heures les restaurent.
- **QA reproductible** : combats avec Renjiro (Flamme), Aoi (Eau), Mika (Démoniste au fusil) et Shiori (Démon jouable), avec dégâts, esquive, coûts, munitions, soins, conditions, mutilation, repousse et effets retardés.

**Validation : 95 tests automatisés réussis**, lint et build réussis ; QA native Foundry **14.368**, import des 14 compendiums, rendu des 32 types de fiches, persistance des cartes de chat, renvoi de Flamme et combat à quatre acteurs réussis.

Voir le [rapport de combat](https://github.com/PrevotYann/breathe-and-live/blob/v0.5.2/resources/rules/combat-audit-2026-10-10.md) pour les scénarios, les réparations et les limites. Les **34 formes aux données incomplètes** et les paramètres non chiffrés du livre exigent toujours un complément ou un arbitrage MJ.

Aucune migration de schéma nécessaire. Mettre à jour le système puis recharger le monde pour charger les corrections.
