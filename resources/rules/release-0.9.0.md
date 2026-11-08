# Breathe and Live v0.9.0 — Rencontres du one-shot testées et équilibrées

Compatible avec **Foundry VTT 14.368**.

Les deux combats des « Lanternes de Hotaru » ont été rejoués des centaines de fois par le moteur du système, avec les prétirés et les tactiques du Guide du MJ. Cette version corrige les bugs découverts et rééquilibre les démons.

## Ce que les tests ont montré
- Les joueurs gagnaient toujours, mais trop vite : chaque combat se terminait en 2 rounds, et Tomoshibi mourait avant d'avoir utilisé ses arts de sang (moins de 1 PV perdu par toute l'équipe).
- Deux bugs du moteur pouvaient bloquer un pourfendeur : une forme en charge restait « en charge » d'un combat à l'autre, et la Brûlure annulait la charge à chaque tour.

## Démons du one-shot
- **Rôdeurs des lanternes** : 40 PV, CA 14, 5 PR. Le combat du pont dure 2 à 3 rounds, le temps d'apprendre les règles.
- **Tomoshibi** : 90 PV, CA 16, 8 PR, 30 BDP (corps « Monstrueux » et caractéristiques du repère « démon de rang élevé » du livre). Avec cinq joueurs, l'atelier dure environ 4 rounds : son plan round par round se joue enfin.
- **Feu follet bleu** touche jusqu'à 3 cibles désignées (une esquive par cible) et sa Brûlure dure 3 tours au lieu d'être permanente.
- Le Guide du MJ donne les nouvelles valeurs et des réglages testés pour 3, 4 ou 5 joueurs et pour les tables expérimentées. Les joueurs l'emportent dans toutes les configurations testées.

## Corrections du moteur
- Les charges et les recharges de techniques s'effacent à la fin du combat et ne bloquent plus le combat suivant.
- Brûlure, Saignement et Poison n'interrompent plus une charge : comme le dit le livre, seule une attaque le fait.
- Une attaque à la lame Nichirin qui vise la tête d'un démon et atteint ses PV restants annonce clairement la décapitation.

## Mise à jour
Mettre à jour le système **Breathe and Live**, puis recharger le client Foundry. Au premier lancement, les charges de techniques enregistrées par les versions précédentes sont effacées. Les mondes qui ont déjà importé l'aventure gardent leurs anciens démons : réimportez l'aventure pour profiter de l'équilibrage.

**Validation :** 125 tests automatisés (dont 7 combats et régressions du one-shot), lint, vérification du livre et validation des 14 compendiums réussis.

Manifest d'installation et de mise à jour :

https://github.com/PrevotYann/breathe-and-live/releases/latest/download/manifest.json
