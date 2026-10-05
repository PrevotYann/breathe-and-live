# Arbitrages de règles — audit v0.5.1

Référence actuelle : [livre français](https://docs.google.com/presentation/d/1v8MuzzgndlBA5djtzvsO1-m5RMda2pf02qQ9LYE4N9E/edit), 137 diapositives au 5 octobre 2026. Ce registre remplace les constats incomplets de l'ancien export PDF. Les valeurs du tableur des formes sont comparées dans `rulebook-audit-data.json`.

| Domaine | Ambiguïté ou absence | Traitement réversible |
| --- | --- | --- |
| 34 formes | Soleil 13, Océan 7, Ouest 13 et coût `x` du Vent | Valeurs conservées éditables, exécution bloquée avant validation MJ. |
| Armes TBD | Naginata, Cimeterre, Patta, Épée crochet p.90 | Profil incomplet signalé ; validation nécessaire. |
| Grenades/Molotov/bombe | Portée de lancer non chiffrée ; difficulté/rayon de bombe absents | Champs éditables et validation ; dégâts/rayons connus conservés. |
| Double épée-chaîne | 3 m p.23, 1,5 m p.66 | 3 m de la table générale, note visible. |
| Pierre : changement de tête | Gratuit et « bonus » mentionnés p.44 | Choix de tête guidé ; coût à arbitrer selon économie de table. |
| Repousse p.72/111 | Vitesse lente ou selon rang, sans nombre de tours | Durée obligatoire demandée au MJ, puis compteur réel. |
| Amélioration démoniste | Pas de durée précise | Effet jusqu'à fin de round, note TODO dans `action-engine`. |
| Chair démoniaque | « Récemment » non quantifié | Dernier/plus haut rang consommé suivi, durée narrative contrôlée par MJ. |
| Attaque répétée/bonus de chair | Totaux p.68 contre prose incrémentale p.69 | Table de totaux conservée, notes de progression. |
| Expulsion | Suppression totale et moitié mentionnées | Moitié des PV de base en coût, moitié de démonisation retirée. |
| Tête/torse | Aucun seuil universel de mutilation vitale p.30 | Pas de faux seuil de 20 % ; résolution MJ, PV/décapitation suivis séparément. |
| Blocage démoniaque | Pas de formule chiffrée | Posture préparée, dégâts absorbés demandés au MJ. |
| DD médicaux | Chirurgie/sang nécessitent Médecine mais sans DD | Valeur obligatoire demandée ; échec critique peut tuer uniquement après confirmation de la conséquence MJ. |
| Sang démoniaque | Effets secondaires après trois injections sans détail | Compteur et avertissement, pas de malus inventé. |
| DD de conduite | Aucun DD universel p.102 | MJ choisit, permis automatique en conduite normale. |
| Acrobatie/Force de volonté/Vigueur | Noms de compétences sans mapping canonique ou DD | Choix MJ, jet et résultat appliqués ensuite. |
| Postures de sous-classe | Durée/activation non précisées | Activation/désactivation explicites, pas de coût inventé. |
| Attaque enveloppante p.65 | Désavantage à moins de 9 m mais sans durée | Durée en rounds demandée au MJ, aura puis expiration automatique. |
| Pacte de contrôle mental | Durée d'immobilisation non précisée | Fin de round, TODO visible. |
| Plaisir de servir | Pronom ambigu sur l'échange | Échange avec l'allié protégé, TODO visible. |
| Double-tap | Copie du dernier tir, munitions/changement de cible non précisés | Confirmation explicite du replay même cible/arme avec une munition. |
| Orochi/Athlétisme/Réaction | Certains bonus ou réactions incomplets | Entrées de règles disponibles ; mapping/valeurs à valider avec le MJ. |
| Dents invisibles | Couverture la plus proche/contextes d'invisibilité | Attaque exécutable, couverture/retrait à résoudre avec le MJ. |
| Furtivité/social/vêtements | Situation narrative, mapping de Discrétion, PNJ extérieur au Corps | Bonus contextuels et contrôle MJ ; pas d'application aveugle à tous les jets. |
| Petit/Grand art sanguinaire | Niveaux de puissance, pas de valeurs génériques officielles | Exemples personnalisables explicitement bloqués avant choix du profil MJ. |
| Lune Brûlante p.124 | Portées absentes ; Incinération/Crémation vides | Effets connus présents, champs manquants et attaques nommées à compléter. |
| Onze lignées p.123–134 | Arbres principalement vides | Marqueurs distinctifs, entrées narratives. Six attaques de Lune Endeuillée nommées sans valeurs. |
| Yosuke p.119 | Variante du passif Océan et attaques spécifiques | PNJ dédié avec profils fixes et variante du passif ; les valeurs des sept formes restent à compléter depuis la source. |

Les obstacles, couverture, eau/terre, portée visuelle et personnes réellement traversées doivent être confirmés par le MJ. Les valeurs inconnues ne sont jamais présentées comme officielles. Voir `audit-2026-10-05.md` pour les limites et les notes de migration.
