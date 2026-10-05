# Breathe and Live 0.4.0

- Dossiers natifs Foundry pour les 14 compendiums, sous « Breathe and Live » : Personnages et bestiaire, Souffles, Capacités et progression, Équipement et soins, Supplément 1934.
- Palettes distinctes pour les Pourfendeurs (vert sarcelle), Démons (rouge), Démonistes (violet) et Compagnons (ambre), étendues aux fenêtres, en-têtes, navigation et commandes.
- Illustration originale pour la carte du système et la bannière par défaut des mondes. L'intégration du logo reste en attente du fichier image : le lien blob Google Docs fourni ne permet pas de le récupérer.
- Compatibilité Foundry VTT 14.368. Aucun changement des règles, des identifiants des compendiums ou des schémas de documents.

## Mise à jour

Mettre à jour le système depuis Foundry puis relancer le monde. Foundry initialise les dossiers définis dans `packFolders` et conserve les affectations déjà personnalisées par le MJ. Les compendiums conservent leurs UUID et leurs contenus ; les dossiers internes des techniques ne changent pas.

La bannière est fournie via la propriété native `background`. Un monde disposant d'une bannière personnalisée conserve celle-ci. Chemin de l'illustration : `systems/breathe-and-live/assets/art/system-cover.png`.

## Validation

Lint, 40 tests automatisés et build des 14 compendiums validés. La mise à jour d'un monde existant a été vérifiée sur Foundry 14.368 : les 14 compendiums apparaissent dans les cinq dossiers attendus. Les palettes ont été vérifiées sur Foundry 14.368 (32 types de fiches, 258 combinaisons onglet/largeur).
