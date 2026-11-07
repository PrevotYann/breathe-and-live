# Breathe and Live v0.8.0 — Audit complet des règles

Compatible avec **Foundry VTT 14.368**.

Cette version relit tout le livre chapitre par chapitre et corrige les écarts entre les fiches et les règles.

## Souffles
- Un souffle n'est pratiqué que si son objet « Souffle » est sur la fiche. Sa **compétence spéciale** ne s'active qu'après avoir appris **toutes les formes** du style, comme le prévoit le livre. La fiche affiche « Formes connues X / N » et les compétences encore verrouillées.
- Les cases libres « Activer le souffle / ses passifs » disparaissent. Le bouton « Brume : se cacher / sortir » n'apparaît plus que pour un maître de la Brume.
- Le MJ peut accorder la maîtrise complète à un PNJ (case sur l'objet Souffle).

## Réactions et compétences
- Les joueurs commencent avec l'esquive seule : Riposte, Dégainage et Soin démoniste n'apparaissent qu'une fois la compétence acquise (Entraînement au combat au rang Kanoe ; Changement d'arme rapide et Formation médicale au rang Tsuchinoe ; Formation à la guérison pour les démonistes).
- Nouvelle esquive à 2 RP : un allié peut **tirer une cible à l'abri**.
- TCB Constant, Forme Marquée, Monde Transparent et Lame Rouge restent sans effet tant qu'ils ne sont pas acquis.
- **Bourreau** et **Guillotine** exécutent les démons de 50 / 100 PV de base ou moins ; **L'ombre de la mort** ajoute +3d10 aux attaques discrètes ; **Tir en position stable** immobilise le tireur.
- À 0 Endurance, l'inconscience survient après deux rounds sans Souffle de récupération, et non plus un seul.

## Démonistes et démons
- La réaction de soin démoniste lance le bon dé selon le démon le plus fort mangé récemment (elle lançait 1d10 pour tous les rangs non lunaires). Ce rang s'efface après un repos prolongé.
- « Régénération continue des membres » peut enfin être activée.
- Les démons n'ajoutent que la moitié de leur Puissance / Finesse à leurs arts de sang, comme pour leurs attaques de base.
- Arts de sang et autres valeurs absentes du livre : le MJ les valide en un clic au moment de l'usage au lieu d'un refus. Les arts de sang de Tomoshibi (one-shot) sont livrés validés.

## Équipement
- Équipement de départ du livre : arme du souffle choisi, pistolet au choix, 2 bandages et pansement compressif ou trousse de premiers secours pour le pourfendeur ; fusil de tranchée et wakizashi pour le démoniste.
- Corrections : portée de l'Odachi (3 m), seringue de sang de démon (soins complets), analgésiques (PV temporaires), Uniforme du Corps (+1 CA), Ford modèle T (+1 Dextérité, 600 ¥). Les bonus des voitures s'appliquent à la conduite.
- Les objets sans équivalent dans le livre portent l'étiquette « Hors livre ».

## Mise à jour
Mettre à jour le système **Breathe and Live**, puis recharger le client Foundry. Au premier lancement, le MJ reçoit un message listant les personnages dont un souffle était coché sans objet Souffle. Il suffit de leur glisser le style depuis le compendium « Souffles - Styles ». Rien n'est supprimé.

**Validation :** 118 tests automatisés, lint, vérification du livre (137 pages, 140 formes) et validation des 14 compendiums réussis.

Manifest d'installation et de mise à jour :

https://github.com/PrevotYann/breathe-and-live/releases/latest/download/manifest.json
