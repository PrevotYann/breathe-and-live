# Rulebook Ambiguities And External Data

Source de reference : `resources/rules/Breathe-and-Live.pdf`.

Ce registre liste les zones ou l'automatisation ne doit pas inventer de valeurs. Les entrees ci-dessous doivent etre reliees a un `TODO-RULEBOOK-AMBIGUITY:` dans le code quand une decision technique temporaire est prise.

| Domaine | Donnee manquante ou ambigue | Implementation reversible actuelle |
| --- | --- | --- |
| Reaction d'amelioration demoniste | La duree exacte de l'amelioration Force/Vitesse n'est pas explicite dans les extraits disponibles. | Effet temporaire jusqu'a fin de round dans `module/rules/action-engine.mjs`. |
| Souffles et formes detaillees | Le PDF reference des donnees de formes qui peuvent etre externalisees ou difficiles a extraire exhaustivement. | Framework et champs structures presents ; les formes sans valeur detaillee doivent garder une note `TODO-RULEBOOK-AMBIGUITY` ou une section source explicite. |
| Appendices demoniaques | Le livre distingue ailes, queues et tentacules, mais les acteurs n'indiquent pas toujours combien d'appendices existent. | Quatre emplacements generiques `tentacle1..4`, une entree `tail`, une entree `wings`, masques sur non-demons. |
| Ciblage vital tete/torse | Les consequences exactes d'une mutilation tete/torse peuvent dependre du MJ. | Seuils suivis comme membres a 20%, sans effet instant-kill automatique. |
| Creation entraineur/partenaire/Kasugai | Les noms precis des trois axes peuvent varier selon la mise en page/source. | Trois axes numeriques generiques controles a 0-2 et total 3, avec champs texte pour nommer le contexte. |
| Equipement initial automatique | Certains choix de depart dependent du souffle, de l'arme de souffle et du choix de kit medical. | Import automatique depuis compendiums avec un kit par defaut ; choix fin a remplacer par un assistant. |
| Contenu 1934 et lignages | Plusieurs variantes/lignages de demons demandent des donnees numeriques detaillees. | Toggle et packs partiels ; contenu marque optionnel jusqu'a extraction complete. |
| Fabrication | Le livre donne le DD par nombre de composants, mais ne fixe pas une competence unique pour tous les tests. | Dialogue de fabrication avec competence derivee choisie par le MJ, `sciences` par defaut, et DD structure dans la recette. |
| Expulsion demoniste | L'extraction indique a la fois suppression de tous les points de demonisation et suppression de la moitie du total. | Implementation reversible : cout PV = moitie des PV de base ; demonisation actuelle divisee par deux. |
| Blocage/esquive demoniaque | Les actions sont listees, mais l'effet numerique exact de blocage/esquive n'est pas detaille dans les donnees extraites. | Depense 1 RP et pose une posture defensive consommable sur la prochaine carte d'attaque. |
| Armes alternatives TBD | Naginata, Cimeterre, Patta et Epee crochet sont notees TBD dans le backlog issu du PDF. | Entrees compendium importables marquees `TODO-RULEBOOK-AMBIGUITY`, avec degats/portee a renseigner avant usage automatique. |
| Explosifs/profils de zone | Les valeurs precises de rayon/DD/degats pour certains explosifs demandent confirmation dans la source complete. | Profils jouables conservateurs dans `items-weapons`, avec note d'usage indiquant l'arbitrage MJ et le suivi manuel des conditions. |
