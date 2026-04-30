# PDF Section Implementation Map

Source de reference : `resources/rules/Breathe-and-Live.pdf`.

Cette table relie les grands blocs du livre aux modules, packs et controles QA du systeme Foundry. Elle sert de garde-fou : quand une regle reste non automatisee ou manque de donnees numeriques, elle doit rester visible ici ou dans `manual-qa-checklist.md`.

| Bloc du PDF | Runtime / schema | Packs / donnees | QA / notes |
| --- | --- | --- | --- |
| Creation de personnage Slayer / Demoniste / Demon | `template.json`, `module/sheets/actor-slayer-sheet.mjs` | `packs/actors-slayers.db`, `packs/actors-demonists.db`, `packs/actors-demons.db` | Assistant guide a creer ; schema et fiches existent. |
| Stats de base et derivees | `module/rules/actor-derived-formulas.mjs`, `module/breathe-and-live.mjs`, `module/sheets/actor-slayer-sheet.mjs` | Acteurs exemples | Verifier depense derivee <= stat de base, jets depuis fiche encore a finaliser. |
| PV, CA, Endurance, RP, BDP, demonisation | `module/rules/actor-derived-formulas.mjs`, `module/breathe-and-live.mjs` | Acteurs exemples | Formules explicites centralisees ; migrations v0.1.x a ajouter. |
| Capacites extrasensorielles | `template.json`, items `sense` | Packs de features/senses a completer | Bonus perception et revelations N3 a automatiser. |
| Caracteristiques surhumaines | `template.json`, items `feature`, effects | Packs de features a completer | Validation des prerequis a ajouter. |
| Actions humaines et RP | `module/rules/action-engine.mjs`, `module/chat/use-technique.mjs` | Items/actions exemples | Eviter sans RP et journal de depense restent a completer. |
| Attaques, armes, projectiles, armes a feu | `module/rules/action-engine.mjs`, item sheets | `packs/items-weapons.db` | Munitions/rechargement encore incomplets. |
| Conditions | `module/config/rule-data.mjs`, `module/rules/action-engine.mjs` | Conditions systeme | Effets de debut de tour partiels ; completer toutes les durees/intensites. |
| Mutilation et blessures graves | `template.json`, `module/rules/action-engine.mjs`, fiches acteur | Acteurs demons de test | Cap de soin implemente ; ciblage chat et seuils par membre a finaliser. |
| Pourfendeur et progression | `module/config/rule-data.mjs`, `module/sheets/actor-slayer-sheet.mjs` | `packs/actors-slayers.db`, features a completer | Verifier chaque rang et gains de slots. |
| Souffles et techniques | `module/config/rule-data.mjs`, `module/rules/breath-effects.mjs`, `module/chat/use-technique.mjs` | `packs/techniques-breaths.db`, `packs/breaths-styles.db`, `resources/souffles/*.json` | Passifs partiels ; marquer les donnees absentes avec `TODO-RULEBOOK-AMBIGUITY`. |
| Souffles personnalises | `module/config/rule-data.mjs` | Donnees de tables dans config | Tables de cout ajoutees ; calculateur UI/item a creer. |
| Sous-classes Slayer | `template.json`, `module/chat/use-technique.mjs` | `packs/techniques-subclasses.db` | Donnees et automatisations a enrichir. |
| Demoniste | `module/rules/action-engine.mjs`, `module/chat/use-technique.mjs`, `template.json` | `packs/actors-demonists.db` | Chair/BDP/demonisation presents ; pouvoirs et sous-classes a completer. |
| Demons jouables et PNJ demons | `module/rules/action-engine.mjs`, `module/config/rule-data.mjs`, `template.json` | `packs/actors-demons.db`, `packs/abilities-demons.db` | Actions communes presentes ; assistant creation a creer. |
| Objets, medecine, poison, crafting | `module/rules/action-engine.mjs`, item sheets | `packs/items-medical-utility.db`, `packs/items-weapons.db` | Soins/poisons partiels ; crafting a creer. |
| Transport, vetements, nourriture, mort | `template.json`, `module/rules/action-engine.mjs`, item sheets | `packs/items-medical-utility.db` | Nourriture restaure Endurance ; conduite/mort a finaliser. |
| TCB, Marque, Monde Transparent, Lame Rouge | `module/rules/breath-effects.mjs`, `module/chat/use-technique.mjs`, acteur `states` | Features a completer | Toggles presents ; verifier toutes interactions haut rang. |
| Supplement 1934 | setting global dans `module/breathe-and-live.mjs`, schema `supplement1934` | `packs/supplement-1934.db` | Packs et toggles partiels ; donnees supplementaires a completer. |
| Compendiums obligatoires | Scripts `resources/scripts/*.mjs`, packs `packs/*.db` | Tous packs | `npm run validate:packs` controle les `sourceSection` des items et items embarques. |

Voir aussi `resources/rules/rulebook-ambiguities.md` pour les valeurs absentes, externalisees ou volontairement laissees sous controle MJ.
